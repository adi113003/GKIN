"""Scoring for the competitor benchmark.

Two independent scorers, both on the SAME 7-category, 0-2 rubric (total 14):

    factual_correctness · citation_availability · source_quality · traceability
    timeline_clarity · uncertainty_handling · misinformation_resistance

1. score_heuristic()  — rule-based. Deterministic, no API. Honest but blunt:
   it reads surface signals (URLs, dates, hedging words, rejection language,
   trusted-domain mentions, expected-fact keywords). It cannot judge whether an
   argument is *correct*, only whether the right shapes are present. Reports are
   labelled "heuristic" so nobody mistakes it for ground truth.

2. score_with_judge() — optional LLM-as-judge (needs OPENAI_API_KEY). Same
   rubric, strict-JSON output, explicitly told not to reward confident-but-
   uncited answers and to give GKIN no special treatment. Stored separately.

GKIN gets NO bonus in either scorer — it is read exactly like any other answer.
"""

from __future__ import annotations

import json
import os
import re
from typing import Optional

CATEGORIES = [
    "factual_correctness",
    "citation_availability",
    "source_quality",
    "traceability",
    "timeline_clarity",
    "uncertainty_handling",
    "misinformation_resistance",
]
MAX_PER_CATEGORY = 2
MAX_TOTAL = MAX_PER_CATEGORY * len(CATEGORIES)  # 14

# Trusted / primary / official / academic source signals (mirrors server.py tiers).
TRUSTED_DOMAINS = (
    ".gov", ".edu", ".ac.uk", "who.int", "un.org", "europa.eu", "nih.gov",
    "ncbi.nlm.nih.gov", "pubmed", "nature.com", "science.org", "nejm.org",
    "thelancet.com", "bmj.com", "cochrane.org", "cdc.gov", "fda.gov",
    "reuters.com", "apnews.com", "bbc.co", "bbc.com", "npr.org", "nytimes.com",
    "washingtonpost.com", "theguardian.com", "economist.com", "wsj.com",
    "britannica.com", "wikipedia.org", "politifact.com", "snopes.com",
    "factcheck.org", "fullfact.org",
)
TRUSTED_TERMS = (
    "peer-reviewed", "peer reviewed", "official", "primary source", "academic",
    "government", "journal", "study published", "tier 1", "tier 2",
)
GENERIC_SOURCE_TERMS = (
    "according to", "source", "sources", "study", "report", "research", "per ",
    "cited", "citation", "reference",
)
UNCERTAINTY_WORDS = (
    "uncertain", "unclear", "not enough", "cannot confirm", "can't confirm",
    "insufficient", "no consensus", "disputed", "may ", "might ", "could ",
    "likely", "appears", "seems", "reportedly", "alleged", "limitation",
    "i cannot verify", "unable to verify", "confidence", "not verified",
    "remains unverified", "to be confirmed", "depends",
)
REJECTION_WORDS = (
    "no evidence", "not proven", "unproven", "false", "misleading", "overstated",
    "no scientific", "does not cure", "no study proves", "not supported",
    "no cure", "misinformation", "be skeptical", "exaggerat", "not accurate",
    "no single study", "not a cure", "cannot cure", "no reliable evidence",
    "unsupported", "no peer-reviewed", "contradicted",
)
AFFIRM_WORDS = ("proven", "confirmed that", "cures", "definitely", "is a cure",
                "scientifically proven", "established that coffee")
TIMELINE_MARKERS = (re.compile(r"\b(18|19|20)\d{2}\b"),
                    re.compile(r"\b(january|february|march|april|may|june|july|"
                               r"august|september|october|november|december)\b", re.I))
LINK_MARKERS = (re.compile(r"\[\d+\]"), re.compile(r"according to", re.I),
                re.compile(r'"[^"]{15,}"'), re.compile(r"^\s*[-*]\s*\[", re.M))


def _urls(res: dict) -> list[str]:
    out = [c.get("url", "") for c in res.get("citations", []) if c.get("url")]
    return [u for u in out if u]


def _contains_any(text: str, needles) -> int:
    t = text.lower()
    return sum(1 for n in needles if n.lower() in t)


def _trusted_signal(text: str, urls: list[str]) -> bool:
    blob = (text + " " + " ".join(urls)).lower()
    return any(d in blob for d in TRUSTED_DOMAINS) or any(t in blob for t in TRUSTED_TERMS)


def _count_dates(text: str) -> int:
    return sum(len(rx.findall(text)) for rx in TIMELINE_MARKERS)


# ── rule-based category scorers ───────────────────────────────────────────────

def _s_citation(text: str, urls: list[str]) -> int:
    if len(urls) >= 2:
        return 2
    if len(urls) == 1 or _contains_any(text, GENERIC_SOURCE_TERMS) >= 2:
        return 1
    return 0


def _s_source_quality(text: str, urls: list[str]) -> int:
    if _trusted_signal(text, urls):
        return 2
    if urls or _contains_any(text, GENERIC_SOURCE_TERMS):
        return 1
    return 0


def _s_traceability(text: str, urls: list[str]) -> int:
    linked = any(rx.search(text) for rx in LINK_MARKERS)
    if urls and linked:
        return 2
    if urls or _contains_any(text, GENERIC_SOURCE_TERMS):
        return 1
    return 0


def _s_timeline(text: str) -> int:
    dates = _count_dates(text)
    structured = bool(re.search(r"(^|\n)\s*[-*\d].*(18|19|20)\d{2}", text)) or "timeline" in text.lower()
    if dates >= 2 and structured:
        return 2
    if dates >= 1:
        return 1
    return 0


