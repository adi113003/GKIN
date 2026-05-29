"""
GKIN end-to-end manipulation-detection benchmark.

What this answers:
  "When the full GKIN pipeline (ML + LLM + claim verification + scrape) runs
   on real, hand-labeled articles, does its final verdict match human ground
   truth?"

Approach:
  1. Read benchmark/hand_labels.json (a list of {article_id, text|url,
     ground_truth_fake, ground_truth_manipulative, ...}).
  2. POST each article's text to /analyze on a running GKIN server.
  3. Record manipulation_index, fake_detection.verdict, ml_score, and
     compute accuracy / FP rate / FN rate / correlation vs ground truth.
  4. Write benchmark/results/manipulation_benchmark.json.

Run:
    # 1) start the server first:
    uvicorn server:app --reload --port 8000

    # 2) get a JWT (register/login via /register or /login) and export it:
    export GKIN_JWT="eyJhbGc..."

    # 3) run the benchmark:
    python benchmark/run_manipulation_benchmark.py
    python benchmark/run_manipulation_benchmark.py --server http://localhost:8000
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
from typing import Optional

import numpy as np
import requests


ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

LABELS_PATH = Path(__file__).parent / "hand_labels.json"
RESULTS_DIR = Path(__file__).parent / "results"
RESULTS_DIR.mkdir(exist_ok=True)


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    os.environ["PYTHONHASHSEED"] = str(seed)


def load_labels(path: Path) -> list[dict]:
    raw = json.loads(path.read_text())
    if not isinstance(raw, list):
        raise ValueError(f"{path} must contain a JSON array")
    # Skip stub / README entries that lack article_id.
    return [e for e in raw if isinstance(e, dict) and e.get("article_id")]


def fetch_article_text(entry: dict, server: str, jwt: str, timeout: int) -> Optional[str]:
    """Return the article text, fetching via /fetch-url if only a URL was given."""
    text = (entry.get("text") or "").strip()
    if text and not text.startswith("PASTE THE FULL ARTICLE"):
        return text

    url = (entry.get("url") or "").strip()
    if not url:
        return None

    # Use GKIN's own /fetch-url so we read articles the same way the
    # production frontend does — extractor quirks (boilerpipe-style cleanup,
    # paywall handling) get applied uniformly.
    try:
        r = requests.post(
            f"{server}/fetch-url",
            json={"url": url},
            headers={"Authorization": f"Bearer {jwt}"},
            timeout=timeout,
        )
        if r.status_code != 200:
            return None
        body = r.json()
        return (body.get("text") or body.get("article") or "").strip() or None
    except requests.RequestException:
        return None


def analyze_article(text: str, server: str, jwt: str, timeout: int) -> Optional[dict]:
    try:
        r = requests.post(
            f"{server}/analyze",
            json={"article": text},
            headers={"Authorization": f"Bearer {jwt}"},
            timeout=timeout,
        )
        if r.status_code != 200:
            return {"_error": f"HTTP {r.status_code}: {r.text[:200]}"}
        return r.json()
    except requests.RequestException as e:
        return {"_error": str(e)}


def verdict_to_fake_bool(verdict: str) -> Optional[bool]:
    """Map /analyze verdict strings to a binary fake flag.

    UNCERTAIN intentionally returns None: forcing it to a side would either
    inflate FPR or FNR depending on which way you flip the coin. The summary
    metrics treat UNCERTAINs as their own bucket.
    """
    v = (verdict or "").upper().strip()
    if v in {"REAL", "LIKELY REAL"}:
        return False
    if v in {"FAKE", "LIKELY FAKE"}:
        return True
    return None


def pearson(a: list[float], b: list[float]) -> Optional[float]:
    if len(a) < 2 or len(a) != len(b):
        return None
    arr_a, arr_b = np.asarray(a, dtype=float), np.asarray(b, dtype=float)
    if arr_a.std() == 0 or arr_b.std() == 0:
        return None
    return float(np.corrcoef(arr_a, arr_b)[0, 1])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--server", default=os.environ.get("GKIN_SERVER", "http://localhost:8000"))
    ap.add_argument("--jwt", default=os.environ.get("GKIN_JWT", ""))
    ap.add_argument("--labels", default=str(LABELS_PATH))
    ap.add_argument("--timeout", type=int, default=180,
                    help="Per-request timeout. /analyze can take 30-90s.")
    ap.add_argument("--limit", type=int, default=0,
                    help="Cap on number of articles (0 = all).")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    set_seed(args.seed)

    if not args.jwt:
        print("ERROR: pass --jwt or set GKIN_JWT. Login via /login first.")
        sys.exit(2)

    labels = load_labels(Path(args.labels))
    if not labels:
        print(f"ERROR: {args.labels} has no usable entries. Populate it with "
              f"at least 30 hand-labeled articles before running. See the "
              f"_README block in the file for the schema.")
        sys.exit(2)

    if len(labels) < 30:
        print(f"WARNING: only {len(labels)} labeled articles — the user-facing "
              f"task asked for >=30. Numbers below will be noisy.")

    if args.limit:
        labels = labels[: args.limit]

    print(f"Server:  {args.server}")
    print(f"Labels:  {args.labels}  ({len(labels)} entries)")
    print()

    rows: list[dict] = []
    for i, entry in enumerate(labels, 1):
        aid = entry["article_id"]
        print(f"[{i}/{len(labels)}] {aid} … ", end="", flush=True)

        text = fetch_article_text(entry, args.server, args.jwt, args.timeout)
        if not text or len(text) < 200:
            print("skip (no text >= 200 chars)")
            rows.append({
                "article_id": aid, "url": entry.get("url"),
                "ground_truth_fake": entry.get("ground_truth_fake"),
                "ground_truth_manipulative": entry.get("ground_truth_manipulative"),
                "error": "no_text",
            })
            continue

        t0 = time.time()
        result = analyze_article(text, args.server, args.jwt, args.timeout)
        dt = time.time() - t0

        if not result or result.get("_error"):
            err = (result or {}).get("_error", "unknown")
            print(f"error: {err[:80]}")
            rows.append({
                "article_id": aid, "url": entry.get("url"),
                "ground_truth_fake": entry.get("ground_truth_fake"),
                "ground_truth_manipulative": entry.get("ground_truth_manipulative"),
                "error": err,
            })
            continue

        fake = result.get("fake_detection") or {}
        verdict = fake.get("verdict", "")
        rows.append({
            "article_id": aid,
            "url": entry.get("url"),
            "title": entry.get("title"),
            "ground_truth_fake": entry.get("ground_truth_fake"),
            "ground_truth_manipulative": entry.get("ground_truth_manipulative"),
            "manipulation_index": int(result.get("manipulation_index", 0) or 0),
            "authenticity_rating": result.get("authenticity_rating"),
            "distilbert_prediction": "fake" if (fake.get("ml_score") or 0) >= 50 else "real",
            "distilbert_confidence": fake.get("ml_score"),
            "fake_confidence": fake.get("fake_confidence"),
            "final_verdict": verdict,
            "predicted_fake": verdict_to_fake_bool(verdict),
            "elapsed_seconds": round(dt, 1),
        })
        print(f"{verdict}  (mi={result.get('manipulation_index')}, ml={fake.get('ml_score')}, {dt:.1f}s)")

    # ── Aggregate metrics ────────────────────────────────────────────────────
    scored = [r for r in rows if not r.get("error") and r.get("ground_truth_fake") is not None]
    n_scored = len(scored)

    tp = sum(1 for r in scored if r["predicted_fake"] is True  and r["ground_truth_fake"] is True)
    tn = sum(1 for r in scored if r["predicted_fake"] is False and r["ground_truth_fake"] is False)
    fp = sum(1 for r in scored if r["predicted_fake"] is True  and r["ground_truth_fake"] is False)
    fn = sum(1 for r in scored if r["predicted_fake"] is False and r["ground_truth_fake"] is True)
    uncertain = sum(1 for r in scored if r["predicted_fake"] is None)

    decided = tp + tn + fp + fn
    acc_on_decided = (tp + tn) / decided if decided else None
    acc_overall = (tp + tn) / n_scored if n_scored else None
    fpr = fp / (fp + tn) if (fp + tn) else None
    fnr = fn / (fn + tp) if (fn + tp) else None

    manip_vs_gt = pearson(
        [r["manipulation_index"] for r in scored if r.get("ground_truth_manipulative") is not None],
        [1.0 if r["ground_truth_manipulative"] else 0.0
         for r in scored if r.get("ground_truth_manipulative") is not None],
    )

    summary = {
        "metadata": {
            "run_at": datetime.now(timezone.utc).isoformat(),
            "server": args.server,
            "n_labels": len(labels),
            "n_scored": n_scored,
            "n_uncertain_verdict": uncertain,
            "seed": args.seed,
        },
        "accuracy_overall_includes_uncertain": acc_overall,
        "accuracy_on_decided_only": acc_on_decided,
        "false_positive_rate": fpr,
        "false_negative_rate": fnr,
        "confusion_matrix": {
            "tp": tp, "tn": tn, "fp": fp, "fn": fn,
            "uncertain": uncertain,
        },
        "manipulation_index_vs_truth_pearson": manip_vs_gt,
        "rows": rows,
    }

    out_path = RESULTS_DIR / "manipulation_benchmark.json"
    out_path.write_text(json.dumps(summary, indent=2))

    print()
    print("=" * 70)
    print(f"GKIN full-pipeline manipulation benchmark — {n_scored} scored")
    print("=" * 70)
    if acc_overall is not None:
        print(f"  Accuracy overall (UNCERTAIN counts wrong):  {acc_overall*100:.1f}%")
    if acc_on_decided is not None:
        print(f"  Accuracy on decided verdicts only:          {acc_on_decided*100:.1f}%")
    if fpr is not None:
        print(f"  False positive rate (real flagged fake):    {fpr*100:.1f}%")
    if fnr is not None:
        print(f"  False negative rate (fake missed):          {fnr*100:.1f}%")
    if manip_vs_gt is not None:
        print(f"  Pearson(manipulation_index, gt_manipulative): {manip_vs_gt:+.3f}")
    print(f"  Confusion: tp={tp}  tn={tn}  fp={fp}  fn={fn}  uncertain={uncertain}")
    print(f"\nSaved: {out_path}")


if __name__ == "__main__":
    main()
