# GKIN Benchmark Suite

Three runnable scripts + one report generator that answer the midterm judges'
question: **does GKIN do better than doing nothing?**

## Quick start

```bash
# 1) Out-of-distribution accuracy (the headline number).
#    Default dataset is LIAR (truly OOD); also run gonzalo for the
#    distribution-adjacent upper bound.
python benchmark/run_benchmark.py --dataset liar
python benchmark/run_benchmark.py --dataset gonzalo

# 2) Optional — end-to-end pipeline accuracy on hand-labeled articles.
#    Requires the server running and a JWT.
#    Edit benchmark/hand_labels.json first (>=30 labeled articles).
uvicorn server:app --reload &
export GKIN_JWT="$(curl -s -XPOST localhost:8000/login \
  -H content-type:application/json \
  -d '{"username":"...","password":"..."}' | jq -r .access_token)"
python benchmark/run_manipulation_benchmark.py

# 3) Build the final report from whatever results exist.
python benchmark/generate_report.py
open benchmark/BENCHMARK_REPORT.md
```

## What gets produced

| Path | Contents |
|---|---|
| `benchmark/results/ood_benchmark.json` | Latest OOD run (overwritten each invocation) |
| `benchmark/results/ood_benchmark_liar.json` | Per-dataset tagged copy (truly OOD) |
| `benchmark/results/ood_benchmark_gonzalo.json` | Per-dataset tagged copy (distribution-adjacent) |
| `benchmark/results/ood_benchmark.csv` | Per-article predictions, confidences, lengths |
| `benchmark/results/manipulation_benchmark.json` | End-to-end pipeline accuracy on hand labels |
| `benchmark/BENCHMARK_REPORT.md` | Human-readable summary (the slide content) |

The `/benchmark` HTTP endpoint on `server.py` serves the JSON results so the
frontend can render a live "How accurate is GKIN?" panel.

## Which model gets benchmarked

`benchmark/model_loader.py` auto-detects, in priority order:

1. `distilbert_combined/final/` — DistilBERT on FakeNewsNet + WELFake titles
   jointly. The only checkpoint without a cross-dataset collapse per the
   training notebooks; recommended deployment model.
2. `distilbert_welfake/final/` — DistilBERT on WELFake (99.4% in-domain,
   ~chance on FakeNewsNet titles).
3. `distilbert_fakenewsnet_weighted/final/` — DistilBERT on FakeNewsNet
   with class weights.
4. `distilbert_fakenewsnet/final/` — DistilBERT on FakeNewsNet, unweighted.
5. `baseline_model.joblib` — TF-IDF + LogReg baseline (what `server.py:586`
   actually serves in production today).

The first one that exists wins. Override with `--model-prefer
{distilbert_combined,distilbert_welfake,distilbert_fakenewsnet_weighted,
distilbert_fakenewsnet,joblib}`. The report names whichever was used.

## Reproducibility

Every script sets `random.seed(42)`, `numpy.random.seed(42)`, and
`PYTHONHASHSEED=42` before sampling, so identical inputs produce identical
numbers across runs.
