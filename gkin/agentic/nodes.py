"""State-machine nodes for the agentic fact-checking loop.

Each node is an ``async (state, deps) -> state`` function decorated with
``@trace``. Nodes are deliberately dumb: they mutate and return the shared
``state`` dict and never decide what runs next — that is the controller's job
(``controller.route``). External capabilities (web search, page scraping,
source-tier lookup, the Groq client) are *injected* via ``Deps`` so this module
never imports ``server`` and so the loop is testable with fakes.

Pipeline per claim: extract -> build_query -> retrieve -> ground -> emit, with a
single guarded reformulate->retrieve->ground retry when evidence is thin or the
grounding is weak/conflicting.
"""

from __future__ import annotations

import asyncio
import json
import re
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Optional

from groq import AsyncGroq

from .trace import record_usage, trace
from .util import claim_id
from .verdict import (
    EvidenceSpan,
    Verdict,
    VerdictLabel,
    apply_tier_policy,
    insufficient,
)

# Default Groq model ids (mirror server.py). Overridable via Deps.
MODEL_FAST = "llama-3.1-8b-instant"
# ground_verdict calls with response_format=json_object. Reasoning models
# (gpt-oss, qwen3, the retired deepseek-r1) are unreliable in JSON mode on Groq,
# so grounding uses the instruct model that the rest of the server uses for JSON.
MODEL_GROUND = "llama-3.3-70b-versatile"

MIN_GROUNDING_CONFIDENCE = 0.5  # below this we treat grounding as weak/conflicting


@dataclass
class Deps:
    """Injected capabilities + tuning. Keeps nodes free of server imports."""

    client: AsyncGroq
    # sync (url-bound) DuckDuckGo search -> [{title, snippet, url}]; called via to_thread
    ddg_search: Callable[[str, int], list[dict]]
    # async trafilatura scrape -> [{url, title, date, hostname, text}]
    scrape_pages: Callable[[list[str]], Awaitable[list[dict]]]
    # url -> {tier:int, name:str, trusted:bool} (server._source_tier)
    source_tier: Callable[[str], dict]

    model_extract: str = MODEL_FAST
    model_query: str = MODEL_FAST
    model_ground: str = MODEL_GROUND

    max_evidence: int = 5          # evidence items grounded per claim
    search_results: int = 6        # raw DDG results pulled before tier-sort/scrape
    max_assertions: int = 5

    # Marks this object so @trace doesn't dump the Groq client into log lines.
    _trace_skip: bool = field(default=True, repr=False)


def new_state(claim_text: str) -> dict:
    """Fresh state dict for one claim run."""
    return {
        "claim_text": claim_text.strip(),
        "claim_id": claim_id(claim_text),
        "assertions": None,     # list[str] once extracted
        "query": None,          # str once built
        "prev_queries": [],     # reformulation history (audit)
        "evidence": None,       # list[dict] once retrieved
        "grounding": None,      # raw LLM grounding dict
        "verdict": None,        # final Verdict (set by emit)
        "iterations": 0,
        "retries": 0,
        "route_log": [],        # node names in execution order (audit)
    }


def _parse_json(raw: Optional[str]) -> dict:
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        # Tolerate a stray ```json fence or leading prose.
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                return {}
        return {}


# ── Nodes ───────────────────────────────────────────────────────────────────


