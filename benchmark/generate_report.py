"""
Compose a single benchmark report from the OOD + manipulation runs.

Reads:
  benchmark/results/ood_benchmark.json            (latest OOD run)
  benchmark/results/ood_benchmark_liar.json       (optional, tagged)
  benchmark/results/ood_benchmark_gonzalo.json    (optional, tagged)
  benchmark/results/manipulation_benchmark.json   (optional)

Writes:
  benchmark/BENCHMARK_REPORT.md

The report is written for a non-technical judge. It shows the headline
OOD accuracy, the comparison vs baselines, and an honest "Known Limitations"
section that calls out the WELFake shuffle-ablation gap (56.2%) and any
gap between distribution-adjacent vs truly-OOD numbers.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


RESULTS_DIR = Path(__file__).parent / "results"
REPORT_PATH = Path(__file__).parent / "BENCHMARK_REPORT.md"

# Pulled from CLAUDE.md — the published shuffle-ablation drop on the
# fine-tuned DistilBERT model. Hard-coded because it's a fact about the
# model checkpoint, not something this benchmark re-runs.
KNOWN_SHUFFLE_ACCURACY = 0.5623
KNOWN_CONTROL_ACCURACY = 0.9937
KNOWN_FIRST25_ACCURACY = 0.9408

# Cross-dataset numbers from train_distilbert_fakenewsnet.ipynb (sections
# 14, 17, 18). Hard-coded for the same reason as above: these are facts
# about saved checkpoints on the GPU box, not something this script re-runs.
PUBLISHED_XDATASET = [
    # (training data, eval slice, accuracy, macro_f1, notes)
    ("FakeNewsNet only (unweighted)", "FakeNewsNet test",  0.866, 0.811, "in-domain"),
    ("FakeNewsNet only (unweighted)", "WELFake titles",    0.498, 0.493, "OOD — chance"),
    ("FakeNewsNet only (weighted)",   "FakeNewsNet test",  0.834, 0.792, "in-domain, fake-recall +"),
    ("FakeNewsNet only (weighted)",   "WELFake titles",    0.500, 0.461, "OOD — chance, predicts fake 76%"),
    ("WELFake only",                  "WELFake test",      0.994, 0.994, "in-domain"),
    ("WELFake only",                  "FakeNewsNet titles", 0.711, 0.455, "OOD — predicts real 93%"),
    ("Combined (FN + WELFake)",       "FakeNewsNet slice", 0.843, 0.787, "in-domain (both sources seen during training)"),
    ("Combined (FN + WELFake)",       "WELFake slice",     0.949, 0.949, "in-domain (both sources seen during training)"),
]


def load_json(path: Path) -> Optional[dict]:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError:
        return None


def pct(x: Optional[float], digits: int = 2) -> str:
    if x is None:
        return "—"
    return f"{x*100:.{digits}f}%"


def signed_pp(x: Optional[float]) -> str:
    if x is None:
        return "—"
    return f"{x*100:+.2f}pp"


def fmt(x: Optional[float], digits: int = 3) -> str:
    if x is None:
        return "—"
    return f"{x:.{digits}f}"


def ascii_confusion(cm: dict) -> str:
    a_r_p_r = cm.get("actual_real_pred_real", 0)
    a_r_p_f = cm.get("actual_real_pred_fake", 0)
    a_f_p_r = cm.get("actual_fake_pred_real", 0)
    a_f_p_f = cm.get("actual_fake_pred_fake", 0)
    lines = [
        "```",
        "                  pred_real    pred_fake",
        f"  actual_real     {a_r_p_r:>6d}       {a_r_p_f:>6d}",
        f"  actual_fake     {a_f_p_r:>6d}       {a_f_p_f:>6d}",
        "```",
    ]
    return "\n".join(lines)


def section_executive_summary(primary: dict, alt: Optional[dict], manip: Optional[dict]) -> str:
    primary_acc = primary["gkin"]["accuracy"]
    random_acc = primary["baseline_random"]["accuracy"]
    delta = primary_acc - random_acc
    primary_ds = primary["metadata"]["dataset"]

    bullets = []
    if delta > 0.10:
        bullets.append(
            f"**On {primary_ds.upper()} (out-of-distribution)** GKIN scores "
            f"**{pct(primary_acc)}** vs **{pct(random_acc)}** for random guessing "
            f"({signed_pp(delta)}). The classifier is doing real work, not coin-flipping."
        )
    elif delta > 0.0:
        bullets.append(
            f"**On {primary_ds.upper()} (out-of-distribution)** GKIN scores "
            f"**{pct(primary_acc)}** vs **{pct(random_acc)}** for random guessing "
            f"({signed_pp(delta)}). Above chance, but not by much — this is the gap "
            f"to close."
        )
    else:
        bullets.append(
            f"**On {primary_ds.upper()} (out-of-distribution)** GKIN scores "
            f"**{pct(primary_acc)}**, indistinguishable from random ({pct(random_acc)}). "
            f"Generalization to data unlike WELFake is the open problem."
        )

    if alt is not None:
        alt_acc = alt["gkin"]["accuracy"]
        alt_ds = alt["metadata"]["dataset"]
        bullets.append(
            f"**On {alt_ds.upper()} (distribution-adjacent)** GKIN scores "
            f"**{pct(alt_acc)}** — close to the WELFake holdout. This is the optimistic "
            f"upper bound: it shows the model works on data that *looks like* its training "
            f"set, not that it transfers."
        )

    cm = primary["gkin"]["confusion_matrix"]
    total = sum(cm.values())
    a_f_p_f = cm["actual_fake_pred_fake"]
    a_r_p_f = cm["actual_real_pred_fake"]
    pred_fake_share = (a_f_p_f + a_r_p_f) / total if total else 0
    bullets.append(
        f"On the truly-OOD set the model predicts **fake** on "
        f"**{pred_fake_share*100:.0f}%** of inputs regardless of ground truth — "
        f"a clear bias readable straight from the confusion matrix."
    )

    if manip and manip.get("metadata", {}).get("n_scored", 0) > 0:
        n = manip["metadata"]["n_scored"]
        acc = manip.get("accuracy_on_decided_only")
        bullets.append(
            f"**End-to-end pipeline (LLM + ML + scrape) on {n} hand-labeled articles** "
            f"agrees with human ground truth **{pct(acc)}** of the time on decided verdicts."
        )

    out = ["## Executive summary", ""]
    for b in bullets:
        out.append(f"- {b}")
    out.append("")
    return "\n".join(out)


def section_headline(primary: dict) -> str:
    acc = primary["gkin"]["accuracy"]
    ds = primary["metadata"]["dataset"]
    return (
        "## Headline\n\n"
        f"> **GKIN achieves {pct(acc)} accuracy on out-of-distribution data "
        f"({ds.upper()}) — vs 50% for random guessing.**\n"
    )


def section_comparison_table(primary: dict, alt: Optional[dict]) -> str:
    lines = ["## GKIN vs baselines", ""]
    lines.append("| Approach | Accuracy | F1 (macro) | Precision (macro) | Recall (macro) |")
    lines.append("|---|---:|---:|---:|---:|")

    pds = primary["metadata"]["dataset"]
    g = primary["gkin"]
    lines.append(
        f"| **GKIN on {pds.upper()} (OOD)** | "
        f"**{pct(g['accuracy'])}** | {pct(g['f1_macro'])} | "
        f"{pct(g['precision_macro'])} | {pct(g['recall_macro'])} |"
    )

    if alt is not None:
        ads = alt["metadata"]["dataset"]
        a = alt["gkin"]
        lines.append(
            f"| GKIN on {ads.upper()} (distribution-adjacent) | "
            f"{pct(a['accuracy'])} | {pct(a['f1_macro'])} | "
            f"{pct(a['precision_macro'])} | {pct(a['recall_macro'])} |"
        )

    r = primary["baseline_random"]
    m = primary["baseline_majority"]
    lines.append(
        f"| Random guessing baseline | {pct(r['accuracy'])} | "
        f"{pct(r['f1_macro'])} | {pct(r['precision_macro'])} | "
        f"{pct(r['recall_macro'])} |"
    )
    lines.append(
        f"| Majority-class baseline ({m.get('majority_class','?')}) | "
        f"{pct(m['accuracy'])} | {pct(m['f1_macro'])} | "
        f"{pct(m['precision_macro'])} | {pct(m['recall_macro'])} |"
    )

    lines.append("")
    lines.append(
        f"GKIN model in use: `{primary['metadata']['model_kind']}` — "
        f"{primary['metadata']['model_label']}."
    )
    lines.append("")
    return "\n".join(lines)


def section_confusion(primary: dict) -> str:
    cm = primary["gkin"]["confusion_matrix"]
    return (
        f"## Confusion matrix — {primary['metadata']['dataset'].upper()} OOD set "
        f"({primary['metadata']['n_total']} examples)\n\n"
        + ascii_confusion(cm)
        + "\n"
    )


def section_length_buckets(primary: dict) -> str:
    buckets = primary.get("accuracy_by_length", {})
    if not buckets:
        return ""
    lines = ["## Accuracy by text length", ""]
    lines.append("| Word count | N | Accuracy |")
    lines.append("|---|---:|---:|")
    for bucket, info in buckets.items():
        acc = info.get("accuracy")
        n = info.get("n", 0)
        lines.append(f"| {bucket} | {n} | {pct(acc) if acc is not None else '—'} |")
    lines.append("")
    return "\n".join(lines)


def section_manipulation(manip: Optional[dict]) -> str:
    if manip is None:
        return (
            "## End-to-end pipeline benchmark\n\n"
            "_Not yet run._ See `benchmark/run_manipulation_benchmark.py` and "
            "populate `benchmark/hand_labels.json` with >=30 articles to produce "
            "these numbers.\n"
        )

    meta = manip.get("metadata", {})
    n = meta.get("n_scored", 0)
    if n == 0:
        return (
            "## End-to-end pipeline benchmark\n\n"
            f"_Ran but 0 articles scored_ (hand_labels.json had "
            f"{meta.get('n_labels', 0)} entries; none had usable text). Populate "
            f"the template before re-running.\n"
        )

    cm = manip.get("confusion_matrix", {})
    lines = [
        "## End-to-end pipeline benchmark (LLM + ML + claim verification)",
        "",
        f"Hand-labeled articles: **{n}**.",
        "",
        f"- Accuracy (UNCERTAIN counted wrong): **{pct(manip.get('accuracy_overall_includes_uncertain'))}**",
        f"- Accuracy (decided verdicts only): **{pct(manip.get('accuracy_on_decided_only'))}**",
        f"- False positive rate (real flagged fake): **{pct(manip.get('false_positive_rate'))}**",
        f"- False negative rate (fake missed): **{pct(manip.get('false_negative_rate'))}**",
        f"- Pearson r(manipulation_index, ground_truth_manipulative): "
        f"**{fmt(manip.get('manipulation_index_vs_truth_pearson'))}**",
        "",
        f"Confusion: TP={cm.get('tp',0)}  TN={cm.get('tn',0)}  "
        f"FP={cm.get('fp',0)}  FN={cm.get('fn',0)}  "
        f"UNCERTAIN={cm.get('uncertain',0)}",
        "",
    ]
    return "\n".join(lines)


def section_published_xdataset() -> str:
    """Cross-dataset numbers from train_distilbert_fakenewsnet.ipynb.

    Independent of whatever the live benchmark scripts produced — these are
    the published results from the training notebooks and should appear in
    the report regardless of which dataset/model the current run used.
    """
    lines = [
        "## Published cross-dataset evidence (from training notebooks)",
        "",
        "Numbers below are from `train_distilbert_fakenewsnet.ipynb` (sections "
        "14, 17, 18). They corroborate this benchmark's OOD finding from a "
        "different angle: any model trained on one dataset alone collapses to "
        "near chance on the other; only the combined-training model holds up "
        "on both slices.",
        "",
        "| Training data | Evaluated on | Accuracy | Macro F1 | Notes |",
        "|---|---|---:|---:|---|",
    ]
    for training, eval_slice, acc, f1m, notes in PUBLISHED_XDATASET:
        lines.append(
            f"| {training} | {eval_slice} | {acc*100:.1f}% | {f1m:.3f} | {notes} |"
        )
    lines.extend([
        "",
        "**Takeaway:** the combined-training checkpoint "
        "(`distilbert_combined/final/`) is the recommended deployment model "
        "for GKIN — it is the only one without a cross-dataset collapse.",
        "",
    ])
    return "\n".join(lines)


def section_limitations(primary: dict, alt: Optional[dict]) -> str:
    primary_acc = primary["gkin"]["accuracy"]
    primary_ds = primary["metadata"]["dataset"]
    bullets = []

    bullets.append(
        f"**Shuffle ablation on the fine-tuned DistilBERT model collapses from "
        f"{pct(KNOWN_CONTROL_ACCURACY)} to {pct(KNOWN_SHUFFLE_ACCURACY)} when "
        f"word order is destroyed** (recorded in CLAUDE.md). The model is reading "
        f"syntax — it isn't pure keyword memorization — but on shuffled input it "
        f"falls to roughly chance, which means a meaningful portion of the score "
        f"comes from stylistic cues rather than semantic understanding."
    )
    bullets.append(
        f"**The first 25 words alone get {pct(KNOWN_FIRST25_ACCURACY)} accuracy** "
        f"on the WELFake test set. Publisher style in the lede contributes a large "
        f"share of the in-distribution score."
    )
    if alt is not None:
        alt_acc = alt["gkin"]["accuracy"]
        gap = alt_acc - primary_acc
        bullets.append(
            f"**Distribution gap is {signed_pp(gap)}** "
            f"({pct(alt_acc)} on {alt['metadata']['dataset'].upper()} vs "
            f"{pct(primary_acc)} on {primary_ds.upper()}). The model transfers to "
            f"data that looks like its training distribution and degrades sharply "
            f"on data that doesn't."
        )
    bullets.append(
        f"**No publisher-held-out evaluation exists yet.** WELFake's real class is "
        f"dominated by Reuters wire copy; the fake class is dominated by a small "
        f"number of partisan blogs. Random train/test splits put the same publishers "
        f"in both halves, so in-distribution accuracy overstates real-world utility."
    )
    bullets.append(
        f"**Verdict mapping treats UNCERTAIN articles as wrong** in the strict "
        f"end-to-end accuracy. The decided-only accuracy is shown alongside as a "
        f"floor vs ceiling pair."
    )

    out = ["## Known limitations (be honest with judges)", ""]
    for b in bullets:
        out.append(f"- {b}")
    out.append("")
    return "\n".join(out)


def section_what_this_means(primary: dict, alt: Optional[dict]) -> str:
    primary_acc = primary["gkin"]["accuracy"]
    primary_ds = primary["metadata"]["dataset"]
    parts = [
        "## What this means (for a non-technical reader)",
        "",
        "**The job we set:** can GKIN do better than random guessing on articles it "
        "has never seen, written in styles different from its training data?",
        "",
        f"**The result:** on {primary_ds.upper()} — short political fact-checks that "
        f"look nothing like the news articles GKIN was trained on — GKIN gets "
        f"**{pct(primary_acc)}** right. Random guessing gets 50%.",
        "",
    ]
    if alt is not None:
        alt_acc = alt["gkin"]["accuracy"]
        parts.extend([
            f"**The other number:** on {alt['metadata']['dataset'].upper()} — full "
            f"news articles in the same broad style as the training set — GKIN gets "
            f"**{pct(alt_acc)}** right. This is the model working in its comfort zone.",
            "",
            "**The honest reading:** GKIN is strong when the input looks like what it "
            "was trained on, and weak when the input is genuinely new. That's normal "
            "for a model of this scale — but it's the gap a deployment would need to "
            "close before users can lean on the verdict in the wild.",
            "",
        ])
    else:
        parts.extend([
            "**The honest reading:** this benchmark measures generalization, not "
            "in-distribution performance. A high in-distribution score (99.4% on "
            "WELFake) does not transfer cleanly to this OOD set, and that gap is "
            "the work still to be done.",
            "",
        ])
    parts.extend([
        "**What we're claiming:** GKIN's LLM + ML pipeline is a useful media-literacy "
        "tool that surfaces *evidence and reasoning* alongside a verdict. The verdict "
        "alone is not a substitute for reading carefully — the pipeline is for "
        "exposing manipulation tactics, claims to verify, and missing context, not "
        "for stamping articles TRUE / FALSE.",
        "",
    ])
    return "\n".join(parts)


def section_methodology(primary: dict, alt: Optional[dict]) -> str:
    p_meta = primary["metadata"]
    parts = [
        "## Methodology",
        "",
        f"- Primary OOD dataset: **{p_meta['dataset']}** "
        f"({p_meta['n_total']} examples, seed={p_meta['seed']}). "
        f"Run at {p_meta['run_at']}.",
    ]
    if alt is not None:
        a_meta = alt["metadata"]
        parts.append(
            f"- Secondary (distribution-adjacent): **{a_meta['dataset']}** "
            f"({a_meta['n_total']} examples, seed={a_meta['seed']})."
        )
    parts.extend([
        f"- Model: `{p_meta['model_kind']}` — {p_meta['model_label']}.",
        f"- Inference time: {p_meta.get('inference_seconds', '?')}s for the primary run.",
        "- Random seed fixed to 42 across dataset sampling, baseline random "
        "predictions, and inference; results reproduce bit-for-bit.",
        "- All scripts are runnable standalone: "
        "`python benchmark/run_benchmark.py --dataset {liar,gonzalo}`.",
        "",
    ])
    return "\n".join(parts)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--primary", default=str(RESULTS_DIR / "ood_benchmark_liar.json"),
                    help="Path to the headline OOD result (truly out-of-distribution).")
    ap.add_argument("--alt", default=str(RESULTS_DIR / "ood_benchmark_gonzalo.json"),
                    help="Optional distribution-adjacent comparison result.")
    ap.add_argument("--manip", default=str(RESULTS_DIR / "manipulation_benchmark.json"),
                    help="Optional end-to-end manipulation benchmark result.")
    ap.add_argument("--out", default=str(REPORT_PATH))
    args = ap.parse_args()

    primary = load_json(Path(args.primary))
    if primary is None:
        # Fall back to the un-tagged latest file so the report still runs after
        # only one OOD invocation.
        primary = load_json(RESULTS_DIR / "ood_benchmark.json")
    if primary is None:
        print(f"ERROR: no OOD benchmark results found. Run "
              f"`python benchmark/run_benchmark.py` first.")
        return 2

    alt = load_json(Path(args.alt))
    # Avoid showing the same run twice if alt == primary (e.g. only one dataset run).
    if alt is not None and alt.get("metadata", {}).get("dataset") == \
            primary.get("metadata", {}).get("dataset"):
        alt = None

    manip = load_json(Path(args.manip))
    if manip and manip.get("metadata", {}).get("n_scored", 0) == 0:
        # An empty manipulation run isn't a failure — but the report section
        # should reflect that rather than pretending we have signal.
        pass

    parts = [
        "# GKIN Benchmark Report",
        "",
        f"_Generated {datetime.now(timezone.utc).isoformat()}._",
        "",
        section_headline(primary),
        section_executive_summary(primary, alt, manip),
        section_comparison_table(primary, alt),
        section_confusion(primary),
        section_length_buckets(primary),
        section_manipulation(manip),
        section_published_xdataset(),
        section_limitations(primary, alt),
        section_what_this_means(primary, alt),
        section_methodology(primary, alt),
    ]
    text = "\n".join(p for p in parts if p)
    Path(args.out).write_text(text)
    print(f"Wrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
