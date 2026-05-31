"""Automated competitor benchmark: GKIN vs ChatGPT / Gemini / Perplexity.

Sends the same verification prompts to every available provider, scores each
answer on a consistent 7-category rubric (rule-based, or optional LLM-as-judge),
and writes a JSON + CSV + Markdown report.

Providers with missing API keys (or an unreachable GKIN server) are skipped with
a clear warning; whatever is available still runs.

Usage:
    python benchmark/run_competitor_benchmark.py                       # all available, heuristic
    python benchmark/run_competitor_benchmark.py --mode judge          # add LLM-as-judge (needs OPENAI_API_KEY)
    python benchmark/run_competitor_benchmark.py --providers gkin openai perplexity gemini

Env vars (all optional except where noted):
    GKIN_BASE_URL (default http://localhost:8000), GKIN_JWT or GKIN_USERNAME/GKIN_PASSWORD
    OPENAI_API_KEY / OPENAI_MODEL
    GEMINI_API_KEY / GEMINI_MODEL
    PERPLEXITY_API_KEY / PERPLEXITY_MODEL
    JUDGE_MODEL (default gpt-4o-mini, used by --mode judge)
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from benchmark import scoring                       # noqa: E402
from benchmark.providers import PROVIDERS           # noqa: E402

HERE = Path(__file__).parent
PROMPTS_PATH = HERE / "verification_prompts.json"
RESULTS_DIR = HERE / "results"


def load_prompts(path: Path) -> list[dict]:
    data = json.loads(path.read_text())
    prompts = data["prompts"] if isinstance(data, dict) else data
    return [p for p in prompts if isinstance(p, dict) and p.get("id")]


def parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser(description="GKIN vs ChatGPT/Gemini/Perplexity benchmark")
    ap.add_argument("--mode", choices=["heuristic", "judge"], default="heuristic",
                    help="heuristic = rule-based only; judge = add LLM-as-judge (needs OPENAI_API_KEY)")
    ap.add_argument("--providers", nargs="+", default=list(PROVIDERS),
                    help=f"subset of: {', '.join(PROVIDERS)}")
    ap.add_argument("--prompts", type=Path, default=PROMPTS_PATH)
    ap.add_argument("--out", type=Path, default=RESULTS_DIR)
    ap.add_argument("--sleep", type=float, default=0.0,
                    help="seconds to pause between prompts (paces free backends so "
                         "GKIN's search/LLM don't rate-limit into INSUFFICIENT)")
    ap.add_argument("--gkin-cache", action="store_true",
                    help="let GKIN reuse its claim-hash cache instead of force_refresh — "
                         "makes scores reproducible run-to-run (recommended for the demo)")
    return ap.parse_args()


def resolve_providers(requested: list[str]) -> tuple[list, list[tuple[str, str]]]:
    """Return (active modules, [(name, skip-reason)])."""
    active, skipped = [], []
    for key in requested:
        mod = PROVIDERS.get(key)
        if mod is None:
            skipped.append((key, "unknown provider"))
            continue
        ok, reason = mod.available()
        if ok:
            active.append(mod)
        else:
            skipped.append((mod.NAME, reason))
    return active, skipped


def run(active, prompts, mode, sleep_s: float = 0.0) -> list[dict]:
    """Query every active provider on every prompt; attach scores. Returns rows."""
    import time
    use_judge = mode == "judge" and scoring.judge_available()
    rows: list[dict] = []
    for mod in active:
        print(f"\n=== {mod.NAME} ===", flush=True)
        for i, p in enumerate(prompts):
            print(f"  · {p['id']} …", flush=True)
            res = mod.query(p)
            res["heuristic"] = scoring.score_heuristic(res, p)
            res["judge"] = scoring.score_with_judge(res, p) if use_judge else None
            res["category"] = p.get("category", "")
            rows.append(res)
            if sleep_s and i < len(prompts) - 1:
                time.sleep(sleep_s)
    return rows


def primary_scores(row: dict, mode: str) -> dict:
    """Pick judge scores when present, else heuristic."""
    if mode == "judge" and row.get("judge"):
        return row["judge"]
    return row["heuristic"]


def aggregate(rows: list[dict], mode: str) -> dict:
    """Per-provider average total + per-category averages."""
    agg: dict[str, dict] = {}
    for r in rows:
        prov = r["provider"]
        s = primary_scores(r, mode)
        a = agg.setdefault(prov, {"n": 0, "total": 0.0,
                                  **{c: 0.0 for c in scoring.CATEGORIES}})
        a["n"] += 1
        a["total"] += s.get("total", 0)
        for c in scoring.CATEGORIES:
            a[c] += s.get(c, 0)
    for prov, a in agg.items():
        n = max(1, a["n"])
        a["avg_total"] = round(a["total"] / n, 2)
        for c in scoring.CATEGORIES:
            a[f"avg_{c}"] = round(a[c] / n, 2)
    return agg


# ── output writers ────────────────────────────────────────────────────────────

def write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False))


def write_csv(path: Path, rows: list[dict], mode: str) -> None:
    cols = ["provider", "prompt_id", "category", *scoring.CATEGORIES, "total", "error"]
    with path.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(cols)
        for r in rows:
            s = primary_scores(r, mode)
            w.writerow([r["provider"], r["prompt_id"], r.get("category", ""),
                        *[s.get(c, 0) for c in scoring.CATEGORIES],
                        s.get("total", 0), r.get("error") or ""])


def write_report(path: Path, rows, agg, active, skipped, prompts, mode, json_path) -> None:
    now = datetime.now(timezone.utc).isoformat()
    use_judge = mode == "judge" and scoring.judge_available()
    method = ("LLM-as-judge (OpenAI) with rule-based scores retained alongside"
              if use_judge else "rule-based heuristic")
    L: list[str] = []
    L.append("# Automated Benchmark — GKIN vs General AI Tools\n")
    L.append(f"_Generated {now}._\n")
    L.append(f"- **Providers tested:** {', '.join(m.NAME for m in active) or 'none'}")
    if skipped:
        L.append("- **Skipped (no key / unreachable):** " +
                 "; ".join(f"{n} ({why})" for n, why in skipped))
    L.append(f"- **Prompts:** {len(prompts)}")
    L.append(f"- **Scoring method:** {method}")
    if mode == "judge" and not scoring.judge_available():
        L.append("- ⚠️ `--mode judge` requested but `OPENAI_API_KEY` is missing — **fell back to heuristic.**")
    L.append(f"- **Rubric:** 7 categories × 0–2 = **{scoring.MAX_TOTAL} max**.\n")

    # Overall table
    L.append("## Overall (average score per provider)\n")
    L.append(f"| Provider | Avg total / {scoring.MAX_TOTAL} | " +
             " | ".join(c.replace("_", " ") for c in scoring.CATEGORIES) + " |")
    L.append("|---|---:|" + "---:|" * len(scoring.CATEGORIES))
    for prov, a in sorted(agg.items(), key=lambda kv: -kv[1]["avg_total"]):
        L.append(f"| **{prov}** | **{a['avg_total']}** | " +
                 " | ".join(f"{a[f'avg_{c}']}" for c in scoring.CATEGORIES) + " |")
    L.append("")

    # Per-prompt table
    L.append("## Per-prompt totals\n")
    provs = [m.NAME for m in active]
    L.append("| Prompt | Category | " + " | ".join(provs) + " |")
    L.append("|---|---|" + "---:|" * len(provs))
    by_pp = {(r["prompt_id"], r["provider"]): primary_scores(r, mode).get("total", 0) for r in rows}
    for p in prompts:
        cells = [str(by_pp.get((p["id"], prov), "—")) for prov in provs]
        L.append(f"| {p['id']} | {p.get('category','')} | " + " | ".join(cells) + " |")
    L.append("")

    # GKIN strengths
    L.append("## Where GKIN is designed to win\n")
    L.append("GKIN structurally guarantees the dimensions the midterm feedback flagged: "
             "**traceability** (every confident verdict carries a verbatim source span), "
             "**source quality** (a trusted-source tier policy), and **uncertainty handling** "
             "(it returns INSUFFICIENT instead of guessing). General assistants may match "
             "fluency but do not guarantee these.\n")

    # Limitations
    L.append("## Honest limitations\n")
    L.append("- **Heuristic scoring is blunt.** It reads surface signals (URLs, dates, hedging, "
             "rejection language, trusted-domain mentions, expected-fact keywords) — it does not "
             "verify that an argument is correct. Treat it as directional, not ground truth.")
    L.append("- **`timeline_clarity` is scored for every prompt**, so providers that (reasonably) "
             "give no timeline for a non-timeline prompt score 0 there — but this is applied "
             "equally to all providers, so the comparison stays fair.")
    L.append("- **GKIN is queried via its own endpoints** (`/verify-claims`, `/timeline`) with the "
             "claim under test; competitors receive the full natural-language prompt. Both are "
             "scored on the identical output rubric.")
    L.append("- **LLM-as-judge**, when used, is itself an LLM and can err; its scores are stored "
             "separately from the heuristic ones, never blended.")
    L.append("- Results depend on which API keys / search backends are present; they are "
             "reproducible given the same providers and prompts.\n")

    # Raw excerpts
    L.append("## Answer excerpts\n")
    for p in prompts:
        L.append(f"### {p['id']}")
        L.append(f"> {p['prompt']}\n")
        for r in rows:
            if r["prompt_id"] != p["id"]:
                continue
            head = f"**{r['provider']}**"
            if r.get("error"):
                L.append(f"{head}: _error — {r['error']}_\n")
                continue
            excerpt = (r.get("answer", "") or "").replace("\n", " ").strip()[:320]
            ncite = len(r.get("citations", []))
            L.append(f"{head} ({ncite} citation(s)): {excerpt}…\n")
    L.append(f"\n_Raw machine-readable results: `{json_path.relative_to(ROOT)}`_")

    path.write_text("\n".join(L))


def main() -> None:
    import os
    args = parse_args()
    # --gkin-cache => GKIN reuses its claim-hash cache (reproducible); default is
    # force_refresh (measure live behaviour). Read by the GKIN provider at query time.
    os.environ["GKIN_FORCE_REFRESH"] = "0" if args.gkin_cache else "1"
    prompts = load_prompts(args.prompts)
    active, skipped = resolve_providers(args.providers)

    print("Providers active:", ", ".join(m.NAME for m in active) or "NONE")
    for name, why in skipped:
        print(f"  ⚠ skipped {name}: {why}")
    if not active:
        print("\nNo providers available. Start GKIN (python server.py) and/or set API keys.")
        sys.exit(1)

    rows = run(active, prompts, args.mode, sleep_s=args.sleep)
    agg = aggregate(rows, args.mode)

    args.out.mkdir(parents=True, exist_ok=True)
    json_path = args.out / "latest_results.json"
    csv_path = args.out / "latest_results.csv"
    md_path = args.out / "latest_report.md"

    write_json(json_path, {
        "metadata": {
            "run_at": datetime.now(timezone.utc).isoformat(),
            "mode": args.mode,
            "judge_used": args.mode == "judge" and scoring.judge_available(),
            "providers_tested": [m.NAME for m in active],
            "providers_skipped": [{"name": n, "reason": w} for n, w in skipped],
            "n_prompts": len(prompts),
            "rubric_categories": scoring.CATEGORIES,
            "max_total": scoring.MAX_TOTAL,
        },
        "aggregate": agg,
        "rows": rows,
    })
    write_csv(csv_path, rows, args.mode)
    write_report(md_path, rows, agg, active, skipped, prompts, args.mode, json_path)

    print("\n── Results ──")
    for prov, a in sorted(agg.items(), key=lambda kv: -kv[1]["avg_total"]):
        print(f"  {prov:12s} avg {a['avg_total']:>5} / {scoring.MAX_TOTAL}")
    print(f"\nWrote:\n  {md_path}\n  {json_path}\n  {csv_path}")


if __name__ == "__main__":
    main()
