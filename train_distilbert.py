"""
Fine-tune DistilBERT on WELFake for fake-vs-real classification.

Why this exists:
  The TF-IDF + LogReg baseline scores 97% but leans heavily on source tells
  ("reuters", "breitbart", "getty images", "featured image"). This script
  strips those source fingerprints before training, then fine-tunes
  DistilBERT so the model has to rely on language patterns rather than
  publisher vocabulary. Expect honest accuracy ~80–90%.

Setup (run once on the GPU box):
    pip install "transformers>=4.40" "torch>=2.2" "datasets>=2.18" \\
                scikit-learn pandas accelerate

Run:
    python train_distilbert.py \\
        --csv WELFake_Dataset.csv \\
        --out distilbert_welfake \\
        --model distilbert-base-uncased \\
        --epochs 3 --batch-size 32 --max-len 256

Swap to RoBERTa with: --model roberta-base
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from datasets import Dataset
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
)
from sklearn.model_selection import train_test_split
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    DataCollatorWithPadding,
    Trainer,
    TrainingArguments,
)

# ── Source-fingerprint scrubbing ──────────────────────────────────────────────
# These patterns are the leakage in WELFake. Strip them so the model has to
# learn from the actual writing rather than from "is this Reuters or not?".
SOURCE_PATTERNS = [
    r"\b(reuters|breitbart|bloomberg|associated press|\bap\b|afp|cnn|fox news|"
    r"new york times|nyt|washington post|wapo|the guardian|huffpost|"
    r"infowars|the onion|daily caller|daily wire|buzzfeed|vox|politico|axios|"
    r"the hill|npr|bbc|al jazeera|rt\.com|sputnik|getty|getty images)\b",
    r"\([A-Z]{2,}\)\s*[-—–]",                           # "(REUTERS) -" datelines
    r"\b[A-Z][A-Z]+,?\s+[A-Z][a-z]+\.?\s*\d*\s*\(reuters\)",  # "WASHINGTON (Reuters)"
    r"\bfeatured image\b.*?(?=\.|$)",                  # "Featured image via ..."
    r"\bphoto[s]?\s+(by|via|credit|courtesy)[^\.]*",   # photo credits
    r"\bimage[s]?\s+(by|via|credit|courtesy)[^\.]*",
    r"\bvia\s+[A-Z][A-Za-z]+(\s+[A-Z][A-Za-z]+){0,2}", # "via Some Outlet"
    r"https?://\S+",                                    # URLs
    r"www\.\S+",
    r"@[A-Za-z0-9_]{2,}",                               # twitter handles
    r"#[A-Za-z0-9_]{2,}",                               # hashtags
    r"\b\d{4}\b",                                       # years (2016/2017 are leaky)
]
SOURCE_RE = re.compile("|".join(SOURCE_PATTERNS), flags=re.IGNORECASE)
WHITESPACE_RE = re.compile(r"\s+")


def clean_text(s: str) -> str:
    if not isinstance(s, str):
        return ""
    s = SOURCE_RE.sub(" ", s)
    s = WHITESPACE_RE.sub(" ", s).strip()
    return s


# ── Data loading ──────────────────────────────────────────────────────────────
def load_welfake(csv_path: Path) -> pd.DataFrame:
    df = pd.read_csv(csv_path)
    df = df.dropna(subset=["text", "label"]).copy()
    df["title"] = df["title"].fillna("")
    df["combined"] = (df["title"] + " " + df["text"]).map(clean_text)
    df = df[df["combined"].str.len() > 50].reset_index(drop=True)
    df["label"] = df["label"].astype(int)
    return df[["combined", "label"]]


# ── Metrics ───────────────────────────────────────────────────────────────────
def compute_metrics(eval_pred):
    logits, labels = eval_pred
    preds = np.argmax(logits, axis=-1)
    return {
        "accuracy": accuracy_score(labels, preds),
        "f1_macro": f1_score(labels, preds, average="macro"),
    }


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", default="WELFake_Dataset.csv")
    ap.add_argument("--out", default="distilbert_welfake")
    ap.add_argument("--model", default="distilbert-base-uncased",
                    help="HF model id, e.g. distilbert-base-uncased or roberta-base")
    ap.add_argument("--epochs", type=int, default=3)
    ap.add_argument("--batch-size", type=int, default=32)
    ap.add_argument("--max-len", type=int, default=256)
    ap.add_argument("--lr", type=float, default=2e-5)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    csv_path = Path(args.csv)
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"Loading {csv_path} ...")
    df = load_welfake(csv_path)
    print(f"Rows after cleaning: {len(df):,}")
    print(df["label"].value_counts().rename({0: "real", 1: "fake"}))

    train_df, test_df = train_test_split(
        df, test_size=0.2, stratify=df["label"], random_state=args.seed
    )
    print(f"Train: {len(train_df):,}   Test: {len(test_df):,}")

    print(f"Loading tokenizer & model: {args.model}")
    tokenizer = AutoTokenizer.from_pretrained(args.model)
    model = AutoModelForSequenceClassification.from_pretrained(
        args.model,
        num_labels=2,
        id2label={0: "real", 1: "fake"},
        label2id={"real": 0, "fake": 1},
    )

    def tokenize(batch):
        return tokenizer(
            batch["combined"],
            truncation=True,
            max_length=args.max_len,
        )

    train_ds = Dataset.from_pandas(train_df, preserve_index=False).map(
        tokenize, batched=True, remove_columns=["combined"]
    )
    test_ds = Dataset.from_pandas(test_df, preserve_index=False).map(
        tokenize, batched=True, remove_columns=["combined"]
    )

    training_args = TrainingArguments(
        output_dir=str(out_dir / "checkpoints"),
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size * 2,
        learning_rate=args.lr,
        weight_decay=0.01,
        warmup_ratio=0.1,
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="f1_macro",
        greater_is_better=True,
        logging_steps=100,
        fp16=torch.cuda.is_available(),
        report_to="none",
        seed=args.seed,
        save_total_limit=2,
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_ds,
        eval_dataset=test_ds,
        processing_class=tokenizer,
        data_collator=DataCollatorWithPadding(tokenizer),
        compute_metrics=compute_metrics,
    )

    print("Training ...")
    trainer.train()

    print("\nFinal evaluation:")
    eval_out = trainer.evaluate()
    for k, v in eval_out.items():
        print(f"  {k}: {v:.4f}" if isinstance(v, float) else f"  {k}: {v}")

    preds = trainer.predict(test_ds)
    y_pred = np.argmax(preds.predictions, axis=-1)
    y_true = preds.label_ids

    print("\nClassification report:")
    print(classification_report(y_true, y_pred, target_names=["real", "fake"], digits=4))
    print("Confusion matrix (rows=actual, cols=predicted):")
    print(pd.DataFrame(
        confusion_matrix(y_true, y_pred),
        index=["actual_real", "actual_fake"],
        columns=["pred_real", "pred_fake"],
    ))

    final_dir = out_dir / "final"
    trainer.save_model(str(final_dir))
    tokenizer.save_pretrained(str(final_dir))
    print(f"\nSaved fine-tuned model to: {final_dir}")
    print("Load later with:")
    print(f"  AutoModelForSequenceClassification.from_pretrained('{final_dir}')")
    print(f"  AutoTokenizer.from_pretrained('{final_dir}')")


if __name__ == "__main__":
    main()
