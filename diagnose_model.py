"""
Shortcut-learning diagnostics for the fine-tuned DistilBERT WELFake model.

Loads the saved model from distilbert_welfake/final/ and runs three ablations
on the test set to expose whether the model is reading or just fingerprinting
publisher style:

  1. original (control)  — should match training-time eval accuracy
  2. shuffled words      — same vocabulary, no syntax. Real reasoning collapses.
  3. first N words only  — strip the body, keep the lede. Style stays in the lede.

Run:
    python diagnose_model.py
    python diagnose_model.py --model-dir distilbert_welfake/final --csv WELFake_Dataset.csv

Reads:
  - distilbert_welfake/final/   (fine-tuned model + tokenizer)
  - WELFake_Dataset.csv         (to rebuild the same test split)

Prints one table — paste it back to me when done.
"""

from __future__ import annotations

import argparse
import random
import re
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from datasets import Dataset
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import train_test_split
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    DataCollatorWithPadding,
    Trainer,
    TrainingArguments,
)

# Must match the cleaning used during training, otherwise the test split
# contents won't match what the model saw.
SOURCE_PATTERNS = [
    r"\b(reuters|breitbart|bloomberg|associated press|\bap\b|afp|cnn|fox news|"
    r"new york times|nyt|washington post|wapo|the guardian|huffpost|"
    r"infowars|the onion|daily caller|daily wire|buzzfeed|vox|politico|axios|"
    r"the hill|npr|bbc|al jazeera|rt\.com|sputnik|getty|getty images)\b",
    r"\([A-Z]{2,}\)\s*[-—–]",
    r"\b[A-Z][A-Z]+,?\s+[A-Z][a-z]+\.?\s*\d*\s*\(reuters\)",
    r"\bfeatured image\b.*?(?=\.|$)",
    r"\bphoto[s]?\s+(by|via|credit|courtesy)[^\.]*",
    r"\bimage[s]?\s+(by|via|credit|courtesy)[^\.]*",
    r"\bvia\s+[A-Z][A-Za-z]+(\s+[A-Z][A-Za-z]+){0,2}",
    r"https?://\S+",
    r"www\.\S+",
    r"@[A-Za-z0-9_]{2,}",
    r"#[A-Za-z0-9_]{2,}",
    r"\b\d{4}\b",
]
SOURCE_RE = re.compile("|".join(SOURCE_PATTERNS), flags=re.IGNORECASE)
WHITESPACE_RE = re.compile(r"\s+")


def clean_text(s):
    if not isinstance(s, str):
        return ""
    s = SOURCE_RE.sub(" ", s)
    s = WHITESPACE_RE.sub(" ", s).strip()
    return s


def shuffle_words(s, rng):
    words = s.split()
    rng.shuffle(words)
    return " ".join(words)


def first_n_words(s, n):
    return " ".join(s.split()[:n])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model-dir", default="distilbert_welfake/final")
    ap.add_argument("--csv", default="WELFake_Dataset.csv")
    ap.add_argument("--max-len", type=int, default=256)
    ap.add_argument("--batch-size", type=int, default=64)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    print(f"Loading model from {args.model_dir}")
    tokenizer = AutoTokenizer.from_pretrained(args.model_dir)
    model = AutoModelForSequenceClassification.from_pretrained(args.model_dir)

    print(f"Rebuilding test split from {args.csv}")
    df = pd.read_csv(args.csv).dropna(subset=["text", "label"]).copy()
    df["title"] = df["title"].fillna("")
    df["combined"] = (df["title"] + " " + df["text"]).map(clean_text)
    df = df[df["combined"].str.len() > 50].reset_index(drop=True)
    df["label"] = df["label"].astype(int)
    _, test_df = train_test_split(
        df[["combined", "label"]],
        test_size=0.2,
        stratify=df["label"],
        random_state=args.seed,
    )
    print(f"Test set: {len(test_df):,} rows")

    def tokenize(batch):
        return tokenizer(batch["combined"], truncation=True, max_length=args.max_len)

    trainer = Trainer(
        model=model,
        args=TrainingArguments(
            output_dir="_diag_tmp",
            per_device_eval_batch_size=args.batch_size,
            report_to="none",
            fp16=torch.cuda.is_available(),
        ),
        processing_class=tokenizer,
        data_collator=DataCollatorWithPadding(tokenizer),
    )

    rng = random.Random(args.seed)
    variants = {
        "original (control)":   test_df["combined"],
        "shuffled words":       test_df["combined"].map(lambda s: shuffle_words(s, rng)),
        "first 5 words only":   test_df["combined"].map(lambda s: first_n_words(s, 5)),
        "first 10 words only":  test_df["combined"].map(lambda s: first_n_words(s, 10)),
        "first 25 words only":  test_df["combined"].map(lambda s: first_n_words(s, 25)),
    }

    rows = []
    for name, texts in variants.items():
        sub = pd.DataFrame({"combined": texts.values, "label": test_df["label"].values})
        ds = Dataset.from_pandas(sub, preserve_index=False).map(
            tokenize, batched=True, remove_columns=["combined"]
        )
        p = trainer.predict(ds)
        yp = np.argmax(p.predictions, axis=-1)
        yt = p.label_ids
        rows.append({
            "variant": name,
            "accuracy": round(accuracy_score(yt, yp), 4),
            "f1_macro": round(f1_score(yt, yp, average="macro"), 4),
        })
        print(f"  {name:<22s}  acc={rows[-1]['accuracy']:.4f}  f1={rows[-1]['f1_macro']:.4f}")

    print()
    print(pd.DataFrame(rows).set_index("variant"))

    ctrl = next(r["accuracy"] for r in rows if r["variant"] == "original (control)")
    shuf = next(r["accuracy"] for r in rows if r["variant"] == "shuffled words")
    drop = ctrl - shuf
    print(f"\nShuffle drop: {drop:.4f}  (control {ctrl:.4f} -> shuffled {shuf:.4f})")
    if shuf > 0.85:
        print("WARNING: Shuffled accuracy is still very high - the model is shortcut-learning, not reading.")
    elif shuf > 0.65:
        print("PARTIAL: Some style leakage, but the model is doing partial reading.")
    else:
        print("OK: Shuffled accuracy near chance - the model is using actual sentence structure.")


if __name__ == "__main__":
    main()
