"""
Unified wrapper around whichever GKIN classifier is available on this machine.

The server (server.py:586) loads `baseline_model.joblib` into `_fake_model`
at startup and treats its P(fake) as the "ML score" half of the fake-detection
pipeline. Several DistilBERT checkpoints from the training notebooks may also
be present on the GPU box:

    distilbert_combined/final/             # FN + WELFake jointly — best OOD
    distilbert_welfake/final/              # WELFake only          — 99.4% in-domain, ~chance on FN
    distilbert_fakenewsnet_weighted/final/ # FN with class weights — better fake-recall
    distilbert_fakenewsnet/final/          # FN baseline           — fake-recall asymmetry

Default priority is combined > welfake > fakenewsnet_weighted > fakenewsnet
> joblib. Per the train_distilbert_fakenewsnet.ipynb cross-dataset table:
the combined model is the only one that holds macro F1 >= 0.78 on both the
FakeNewsNet slice (0.787) and the WELFake slice (0.949), so it is the right
default when present.

Exposes `GKINClassifier.predict_proba(texts)` returning an (N, 2) array of
[P(real), P(fake)] probabilities, plus `kind`/`label` strings so the report
can be honest about which model produced the numbers.
"""

from __future__ import annotations

from pathlib import Path
from typing import Iterable

import numpy as np


# Preferred load order. Each entry is (kind tag, path, human label).
# The combined model wins ties because it's the only one with non-collapsed
# numbers on both datasets in the notebook's cross-dataset table.
DISTILBERT_CANDIDATES: list[tuple[str, str, str]] = [
    ("distilbert_combined",
     "distilbert_combined/final",
     "DistilBERT (FakeNewsNet + WELFake titles, combined training)"),
    ("distilbert_welfake",
     "distilbert_welfake/final",
     "DistilBERT (WELFake only — 99.4% in-domain, collapses on OOD)"),
    ("distilbert_fakenewsnet_weighted",
     "distilbert_fakenewsnet_weighted/final",
     "DistilBERT (FakeNewsNet titles, class-weighted)"),
    ("distilbert_fakenewsnet",
     "distilbert_fakenewsnet/final",
     "DistilBERT (FakeNewsNet titles, unweighted)"),
]


class GKINClassifier:
    JOBLIB_PATH = "baseline_model.joblib"

    def __init__(
        self,
        distilbert_dir: str | None = None,
        joblib_path: str | None = None,
        prefer: str = "auto",
    ):
        """`prefer` accepts: 'auto', 'joblib', or any of the kind tags above
        ('distilbert_combined', 'distilbert_welfake',
         'distilbert_fakenewsnet_weighted', 'distilbert_fakenewsnet').
        The legacy alias 'distilbert' resolves to whichever DistilBERT
        checkpoint is present, in the default priority order.
        """
        self.joblib_path = Path(joblib_path or self.JOBLIB_PATH)
        self.kind: str = ""
        self.label = ""
        self._model = None
        self._tokenizer = None
        self._device = "cpu"

        # Build the candidate list in priority order based on `prefer`.
        if distilbert_dir:
            # Caller-supplied explicit directory wins regardless of `prefer`.
            candidates = [("distilbert_custom", distilbert_dir,
                           f"DistilBERT (custom checkpoint at {distilbert_dir})")]
            candidates += [c for c in DISTILBERT_CANDIDATES]
        else:
            candidates = list(DISTILBERT_CANDIDATES)

        if prefer == "joblib":
            order = [("joblib", str(self.joblib_path), "")] + candidates
        elif prefer in {"auto", "distilbert"}:
            order = candidates + [("joblib", str(self.joblib_path), "")]
        else:
            # Pin a specific kind tag to the front.
            head = [c for c in candidates if c[0] == prefer]
            tail = [c for c in candidates if c[0] != prefer]
            if not head:
                raise ValueError(
                    f"Unknown `prefer` value: {prefer!r}. "
                    f"Use 'auto', 'joblib', or one of: "
                    f"{[c[0] for c in DISTILBERT_CANDIDATES]}."
                )
            order = head + tail + [("joblib", str(self.joblib_path), "")]

        last_err: Exception | None = None
        attempted: list[str] = []
        for kind, path, label in order:
            p = Path(path)
            attempted.append(str(p))
            if not p.exists():
                continue
            try:
                if kind == "joblib":
                    self._load_joblib()
                else:
                    self._load_distilbert(p, kind, label)
                return
            except Exception as exc:
                last_err = exc

        raise FileNotFoundError(
            f"No GKIN classifier available. Looked for: {attempted}. "
            f"Last error: {last_err}"
        )

    def _load_distilbert(self, path: Path, kind: str, label: str):
        from transformers import AutoModelForSequenceClassification, AutoTokenizer
        import torch

        self._tokenizer = AutoTokenizer.from_pretrained(str(path))
        self._model = AutoModelForSequenceClassification.from_pretrained(str(path))
        self._model.eval()
        self._device = "cuda" if torch.cuda.is_available() else "cpu"
        self._model.to(self._device)
        self.kind = kind
        self.label = f"{label}; device={self._device}"

    def _load_joblib(self):
        import joblib

        self._model = joblib.load(str(self.joblib_path))
        self.kind = "joblib_baseline"
        self.label = "TF-IDF + LogisticRegression baseline (the model server.py actually serves)"

    def predict_proba(self, texts: Iterable[str], batch_size: int = 32) -> np.ndarray:
        texts = [t if isinstance(t, str) else "" for t in texts]
        if self.kind == "joblib_baseline":
            return np.asarray(self._model.predict_proba(texts))
        return self._predict_distilbert(texts, batch_size=batch_size)

    def _predict_distilbert(self, texts: list[str], batch_size: int) -> np.ndarray:
        import torch

        out = np.zeros((len(texts), 2), dtype=np.float32)
        with torch.no_grad():
            for i in range(0, len(texts), batch_size):
                batch = texts[i : i + batch_size]
                enc = self._tokenizer(
                    batch,
                    padding=True,
                    truncation=True,
                    max_length=256,
                    return_tensors="pt",
                ).to(self._device)
                logits = self._model(**enc).logits
                probs = torch.softmax(logits, dim=-1).cpu().numpy()
                # id2label was set during training: {0: real, 1: fake}.
                out[i : i + len(batch)] = probs
        return out

    def predict(self, texts: Iterable[str]) -> np.ndarray:
        proba = self.predict_proba(texts)
        return (proba[:, 1] >= 0.5).astype(int)
