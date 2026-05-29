"""
GKIN out-of-distribution (OOD) benchmark.

What this answers (the judges' question):
  "How accurately does GKIN classify articles that DON'T look like its
   training data?"

Approach:
  1. Load the GKIN ML classifier (DistilBERT if available locally, else
     the joblib baseline that server.py actually serves).
  2. Load 500 real + 500 fake from a dataset GKIN was NEVER trained on
     (default: LIAR — short political fact-checks; alt: GonzaloA).
  3. Predict, compute metrics, compare against random + majority-class
     baselines, bucket accuracy by text length.
  4. Write benchmark/results/ood_benchmark.{json,csv}.

Run:
    python benchmark/run_benchmark.py
    python benchmark/run_benchmark.py --dataset liar --n-per-class 500
    python benchmark/run_benchmark.py --dataset gonzalo --n-per-class 500
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

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from benchmark.data_loader import load_ood_dataset  # noqa: E402
from benchmark.model_loader import GKINClassifier  # noqa: E402


RESULTS_DIR = Path(__file__).parent / "results"
RESULTS_DIR.mkdir(exist_ok=True)

LENGTH_BUCKETS = [
    ("<100",     lambda n: n < 100),
    ("100-300",  lambda n: 100 <= n < 300),
    ("300-500",  lambda n: 300 <= n < 500),
    ("500+",     lambda n: n >= 500),
]


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    os.environ["PYTHONHASHSEED"] = str(seed)


def precision_recall_f1(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    # Manual binary metrics so we don't add sklearn as a hard dep on the
    # path that imports this module — but sklearn is already pinned by
    # the joblib baseline, so we just use it.
    from sklearn.metrics import (
        accuracy_score,
        precision_recall_fscore_support,
        confusion_matrix,
    )

    acc = float(accuracy_score(y_true, y_pred))
    p_macro, r_macro, f1_macro, _ = precision_recall_fscore_support(
        y_true, y_pred, average="macro", zero_division=0
    )
    p_per, r_per, f1_per, _ = precision_recall_fscore_support(
        y_true, y_pred, labels=[0, 1], zero_division=0
    )
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    return {
        "accuracy": acc,
        "precision_macro": float(p_macro),
        "recall_macro": float(r_macro),
        "f1_macro": float(f1_macro),
        "per_class": {
            "real": {"precision": float(p_per[0]), "recall": float(r_per[0]), "f1": float(f1_per[0])},
            "fake": {"precision": float(p_per[1]), "recall": float(r_per[1]), "f1": float(f1_per[1])},
        },
        # confusion_matrix layout: rows=actual, cols=predicted, indexed by [0, 1].
        "confusion_matrix": {
            "actual_real_pred_real": int(cm[0, 0]),
            "actual_real_pred_fake": int(cm[0, 1]),
            "actual_fake_pred_real": int(cm[1, 0]),
            "actual_fake_pred_fake": int(cm[1, 1]),
        },
    }


def baseline_random(y_true: np.ndarray, seed: int) -> dict:
    rng = np.random.default_rng(seed)
    y_pred = rng.integers(0, 2, size=len(y_true))
    return precision_recall_f1(y_true, y_pred)


def baseline_majority(y_true: np.ndarray) -> dict:
    majority = int(round(y_true.mean()))  # 1 if more fakes, else 0
    y_pred = np.full_like(y_true, majority)
    out = precision_recall_f1(y_true, y_pred)
    out["majority_class"] = "fake" if majority == 1 else "real"
    return out


def accuracy_by_length(df: pd.DataFrame, y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    out = {}
    for name, predicate in LENGTH_BUCKETS:
        mask = df["word_count"].map(predicate).to_numpy()
        n = int(mask.sum())
        if n == 0:
            out[name] = {"n": 0, "accuracy": None}
            continue
        acc = float((y_true[mask] == y_pred[mask]).mean())
        out[name] = {"n": n, "accuracy": acc}
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", choices=["liar", "gonzalo"], default="liar",
                    help="OOD dataset to evaluate on. Default: liar.")
    ap.add_argument("--n-per-class", type=int, default=500,
                    help="Samples per class. Default: 500 (1000 total).")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--batch-size", type=int, default=32,
                    help="Batch size for DistilBERT inference. Ignored for joblib.")
    ap.add_argument(
        "--model-prefer",
        choices=[
            "auto", "joblib",
            "distilbert", "distilbert_combined", "distilbert_welfake",
            "distilbert_fakenewsnet_weighted", "distilbert_fakenewsnet",
        ],
        default="auto",
        help="Which checkpoint to load. 'auto' = combined > welfake > fakenewsnet_weighted > fakenewsnet > joblib.",
    )
    args = ap.parse_args()

    set_seed(args.seed)

    print(f"[1/4] Loading GKIN classifier (prefer={args.model_prefer})…")
    clf = GKINClassifier(prefer=args.model_prefer)
    print(f"      kind: {clf.kind}")
    print(f"      label: {clf.label}")

    print(f"[2/4] Loading OOD dataset: {args.dataset} ({args.n_per_class}/class)…")
    df = load_ood_dataset(args.dataset, n_per_class=args.n_per_class, seed=args.seed)
    y_true = df["label"].to_numpy()
    print(f"      loaded {len(df)} rows. real={int((y_true==0).sum())}, fake={int((y_true==1).sum())}")
    print(f"      word_count: min={int(df['word_count'].min())}, "
          f"median={int(df['word_count'].median())}, max={int(df['word_count'].max())}")

    print("[3/4] Running predictions…")
    t0 = time.time()
    proba = clf.predict_proba(df["text"].tolist(), batch_size=args.batch_size)
    y_pred = (proba[:, 1] >= 0.5).astype(int)
    confidence = proba.max(axis=1)
    elapsed = time.time() - t0
    print(f"      done in {elapsed:.1f}s ({len(df)/max(elapsed,1e-3):.1f} examples/s)")

    print("[4/4] Computing metrics…")
    metrics = precision_recall_f1(y_true, y_pred)
    random_metrics = baseline_random(y_true, seed=args.seed)
    majority_metrics = baseline_majority(y_true)
    length_acc = accuracy_by_length(df, y_true, y_pred)

    per_row = pd.DataFrame({
        "text_preview": df["text"].str.slice(0, 120),
        "ground_truth": df["label_text"].fillna(df["label"].map({0: "real", 1: "fake"})),
        "distilbert_prediction": pd.Series(y_pred).map({0: "real", 1: "fake"}),
        "distilbert_confidence": confidence.round(4),
        "prob_real": proba[:, 0].round(4),
        "prob_fake": proba[:, 1].round(4),
        "text_length": df["word_count"],
        "source_dataset": df["source_dataset"],
        "correct": (y_pred == y_true).astype(int),
    })

    result = {
        "metadata": {
            "run_at": datetime.now(timezone.utc).isoformat(),
            "dataset": args.dataset,
            "n_per_class": args.n_per_class,
            "n_total": int(len(df)),
            "seed": args.seed,
            "model_kind": clf.kind,
            "model_label": clf.label,
            "inference_seconds": round(elapsed, 2),
        },
        "gkin": metrics,
        "baseline_random": random_metrics,
        "baseline_majority": majority_metrics,
        "accuracy_by_length": length_acc,
        "delta_vs_random": round(metrics["accuracy"] - random_metrics["accuracy"], 4),
        "delta_vs_majority": round(metrics["accuracy"] - majority_metrics["accuracy"], 4),
    }

    # Write a generic "latest" copy plus a dataset-tagged copy, so successive
    # runs against different datasets don't clobber each other and the report
    # generator can pick up both.
    json_path = RESULTS_DIR / "ood_benchmark.json"
    csv_path = RESULTS_DIR / "ood_benchmark.csv"
    json_tagged = RESULTS_DIR / f"ood_benchmark_{args.dataset}.json"
    csv_tagged = RESULTS_DIR / f"ood_benchmark_{args.dataset}.csv"
    payload = json.dumps(result, indent=2)
    json_path.write_text(payload)
    json_tagged.write_text(payload)
    per_row.to_csv(csv_path, index=False)
    per_row.to_csv(csv_tagged, index=False)

    print()
    print("=" * 70)
    print(f"GKIN ({clf.kind}) on OOD dataset: {args.dataset}")
    print("=" * 70)
    print(f"  Accuracy:        {metrics['accuracy']*100:.2f}%")
    print(f"  F1 (macro):      {metrics['f1_macro']*100:.2f}%")
    print(f"  Precision (m):   {metrics['precision_macro']*100:.2f}%")
    print(f"  Recall (m):      {metrics['recall_macro']*100:.2f}%")
    print()
    print(f"  vs Random:       {random_metrics['accuracy']*100:.2f}%  "
          f"(Δ {result['delta_vs_random']*100:+.2f}pp)")
    print(f"  vs Majority:     {majority_metrics['accuracy']*100:.2f}%  "
          f"(Δ {result['delta_vs_majority']*100:+.2f}pp)")
    print()
    cm = metrics["confusion_matrix"]
    print("  Confusion matrix:")
    print(f"                  pred_real   pred_fake")
    print(f"    actual_real    {cm['actual_real_pred_real']:>6d}     {cm['actual_real_pred_fake']:>6d}")
    print(f"    actual_fake    {cm['actual_fake_pred_real']:>6d}     {cm['actual_fake_pred_fake']:>6d}")
    print()
    print("  Accuracy by text length:")
    for bucket, info in length_acc.items():
        if info["accuracy"] is None:
            print(f"    {bucket:<10s}  n={info['n']:>4d}  (no samples)")
        else:
            print(f"    {bucket:<10s}  n={info['n']:>4d}  acc={info['accuracy']*100:.2f}%")

    print()
    print(f"Saved: {json_path}")
    print(f"Saved: {csv_path}")


if __name__ == "__main__":
    main()