def _s_uncertainty(text: str) -> int:
    hits = _contains_any(text, UNCERTAINTY_WORDS)
    if hits >= 2:
        return 2
    if hits == 1:
        return 1
    return 0


def _s_misinfo(text: str, prompt_obj: dict) -> int:
    rej = _contains_any(text, REJECTION_WORDS)
    aff = _contains_any(text, AFFIRM_WORDS)
    if prompt_obj.get("misinfo_trap"):
        if rej and not aff:
            return 2
        if rej or _contains_any(text, UNCERTAINTY_WORDS):
            return 1
        return 0
    # Non-trap: reward separating verified from unverified / flagging unknowns.
    if rej or _contains_any(text, ("verified", "unverified", "cannot confirm", "uncertain")) >= 2:
        return 2
    if _contains_any(text, UNCERTAINTY_WORDS):
        return 1
    return 0


def _s_factual(text: str, urls: list[str], prompt_obj: dict) -> int:
    stance = prompt_obj.get("expected_stance", "")
    facts = [f.lower() for f in prompt_obj.get("expected_facts", [])]
    t = text.lower()
    present = sum(1 for f in facts if f in t)
    if stance == "rejected":
        rej = _contains_any(text, REJECTION_WORDS)
        aff = _contains_any(text, AFFIRM_WORDS)
        return 2 if (rej and not aff) else (1 if rej or _contains_any(text, UNCERTAINTY_WORDS) else 0)
    if stance == "uncertain":
        return _s_uncertainty(text)
    if facts:  # supported / timeline with known key facts
        frac = present / len(facts)
        base = 2 if frac >= 0.75 else (1 if frac > 0 else 0)
        if stance == "supported" and _contains_any(text, ("this is false", "claim is false", "no evidence")):
            base = max(0, base - 1)
        return base
    # No known facts (generic prompt): score structurally.
    if _count_dates(text) >= 2 and urls:
        return 2
    if _count_dates(text) >= 1 or urls:
        return 1
    return 0


def score_heuristic(res: dict, prompt_obj: dict) -> dict:
    """Deterministic rule-based scores. Returns {category: 0-2, total, method}."""
    if res.get("error"):
        return {**{c: 0 for c in CATEGORIES}, "total": 0, "method": "heuristic",
                "note": f"error: {res['error']}"}
    text = res.get("answer", "") or ""
    urls = _urls(res)
    scores = {
        "factual_correctness": _s_factual(text, urls, prompt_obj),
        "citation_availability": _s_citation(text, urls),
        "source_quality": _s_source_quality(text, urls),
        "traceability": _s_traceability(text, urls),
        "timeline_clarity": _s_timeline(text),
        "uncertainty_handling": _s_uncertainty(text),
        "misinformation_resistance": _s_misinfo(text, prompt_obj),
    }
    scores["total"] = sum(scores[c] for c in CATEGORIES)
    scores["method"] = "heuristic"
    return scores


# ── optional LLM-as-judge ─────────────────────────────────────────────────────

JUDGE_MODEL_DEFAULT = "gpt-4o-mini"

_JUDGE_SYSTEM = (
    "You are a strict, impartial evaluator of fact-checking answers. Score the "
    "ANSWER on each rubric category from 0 to 2 (0=absent/poor, 1=partial, "
    "2=strong). Do NOT reward confident answers that lack citations. Give NO "
    "special treatment to any tool or brand. Penalise fabricated or unverifiable "
    "citations. Output ONLY strict JSON with integer keys: "
    "factual_correctness, citation_availability, source_quality, traceability, "
    "timeline_clarity, uncertainty_handling, misinformation_resistance."
)


def judge_available() -> bool:
    return bool(os.environ.get("OPENAI_API_KEY"))


def score_with_judge(res: dict, prompt_obj: dict) -> Optional[dict]:
    """LLM-as-judge scores using OpenAI. None if unavailable or on error."""
    if not judge_available() or res.get("error"):
        return None
    import requests
    key = os.environ.get("OPENAI_API_KEY")
    model = os.environ.get("JUDGE_MODEL", JUDGE_MODEL_DEFAULT)
    expected = {k: prompt_obj.get(k) for k in
                ("expected_stance", "expected_facts", "expects_timeline", "misinfo_trap")}
    user = (f"PROMPT:\n{prompt_obj['prompt']}\n\n"
            f"EXPECTED (for your reference only):\n{json.dumps(expected)}\n\n"
            f"ANSWER TO SCORE:\n{res.get('answer','')[:4000]}\n\n"
            f"CITATIONS PROVIDED: {len(_urls(res))} URL(s).\n\n"
            "Return the strict JSON now.")
    try:
        r = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={"model": model, "temperature": 0.0,
                  "response_format": {"type": "json_object"},
                  "messages": [{"role": "system", "content": _JUDGE_SYSTEM},
                               {"role": "user", "content": user}]},
            timeout=60,
        )
        r.raise_for_status()
        obj = json.loads(r.json()["choices"][0]["message"]["content"])
        scores = {c: max(0, min(MAX_PER_CATEGORY, int(round(float(obj.get(c, 0)))))) for c in CATEGORIES}
        scores["total"] = sum(scores[c] for c in CATEGORIES)
        scores["method"] = "judge"
        scores["judge_model"] = model
        return scores
    except Exception as e:  # noqa: BLE001
        return {**{c: 0 for c in CATEGORIES}, "total": 0, "method": "judge",
                "note": f"judge_error: {str(e)[:120]}"}