@trace("extract_assertions")
async def extract_assertions(state: dict, deps: Deps) -> dict:
    """Decompose the claim into atomic, checkable assertions (names/dates/
    numbers/events). These focus the search query and are surfaced for audit."""
    prompt = (
        "Break this claim into its atomic factual assertions — the specific "
        "checkable facts (names, dates, numbers, places, events). Ignore opinion "
        "and rhetoric. Return JSON: {\"assertions\": [\"...\"]}. "
        f"Max {deps.max_assertions} assertions.\n\nClaim: {state['claim_text'][:600]}"
    )
    try:
        resp = await deps.client.chat.completions.create(
            model=deps.model_extract,
            messages=[
                {"role": "system", "content": "Output only valid JSON."},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=300,
        )
        record_usage(getattr(resp, "usage", None))
        data = _parse_json(resp.choices[0].message.content)
        assertions = [str(a).strip() for a in data.get("assertions", []) if str(a).strip()]
    except Exception:
        assertions = []
    # Always leave at least the original claim so downstream nodes have signal.
    state["assertions"] = assertions[: deps.max_assertions] or [state["claim_text"]]
    return state


@trace("build_query")
async def build_query(state: dict, deps: Deps) -> dict:
    """Rewrite the assertions into one focused web-search query.

    Retry-aware: on a reformulation it is told the previous query so it tries a
    materially different angle rather than repeating itself."""
    assertions = state["assertions"] or [state["claim_text"]]
    retry_hint = ""
    if state["prev_queries"]:
        retry_hint = (
            "\n\nThese earlier queries returned weak or conflicting evidence — "
            "try a DIFFERENT angle (different keywords, entities, or phrasing), "
            "do not repeat them:\n- " + "\n- ".join(state["prev_queries"][-3:])
        )
    prompt = (
        "Write ONE concise web search query (max 12 words) to find authoritative "
        "evidence that verifies or refutes the assertions below. Return only the "
        "query text, no quotes or punctuation.\n\nAssertions:\n- "
        + "\n- ".join(a[:200] for a in assertions[:5])
        + retry_hint
    )
    query = ""
    try:
        resp = await deps.client.chat.completions.create(
            model=deps.model_query,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2 if state["prev_queries"] else 0.1,
            max_tokens=40,
        )
        record_usage(getattr(resp, "usage", None))
        query = re.sub(r"[\"'`]", "", (resp.choices[0].message.content or "").strip())
    except Exception:
        query = ""
    state["query"] = (query[:180] or state["claim_text"][:180])
    return state


@trace("retrieve_evidence")
async def retrieve_evidence(state: dict, deps: Deps) -> dict:
    """Reuse the existing DuckDuckGo + trafilatura path, tier-tagging each hit.

    Trusted sources are pulled to the front before scraping so the limited
    evidence budget favours Tier 1/2/3 pages."""
    query = state["query"]
    try:
        raw = await asyncio.to_thread(deps.ddg_search, query, deps.search_results)
    except Exception:
        raw = []
    raw = [r for r in raw if isinstance(r, dict) and not r.get("error") and r.get("url")]

    # Tier-sort: trusted (lower tier number = stronger) first, unverified last.
    def _rank(r: dict) -> int:
        t = deps.source_tier(r["url"])
        return t.get("tier", 99) if t.get("trusted") else 99

    raw.sort(key=_rank)
    raw = raw[: deps.max_evidence]
    urls = [r["url"] for r in raw]

    scraped: list[dict] = []
    if urls:
        try:
            scraped = await deps.scrape_pages(urls)
        except Exception:
            scraped = []
    scraped_by_url = {p.get("url"): p for p in scraped if p.get("url")}

    evidence: list[dict] = []
    for r in raw:
        url = r["url"]
        page = scraped_by_url.get(url) or {}
        text = (page.get("text") or r.get("snippet") or "").strip()
        if not text:
            continue
        tier = deps.source_tier(url)
        evidence.append({
            "url": url,
            "title": (page.get("title") or r.get("title") or "").strip(),
            "snippet": text[:1200],
            "tier": tier.get("tier", 0),
            "tier_name": tier.get("name", "Unverified"),
            "trusted": bool(tier.get("trusted", False)),
            "relevance": 0.7,
        })
    state["evidence"] = evidence
    return state


@trace("ground_verdict")
async def ground_verdict(state: dict, deps: Deps) -> dict:
    """LLM verdict grounded ONLY on retrieved evidence.

    The model must cite each justifying sentence verbatim from the supplied
    evidence and is told not to use training knowledge; if the evidence does not
    address the claim it must return insufficient. The output is raw — emit
    re-validates every cited sentence against the evidence before trusting it."""
    evidence = state["evidence"] or []
    evidence_block = "\n\n".join(
        f"[{i}] URL: {e['url']}\nTITLE: {e['title']}\nTEXT: {e['snippet']}"
        for i, e in enumerate(evidence)
    )
    prompt = (
        "You are a fact-checker. Decide whether the EVIDENCE below supports or "
        "contradicts the CLAIM. Use ONLY the evidence — do NOT use prior/training "
        "knowledge. If the evidence does not directly address the claim, you MUST "
        "answer insufficient.\n\n"
        "Return JSON: {\"verdict\": \"supported|contradicted|insufficient\", "
        "\"confidence\": 0.0-1.0, \"reasoning\": \"...\", "
        "\"citations\": [{\"url\": \"<one of the evidence URLs>\", "
        "\"sentence\": \"<a sentence copied VERBATIM from that evidence's TEXT>\"}]}. "
        "Every citation sentence must be an exact substring of the evidence text. "
        "For supported/contradicted you must provide at least one citation.\n\n"
        f"CLAIM: {state['claim_text']}\n\nEVIDENCE:\n{evidence_block}"
    )
    grounding: dict = {"verdict": "insufficient", "confidence": 0.0, "reasoning": "", "citations": []}
    try:
        resp = await deps.client.chat.completions.create(
            model=deps.model_ground,
            messages=[
                {"role": "system", "content": "You are a fact-checker. Output only valid JSON."},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=800,
        )
        record_usage(getattr(resp, "usage", None))
        parsed = _parse_json(resp.choices[0].message.content)
        if parsed:
            grounding = {
                "verdict": str(parsed.get("verdict", "insufficient")).strip().lower(),
                "confidence": float(parsed.get("confidence", 0.0) or 0.0),
                "reasoning": str(parsed.get("reasoning", "")).strip(),
                "citations": parsed.get("citations", []) or [],
            }
    except Exception:
        pass
    state["grounding"] = grounding
    return state


@trace("reformulate")
async def reformulate(state: dict, deps: Deps) -> dict:
    """Guarded retry reset: bump the retry counter, remember the spent query,
    and clear query/evidence/grounding so the pipeline re-runs with a new angle."""
    state["retries"] += 1
    if state["query"]:
        state["prev_queries"].append(state["query"])
    state["query"] = None
    state["evidence"] = None
    state["grounding"] = None
    return state


# ── Grounding validation (pure; shared with the controller's router) ──────────


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").lower()).strip()


def _grounded_in_evidence(sentence: str, evidence_text: str) -> bool:
    """A cited sentence counts as grounded only if it genuinely comes from the
    evidence: an exact normalized substring, or >=80% token overlap (tolerates
    minor whitespace/quote munging without permitting free paraphrase)."""
    n_sent, n_ev = _normalize(sentence), _normalize(evidence_text)
    if not n_sent or len(n_sent) < 8:
        return False
    if n_sent in n_ev:
        return True
    sent_tokens = [t for t in re.findall(r"\w+", n_sent) if len(t) > 2]
    if len(sent_tokens) < 4:
        return False
    ev_tokens = set(re.findall(r"\w+", n_ev))
    hits = sum(1 for t in sent_tokens if t in ev_tokens)
    return hits / len(sent_tokens) >= 0.8


def validated_spans(state: dict) -> list[EvidenceSpan]:
    """Turn the LLM's raw citations into EvidenceSpans, keeping only those whose
    URL is a real retrieved source AND whose sentence is grounded in that
    source's text. This is the anti-hallucination gate before a Verdict exists."""
    grounding = state.get("grounding") or {}
    evidence = state.get("evidence") or []
    by_url = {e["url"]: e for e in evidence}
    spans: list[EvidenceSpan] = []
    seen: set[tuple[str, str]] = set()
    for cite in grounding.get("citations", []):
        if not isinstance(cite, dict):
            continue
        url = str(cite.get("url", "")).strip()
        sentence = str(cite.get("sentence", "")).strip()
        if not url or not sentence:
            continue
        ev = by_url.get(url)
        if ev is None:  # tolerate partial/normalized URL mismatch
            ev = next((e for e in evidence if url in e["url"] or e["url"] in url), None)
        if ev is None:
            continue
        if not _grounded_in_evidence(sentence, ev["snippet"]):
            continue
        key = (ev["url"], _normalize(sentence))
        if key in seen:
            continue
        seen.add(key)
        spans.append(EvidenceSpan(
            url=ev["url"],
            sentence=sentence,
            title=ev.get("title", ""),
            tier=ev.get("tier", 0),
            tier_name=ev.get("tier_name", "Unverified"),
            trusted=ev.get("trusted", False),
            relevance=ev.get("relevance", 0.7),
        ))
    return spans


def grounding_acceptable(state: dict) -> bool:
    """True only if the grounding is a confident supported/contradicted call
    backed by at least one validated evidence span."""
    grounding = state.get("grounding") or {}
    label = grounding.get("verdict")
    if label not in ("supported", "contradicted"):
        return False
    if float(grounding.get("confidence", 0.0) or 0.0) < MIN_GROUNDING_CONFIDENCE:
        return False
    return len(validated_spans(state)) >= 1


@trace("emit_verdict")
async def emit_verdict(state: dict, deps: Deps) -> dict:
    """Build the final Verdict. Re-validates grounding independently of the
    router: a hard verdict is only emitted when validated spans exist, then the
    tier policy is applied. Everything else falls back to INSUFFICIENT."""
    grounding = state.get("grounding") or {}
    spans = validated_spans(state)
    common = {
        "iterations": state["iterations"],
        "retries": state["retries"],
        "query": state.get("query") or "",
    }

    if grounding_acceptable(state) and spans:
        label = VerdictLabel.SUPPORTED if grounding["verdict"] == "supported" else VerdictLabel.CONTRADICTED
        verdict = Verdict(
            claim_id=state["claim_id"],
            claim_text=state["claim_text"],
            label=label,
            confidence=max(0.0, min(1.0, float(grounding.get("confidence", 0.0)))),
            evidence=spans,
            reasoning=grounding.get("reasoning", ""),
            **common,
        )
        verdict = apply_tier_policy(verdict)
    else:
        if not (state.get("evidence") or []):
            reason = "No usable evidence was retrieved for this claim."
        elif grounding.get("verdict") == "insufficient":
            reason = grounding.get("reasoning") or "Retrieved evidence does not directly address the claim."
        else:
            reason = "Grounding could not be validated against the retrieved evidence."
        verdict = insufficient(state["claim_text"], reason, **common)

    state["verdict"] = verdict
    return state
