"""
GKIN agentic fact-checking benchmark (the /verify-claims loop).

What this answers:
  "When GKIN turns a claim into a grounded SUPPORTED / CONTRADICTED /
   INSUFFICIENT verdict, how often is it right when it commits, how often does
   it bluff (confidently wrong), and how does that compare to a plain LLM with
   no retrieval — and, optionally, to ChatGPT / Gemini / Perplexity?"

This is independent of the ML fake/real classifier — it never imports it.

Framing (a fact-checker with an 'I don't know' option):
  - coverage         = decided / total          (how often it commits)
  - decided_accuracy = correct / decided        (when it commits, is it right?)
  - misleading_rate  = wrong / decided          (confidently wrong — the danger)
  - correct_abstain  = INSUFFICIENT / total     (on opinion/unverifiable claims)

Systems compared:
  - gkin      : the agentic loop via /verify-claims (grounded + cited)        [always]
  - bare_llm  : same Groq model, NO retrieval (≈ a vanilla chatbot)           [--baseline]
  - openai    : OpenAI chat model, no tools          [if OPENAI_API_KEY]
  - gemini    : Google Gemini, no tools              [if GEMINI_API_KEY]
  - perplexity: Perplexity (does its own retrieval)  [if PERPLEXITY_API_KEY]

Run:
    uvicorn server:app --port 8000          # GKIN must be up
    export GKIN_JWT="$(curl -s -XPOST localhost:8000/login \
      -H content-type:application/json \
      -d '{"username":"tester","password":"testpass123"}' | python -c 'import sys,json;print(json.load(sys.stdin)["token"])')"
    python benchmark/run_verification_benchmark.py --baseline
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Optional

import requests

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

CLAIMS_PATH = Path(__file__).parent / "verification_claims.json"
RESULTS_DIR = Path(__file__).parent / "results"
RESULTS_DIR.mkdir(exist_ok=True)

# Verdict vocabulary shared across every system.
VERDICTS = ("supported", "contradicted", "insufficient")
LABEL_TO_VERDICT = {"true": "supported", "false": "contradicted"}
GROQ_BASELINE_MODEL = "llama-3.3-70b-versatile"

CLASSIFY_PROMPT = (
    "Decide whether the following claim is true, false, or whether there is not "
    "enough information / it is a matter of opinion. Return ONLY JSON: "
    '{"verdict": "supported|contradicted|insufficient", "confidence": 0.0-1.0}. '
    "Use 'supported' if true, 'contradicted' if false, 'insufficient' if it is an "
    "opinion or you cannot determine it.\n\nClaim: "
)


def set_seed(seed: int) -> None:
    random.seed(seed)
    os.environ.setdefault("PYTHONHASHSEED", str(seed))


def load_claims(path: Path, limit: int = 0) -> list[dict]:
    data = json.loads(path.read_text())
    claims = data["claims"] if isinstance(data, dict) else data
    claims = [c for c in claims if isinstance(c, dict) and c.get("claim_id")]
    return claims[:limit] if limit else claims


# ── System adapters: each maps claim_id -> verdict string ─────────────────────


def run_gkin(claims: list[dict], server: str, jwt: str, timeout: int, batch: int,
             sleep: float = 10.0, force_refresh: bool = True, backend: Optional[str] = None) -> dict:
    """Hit /verify-claims in small batches with a pause between them.

    The loop fires several DuckDuckGo searches + Groq calls per claim; firing
    36 claims as fast as possible trips DDG and Groq rate limits (everything
    then returns INSUFFICIENT for lack of evidence). Small batches + a pause
    let the free services recover, so the numbers reflect the system, not 429s.
    """
    texts = [c["claim"] for c in claims]
    ids = [c["claim_id"] for c in claims]
    out: dict[str, dict] = {}
    starts = list(range(0, len(texts), batch))
    for bi, start in enumerate(starts):
        chunk_texts = texts[start:start + batch]
        chunk_ids = ids[start:start + batch]
        print(f"  gkin: claims {start + 1}-{start + len(chunk_texts)} / {len(texts)} …", flush=True)
        r = requests.post(
            f"{server}/verify-claims",
            # force_refresh so a prior (possibly rate-limited) cached verdict
            # can't poison the benchmark — always measure live behavior.
            # --use-cache flips this off to instantly re-pull a prior good run.
            json={"claims": chunk_texts, "max_claims": len(chunk_texts),
                  "force_refresh": force_refresh,
                  **({"search_backend": backend} if backend else {})},
            headers={"Authorization": f"Bearer {jwt}"},
            timeout=timeout,
        )
        r.raise_for_status()
        verdicts = r.json()["verdicts"]
        for cid, v in zip(chunk_ids, verdicts):
            out[cid] = {
                "verdict": (v.get("label") or "").lower(),
                "confidence": v.get("confidence"),
                "low_confidence": v.get("low_confidence"),
                "n_evidence": len(v.get("evidence", [])),
                "iterations": v.get("iterations"),
                "retries": v.get("retries"),
                "evidence_urls": [e.get("url") for e in v.get("evidence", [])[:3]],
            }
        if sleep and bi < len(starts) - 1:
            time.sleep(sleep)
    return out


def _parse_verdict_json(text: str) -> str:
    import re
    try:
        obj = json.loads(text)
    except Exception:
        m = re.search(r"\{.*\}", text or "", re.DOTALL)
        obj = json.loads(m.group(0)) if m else {}
    v = str(obj.get("verdict", "insufficient")).strip().lower()
    return v if v in VERDICTS else "insufficient"


def run_groq_baseline(claims: list[dict], sleep: float = 2.0) -> dict:
    """Same model GKIN grounds with, but NO retrieval — pure parametric guess.

    Paced + retries on 429 so the baseline isn't poisoned by rate limits (which
    would unfairly inflate its INSUFFICIENT count)."""
    from groq import Groq
    key = os.environ.get("GROQ_API_KEY")
    if not key:
        print("  bare_llm: skipped (no GROQ_API_KEY)")
        return {}
    client = Groq(api_key=key)
    out: dict[str, dict] = {}
    for i, c in enumerate(claims, 1):
        verdict, err = "insufficient", None
        for attempt in range(5):
            try:
                resp = client.chat.completions.create(
                    model=GROQ_BASELINE_MODEL,
                    messages=[
                        {"role": "system", "content": "Output only valid JSON."},
                        {"role": "user", "content": CLASSIFY_PROMPT + c["claim"]},
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.0,
                    max_tokens=80,
                )
                verdict = _parse_verdict_json(resp.choices[0].message.content)
                err = None
                break
            except Exception as e:  # noqa: BLE001
                err = str(e)[:120]
                if "429" in err or "rate limit" in err.lower():
                    time.sleep(8 * (attempt + 1))  # back off and retry
                    continue
                break
        out[c["claim_id"]] = {"verdict": verdict, **({"error": err} if err else {})}
        if sleep:
            time.sleep(sleep)
        if i % 10 == 0:
            print(f"  bare_llm: {i}/{len(claims)}", flush=True)
    return out


def _http_llm(claims, name, url, headers, body_fn, extract_fn):
    """Generic key-gated external chat adapter (no retrieval unless the provider
    does it server-side, as Perplexity does)."""
    import httpx
    out: dict[str, dict] = {}
    for i, c in enumerate(claims, 1):
        try:
            resp = httpx.post(url, headers=headers, json=body_fn(c["claim"]), timeout=40.0)
            resp.raise_for_status()
            out[c["claim_id"]] = {"verdict": _parse_verdict_json(extract_fn(resp.json()))}
        except Exception as e:  # noqa: BLE001
            out[c["claim_id"]] = {"verdict": "insufficient", "error": str(e)[:120]}
        if i % 10 == 0:
            print(f"  {name}: {i}/{len(claims)}")
    return out


def run_openai(claims: list[dict]) -> dict:
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        return {}
    model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
    return _http_llm(
        claims, "openai", "https://api.openai.com/v1/chat/completions",
        {"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        lambda claim: {"model": model, "temperature": 0,
                       "response_format": {"type": "json_object"},
                       "messages": [{"role": "user", "content": CLASSIFY_PROMPT + claim}]},
        lambda j: j["choices"][0]["message"]["content"],
    )


def run_perplexity(claims: list[dict]) -> dict:
    key = os.environ.get("PERPLEXITY_API_KEY")
    if not key:
        return {}
    model = os.environ.get("PERPLEXITY_MODEL", "sonar")
    return _http_llm(
        claims, "perplexity", "https://api.perplexity.ai/chat/completions",
        {"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        lambda claim: {"model": model, "temperature": 0,
                       "messages": [{"role": "user", "content": CLASSIFY_PROMPT + claim}]},
        lambda j: j["choices"][0]["message"]["content"],
    )


def run_gemini(claims: list[dict]) -> dict:
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        return {}
    model = os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
    return _http_llm(
        claims, "gemini", url, {"Content-Type": "application/json"},
        lambda claim: {"contents": [{"parts": [{"text": CLASSIFY_PROMPT + claim}]}],
                       "generationConfig": {"temperature": 0, "responseMimeType": "application/json"}},
        lambda j: j["candidates"][0]["content"]["parts"][0]["text"],
    )


# ── Metrics ───────────────────────────────────────────────────────────────────


def score_system(claims: list[dict], preds: dict) -> dict:
    verifiable = [c for c in claims if c["label"] in LABEL_TO_VERDICT]
    opinion = [c for c in claims if c["label"] == "unverifiable"]
    recent = [c for c in verifiable if c.get("post_cutoff")]

    def pv(c):  # predicted verdict
        return (preds.get(c["claim_id"], {}) or {}).get("verdict", "insufficient")

    decided = [c for c in verifiable if pv(c) in ("supported", "contradicted")]
    correct = [c for c in decided if pv(c) == LABEL_TO_VERDICT[c["label"]]]
    wrong = [c for c in decided if pv(c) != LABEL_TO_VERDICT[c["label"]]]
    correct_all = [c for c in verifiable if pv(c) == LABEL_TO_VERDICT[c["label"]]]

    n_ver = len(verifiable)
    n_dec = len(decided)

    def rate(num, den):
        return round(num / den, 3) if den else None

    recent_correct = [c for c in recent if pv(c) == LABEL_TO_VERDICT[c["label"]]]
    opinion_abstained = [c for c in opinion if pv(c) == "insufficient"]

    return {
        "n_verifiable": n_ver,
        "coverage": rate(n_dec, n_ver),
        "decided_accuracy": rate(len(correct), n_dec),
        "misleading_rate": rate(len(wrong), n_dec),
        "overall_accuracy_abstain_as_wrong": rate(len(correct_all), n_ver),
        "recent_accuracy": rate(len(recent_correct), len(recent)),
        "n_recent": len(recent),
        "opinion_correct_abstention": rate(len(opinion_abstained), len(opinion)),
        "n_opinion": len(opinion),
        "wrong_claim_ids": [c["claim_id"] for c in wrong],
    }


def fmt(x):
    return "  -  " if x is None else f"{x*100:5.1f}%"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--server", default=os.environ.get("GKIN_SERVER", "http://localhost:8000"))
    ap.add_argument("--jwt", default=os.environ.get("GKIN_JWT", ""))
    ap.add_argument("--claims", default=str(CLAIMS_PATH))
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--batch", type=int, default=3, help="claims per /verify-claims request")
    ap.add_argument("--sleep", type=float, default=10.0, help="pause (s) between GKIN batches to dodge DDG/Groq rate limits")
    ap.add_argument("--baseline-sleep", type=float, default=2.0, help="pause (s) between baseline LLM calls")
    ap.add_argument("--timeout", type=int, default=600)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--baseline", action="store_true", help="also run the no-retrieval Groq baseline")
    ap.add_argument("--no-gkin", action="store_true", help="skip GKIN (only baselines)")
    ap.add_argument("--use-cache", action="store_true",
                    help="read GKIN verdicts from the server cache instead of re-verifying (instant; for re-pulling a prior good run)")
    ap.add_argument("--backend", default=None,
                    help="force GKIN search backend: wikipedia|ddg|brave|google|auto. "
                         "'wikipedia' is the most rate-limit-resistant for batch benchmarking.")
    args = ap.parse_args()

    set_seed(args.seed)
    claims = load_claims(Path(args.claims), args.limit)
    print(f"Claims: {len(claims)}  ({sum(c['label']=='true' for c in claims)} true / "
          f"{sum(c['label']=='false' for c in claims)} false / "
          f"{sum(c['label']=='unverifiable' for c in claims)} opinion)\n")

    systems: dict[str, dict] = {}

    if not args.no_gkin:
        if not args.jwt:
            print("ERROR: pass --jwt or set GKIN_JWT (login first). Or use --no-gkin.")
            sys.exit(2)
        print("Running gkin (agentic loop)…")
        t0 = time.time()
        systems["gkin"] = run_gkin(claims, args.server, args.jwt, args.timeout, args.batch,
                                   0.0 if args.use_cache else args.sleep,
                                   force_refresh=not args.use_cache, backend=args.backend)
        print(f"  gkin done in {time.time()-t0:.0f}s\n")

    if args.baseline:
        print("Running bare_llm (Groq, no retrieval)…")
        systems["bare_llm"] = run_groq_baseline(claims, args.baseline_sleep)
    for name, fn in (("openai", run_openai), ("gemini", run_gemini), ("perplexity", run_perplexity)):
        preds = fn(claims)
        if preds:
            print(f"Running {name}…")
            systems[name] = preds

    metrics = {name: score_system(claims, preds) for name, preds in systems.items()}

    summary = {
        "metadata": {
            "run_at": datetime.now(timezone.utc).isoformat(),
            "n_claims": len(claims),
            "server": args.server,
            "seed": args.seed,
            "systems": list(systems),
        },
        "metrics": metrics,
        "predictions": {name: preds for name, preds in systems.items()},
    }
    out_path = RESULTS_DIR / "verification_benchmark.json"
    out_path.write_text(json.dumps(summary, indent=2))

    # ── Console comparison table ──────────────────────────────────────────────
    print("\n" + "=" * 78)
    print("AGENTIC FACT-CHECKING BENCHMARK")
    print("=" * 78)
    cols = list(metrics)
    rows = [
        ("Coverage (commits)", "coverage"),
        ("Decided accuracy", "decided_accuracy"),
        ("Misleading rate (conf. wrong)", "misleading_rate"),
        ("Overall acc (abstain=wrong)", "overall_accuracy_abstain_as_wrong"),
        (f"Recent/post-cutoff acc", "recent_accuracy"),
        ("Opinion correct-abstention", "opinion_correct_abstention"),
    ]
    header = f"{'metric':<32}" + "".join(f"{c:>12}" for c in cols)
    print(header); print("-" * len(header))
    for label, key in rows:
        print(f"{label:<32}" + "".join(fmt(metrics[c][key]) + "  " for c in cols).rstrip())
    print(f"\nSaved: {out_path}")
    print("Lower misleading_rate is better. INSUFFICIENT on opinions is correct, not a miss.")


if __name__ == "__main__":
    main()
