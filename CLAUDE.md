# GKIN — Project Notes for Claude

Media-literacy analysis tool. Two parallel detection systems run side-by-side: an LLM analysis pipeline (Groq-hosted Llama / DeepSeek / Whisper) for claim-level reasoning, and a classical ML binary classifier trained on WELFake for fake-vs-real labeling.

## Layout

| File | Purpose |
|---|---|
| `server.py` | FastAPI backend. Routes for analysis, claim verification, chat, comparison, suggestions, vision/audio, auth. |
| `static/index.html` | Frontend (single-page). |
| `chrome-extension/` | Browser extension. |
| `analyze_groq (1).py`, `analyze_gemini (1).py`, `analyze_gemini1 (2).py` | Bulk analysis scripts that fill in `groq_*` columns on the labeling spreadsheet. |
| `discover_articles (2).py`, `fetch_articles (2).py` | Article ingestion. |
| `WELFake_Dataset.csv` | 72,073-row real/fake training set. |
| `baseline_model.joblib` | TF-IDF + Logistic Regression baseline (97.05% acc, but see leakage notes). |
| `baseline_results.txt` | Baseline metrics + top features. |
| `train_distilbert.py` / `train_distilbert.ipynb` | DistilBERT fine-tuning with source-fingerprint scrubbing. |
| `diagnose_model.py` | Shortcut-learning diagnostics (shuffle test + first-N-words ablation). |
| `users.json` | Local auth store. |
| `groq_results.json` | Cached LLM analysis results, keyed by article id. |

## LLM model IDs (in `server.py`)

```
MODEL_REASON  = "openai/gpt-oss-120b"             # chain-of-thought reasoning (plain only; not JSON-safe)
MODEL_STRUCT  = "llama-3.3-70b-versatile"          # JSON structuring & chat
MODEL_FAST    = "llama-3.1-8b-instant"             # claim verification, suggestions
MODEL_VISION  = "llama-3.2-90b-vision-preview"     # screenshot / image analysis
MODEL_WHISPER = "whisper-large-v3"                 # audio transcription
```

All hosted on Groq. Requires `GROQ_API_KEY` env var.

## WELFake — important context (not obvious from code)

The dataset has structural leakage that affects every model trained on it:

- "Real" class is dominated by Reuters wire copy.
- "Fake" class is dominated by a small number of partisan/clickbait blogs.
- Random train/test split puts the **same publishers in both halves** — any model can hit ~97%+ by doing publisher-style attribution rather than truth detection.
- The TF-IDF baseline's strongest "real" feature is literally the word `reuters` (coefficient −40); strongest "fake" features are `video`, `featured image`, `getty`, `breaking`.

Source-fingerprint scrubbing (in `train_distilbert.py` and `diagnose_model.py`) strips publisher names, datelines like `(REUTERS) -`, photo credits, URLs, twitter handles, hashtags, and 4-digit years. This reduces the surface leakage but does not eliminate stylistic leakage (sentence structure, attribution phrasing, punctuation rhythm).

## DistilBERT result + diagnostics

After source-stripping, DistilBERT-base hits 99.4% accuracy on the held-out test set. Diagnostic ablations on the saved model:

| Variant | Acc |
|---|---|
| Original (control) | 0.9937 |
| Shuffled words | 0.5623 |
| First 5 words only | 0.6233 |
| First 10 words only | 0.7592 |
| First 25 words only | 0.9408 |

Interpretation: the shuffle drop (0.99 → 0.56, near chance) confirms the model is using word order/syntax rather than pure keyword fingerprints. But the first-25-words score (0.94) shows publisher style in the lede contributes a large share of accuracy. The model is genuinely **reading**, but the *task* it learned is "wire-service style vs amateur-blog style," which correlates with truth in WELFake but won't generalize to professional-style disinformation (RT, Sputnik, AI-generated).

For reports/papers, defensible framing: *"99.4% on WELFake; shuffle ablation drops to 56.2%, confirming syntactic learning. Lede-only accuracy of 94% indicates publisher style still contributes meaningfully."* Not: *"the model detects fake news."*

## Hardware / training notes

- Training is run on a remote GPU box (`/home/avaithinathanaso/CS343_NeuralAI/`), not locally on the Mac. The Mac has the source files; the GPU box has the trained model + datasets.
- GPU has 96GB VRAM, so DistilBERT-base under-uses the hardware. Bumping to `roberta-large` or `microsoft/deberta-v3-large` with `--max-len 512 --batch-size 64` is feasible.
- Pylance import warnings on the Mac for torch/transformers/datasets are expected — those packages are only installed on the GPU box.

## Common gotchas

- **`transformers >= 4.46`**: `Trainer(...)` requires `processing_class=tokenizer`, not `tokenizer=tokenizer` (renamed).
- **`NotebookProgressCallback` bug**: standalone `trainer.evaluate()` after `trainer.train()` crashes with `on_train_begin must be called before on_evaluate`. Workaround: `trainer.remove_callback(NotebookProgressCallback)` then use `trainer.predict()` (its `.metrics` has the same numbers).
- **`load_best_model_at_end=True`** with epoch-based eval/save can also trip the same callback ordering bug in some 4.46+ builds.
- **Running diagnostics**: `diagnose_model.py` is fully self-contained — does not require the training kernel to be live, reloads the model from `distilbert_welfake/final/`.

## Potential next experiments

- Cross-dataset eval: train on WELFake, test on LIAR or FakeNewsNet — accuracy will crash, exposing publisher-style overfitting.
- Run the saved model on recent RT/Sputnik articles to demonstrate failure on professional-style disinformation.
- Strip the first 25 words at training time and re-train — if accuracy stays ~99%, body has enough signal independent of the lede.
- Cluster articles by writing-style embeddings, hold out clusters as a proxy for publisher-held-out evaluation (WELFake has no publisher column).
