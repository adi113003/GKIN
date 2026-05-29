"""
Out-of-distribution dataset loaders for the GKIN benchmark.

Why these datasets:
  - LIAR (default): 12.8K short political fact-checked statements from
    PolitiFact. Genuinely OOD vs WELFake: short statements vs full articles,
    political-claim domain vs news-article domain, no Reuters/Breitbart
    style fingerprint to lean on. CLAUDE.md explicitly calls out LIAR
    as the planned cross-dataset eval.
  - GonzaloA/fake_news: full-length news articles. Looks distribution-
    adjacent to WELFake (same Reuters-vs-clickbait split), so accuracy
    here is the optimistic upper bound rather than a real OOD number.

Both download over plain HTTP with no third-party deps beyond requests/
pandas. Cached to benchmark/_cache/ between runs.

Returns DataFrames with columns: text (str), label (int, 0=real / 1=fake),
                                  word_count (int), source_dataset (str).
"""

from __future__ import annotations

import io
import os
import zipfile
from pathlib import Path
from typing import Optional

import pandas as pd
import requests


CACHE_DIR = Path(__file__).parent / "_cache"
CACHE_DIR.mkdir(exist_ok=True)

LIAR_URL = "https://sites.cs.ucsb.edu/~william/data/liar_dataset.zip"
GONZALO_TEST_URL = (
    "https://huggingface.co/datasets/GonzaloA/fake_news/resolve/main/test.csv"
)

# LIAR 6-way → binary mapping. CLAUDE.md proposes this as the OOD probe;
# the convention below collapses the three less-true buckets into "fake"
# and the three more-true buckets into "real". This is the standard binary
# split used in most LIAR follow-up papers.
LIAR_FAKE_LABELS = {"pants-fire", "false", "barely-true"}
LIAR_REAL_LABELS = {"half-true", "mostly-true", "true"}

LIAR_COLUMNS = [
    "id", "label", "statement", "subject", "speaker", "speaker_job",
    "state", "party", "barely_true_count", "false_count",
    "half_true_count", "mostly_true_count", "pants_on_fire_count", "context",
]


def _download(url: str, dest: Path) -> Path:
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    print(f"  downloading {url}")
    r = requests.get(url, timeout=60, stream=True)
    r.raise_for_status()
    with open(dest, "wb") as f:
        for chunk in r.iter_content(chunk_size=1 << 15):
            f.write(chunk)
    return dest


def load_liar(splits: tuple[str, ...] = ("train", "valid", "test")) -> pd.DataFrame:
    zip_path = _download(LIAR_URL, CACHE_DIR / "liar_dataset.zip")
    frames = []
    with zipfile.ZipFile(zip_path) as zf:
        for split in splits:
            with zf.open(f"{split}.tsv") as fh:
                df = pd.read_csv(fh, sep="\t", header=None, names=LIAR_COLUMNS)
                df["split"] = split
                frames.append(df)
    raw = pd.concat(frames, ignore_index=True)
    raw["label_text"] = raw["label"].astype(str).str.strip().str.lower()

    def to_binary(lbl: str) -> Optional[int]:
        if lbl in LIAR_FAKE_LABELS:
            return 1
        if lbl in LIAR_REAL_LABELS:
            return 0
        return None

    raw["label"] = raw["label_text"].map(to_binary)
    raw = raw.dropna(subset=["label", "statement"]).copy()
    raw["label"] = raw["label"].astype(int)
    raw["text"] = raw["statement"].astype(str)
    raw["word_count"] = raw["text"].str.split().apply(len)
    raw["source_dataset"] = "liar"
    return raw[["text", "label", "label_text", "word_count", "source_dataset", "split"]]


def load_gonzalo() -> pd.DataFrame:
    csv_path = _download(GONZALO_TEST_URL, CACHE_DIR / "gonzalo_fake_news_test.csv")
    df = pd.read_csv(csv_path, sep=";")
    # GonzaloA convention is INVERTED relative to WELFake/GKIN:
    #   raw label=0 → fake (Breitbart-style clickbait)
    #   raw label=1 → real (Reuters wire copy)
    # Flip so we share GKIN's convention (0=real, 1=fake) throughout the
    # benchmark.
    df["label"] = 1 - df["label"].astype(int)
    df["text"] = (df["title"].fillna("") + ". " + df["text"].fillna("")).str.strip(". ")
    df = df[df["text"].str.len() > 50].copy()
    df["word_count"] = df["text"].str.split().apply(len)
    df["source_dataset"] = "gonzalo_fake_news"
    df["label_text"] = df["label"].map({0: "real", 1: "fake"})
    df["split"] = "test"
    return df[["text", "label", "label_text", "word_count", "source_dataset", "split"]]


def load_ood_dataset(
    name: str = "liar",
    n_per_class: int = 500,
    seed: int = 42,
) -> pd.DataFrame:
    """Return a stratified sample with `n_per_class` real + `n_per_class` fake rows.

    Raises if there aren't enough samples to fill the request.
    """
    if name == "liar":
        df = load_liar()
    elif name == "gonzalo":
        df = load_gonzalo()
    else:
        raise ValueError(f"Unknown dataset: {name}. Use 'liar' or 'gonzalo'.")

    counts = df["label"].value_counts().to_dict()
    real_n = counts.get(0, 0)
    fake_n = counts.get(1, 0)
    if real_n < n_per_class or fake_n < n_per_class:
        raise ValueError(
            f"Not enough samples in {name}: real={real_n}, fake={fake_n}, "
            f"requested {n_per_class} per class. Pass a smaller --n-per-class."
        )

    real = df[df["label"] == 0].sample(n=n_per_class, random_state=seed)
    fake = df[df["label"] == 1].sample(n=n_per_class, random_state=seed)
    out = pd.concat([real, fake], ignore_index=True)
    out = out.sample(frac=1.0, random_state=seed).reset_index(drop=True)
    return out


if __name__ == "__main__":
    # Smoke test
    sample = load_ood_dataset("liar", n_per_class=10)
    print(sample[["label", "label_text", "word_count", "text"]].head(20))
    print("\nLabel counts:", sample["label"].value_counts().to_dict())
