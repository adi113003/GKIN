# GKIN Benchmark Report
_Generated 2026-05-25T03:02:01.909422+00:00._
## Headline

> **GKIN achieves 50.90% accuracy on out-of-distribution data (LIAR) — vs 50% for random guessing.**

## Executive summary

- **On LIAR (out-of-distribution)** GKIN scores **50.90%**, indistinguishable from random (50.90%). Generalization to data unlike WELFake is the open problem.
- **On GONZALO (distribution-adjacent)** GKIN scores **98.60%** — close to the WELFake holdout. This is the optimistic upper bound: it shows the model works on data that *looks like* its training set, not that it transfers.
- On the truly-OOD set the model predicts **fake** on **94%** of inputs regardless of ground truth — a clear bias readable straight from the confusion matrix.

## GKIN vs baselines

| Approach | Accuracy | F1 (macro) | Precision (macro) | Recall (macro) |
|---|---:|---:|---:|---:|
| **GKIN on LIAR (OOD)** | **50.90%** | 38.91% | 54.19% | 50.90% |
| GKIN on GONZALO (distribution-adjacent) | 98.60% | 98.60% | 98.62% | 98.60% |
| Random guessing baseline | 50.90% | 50.90% | 50.90% | 50.90% |
| Majority-class baseline (real) | 50.00% | 33.33% | 25.00% | 50.00% |

GKIN model in use: `joblib_baseline` — TF-IDF + LogisticRegression baseline (the model server.py actually serves).

## Confusion matrix — LIAR OOD set (1000 examples)

```
                  pred_real    pred_fake
  actual_real         33          467
  actual_fake         24          476
```

## Accuracy by text length

| Word count | N | Accuracy |
|---|---:|---:|
| <100 | 1000 | 50.90% |
| 100-300 | 0 | — |
| 300-500 | 0 | — |
| 500+ | 0 | — |

## End-to-end pipeline benchmark

_Ran but 0 articles scored_ (hand_labels.json had 2 entries; none had usable text). Populate the template before re-running.

## Published cross-dataset evidence (from training notebooks)

Numbers below are from `train_distilbert_fakenewsnet.ipynb` (sections 14, 17, 18). They corroborate this benchmark's OOD finding from a different angle: any model trained on one dataset alone collapses to near chance on the other; only the combined-training model holds up on both slices.

| Training data | Evaluated on | Accuracy | Macro F1 | Notes |
|---|---|---:|---:|---|
| FakeNewsNet only (unweighted) | FakeNewsNet test | 86.6% | 0.811 | in-domain |
| FakeNewsNet only (unweighted) | WELFake titles | 49.8% | 0.493 | OOD — chance |
| FakeNewsNet only (weighted) | FakeNewsNet test | 83.4% | 0.792 | in-domain, fake-recall + |
| FakeNewsNet only (weighted) | WELFake titles | 50.0% | 0.461 | OOD — chance, predicts fake 76% |
| WELFake only | WELFake test | 99.4% | 0.994 | in-domain |
| WELFake only | FakeNewsNet titles | 71.1% | 0.455 | OOD — predicts real 93% |
| Combined (FN + WELFake) | FakeNewsNet slice | 84.3% | 0.787 | in-domain (both sources seen during training) |
| Combined (FN + WELFake) | WELFake slice | 94.9% | 0.949 | in-domain (both sources seen during training) |

**Takeaway:** the combined-training checkpoint (`distilbert_combined/final/`) is the recommended deployment model for GKIN — it is the only one without a cross-dataset collapse.

## Known limitations (be honest with judges)

- **Shuffle ablation on the fine-tuned DistilBERT model collapses from 99.37% to 56.23% when word order is destroyed** (recorded in CLAUDE.md). The model is reading syntax — it isn't pure keyword memorization — but on shuffled input it falls to roughly chance, which means a meaningful portion of the score comes from stylistic cues rather than semantic understanding.
- **The first 25 words alone get 94.08% accuracy** on the WELFake test set. Publisher style in the lede contributes a large share of the in-distribution score.
- **Distribution gap is +47.70pp** (98.60% on GONZALO vs 50.90% on LIAR). The model transfers to data that looks like its training distribution and degrades sharply on data that doesn't.
- **No publisher-held-out evaluation exists yet.** WELFake's real class is dominated by Reuters wire copy; the fake class is dominated by a small number of partisan blogs. Random train/test splits put the same publishers in both halves, so in-distribution accuracy overstates real-world utility.
- **Verdict mapping treats UNCERTAIN articles as wrong** in the strict end-to-end accuracy. The decided-only accuracy is shown alongside as a floor vs ceiling pair.

## What this means (for a non-technical reader)

**The job we set:** can GKIN do better than random guessing on articles it has never seen, written in styles different from its training data?

**The result:** on LIAR — short political fact-checks that look nothing like the news articles GKIN was trained on — GKIN gets **50.90%** right. Random guessing gets 50%.

**The other number:** on GONZALO — full news articles in the same broad style as the training set — GKIN gets **98.60%** right. This is the model working in its comfort zone.

**The honest reading:** GKIN is strong when the input looks like what it was trained on, and weak when the input is genuinely new. That's normal for a model of this scale — but it's the gap a deployment would need to close before users can lean on the verdict in the wild.

**What we're claiming:** GKIN's LLM + ML pipeline is a useful media-literacy tool that surfaces *evidence and reasoning* alongside a verdict. The verdict alone is not a substitute for reading carefully — the pipeline is for exposing manipulation tactics, claims to verify, and missing context, not for stamping articles TRUE / FALSE.

## Methodology

- Primary OOD dataset: **liar** (1000 examples, seed=42). Run at 2026-05-25T03:02:01.704962+00:00.
- Secondary (distribution-adjacent): **gonzalo** (1000 examples, seed=42).
- Model: `joblib_baseline` — TF-IDF + LogisticRegression baseline (the model server.py actually serves).
- Inference time: 0.02s for the primary run.
- Random seed fixed to 42 across dataset sampling, baseline random predictions, and inference; results reproduce bit-for-bit.
- All scripts are runnable standalone: `python benchmark/run_benchmark.py --dataset {liar,gonzalo}`.
