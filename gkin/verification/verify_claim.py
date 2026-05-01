"""Retrieval-grounded per-claim verification for Block 5."""

from __future__ import annotations

import asyncio
import hashlib
import json
import os
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import httpx
from groq import AsyncGroq
from pydantic import BaseModel, Field, ValidationError, validator


MODEL_FAST = "llama-3.1-8b-instant"
MODEL_REASON = "deepseek-r1-distill-llama-70b"
CACHE_TTL = timedelta(days=30)
CACHE_PATH = Path(os.environ.get("GKIN_VERIFY_CACHE", ".gkin_cache/verification_cache.json"))

_client: Optional[AsyncGroq] = None
_cache_lock = asyncio.Lock()


class VerificationError(Exception):
    """Raised for hard verification failures such as malformed input."""


class Evidence(BaseModel):
    url: str
    title: str = ""
    snippet: str = ""
    source_type: str = "news"
    relevance: float = Field(default=0.0, ge=0.0, le=1.0)


class GroundingResult(BaseModel):
    verdict: str
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str

    @validator("verdict")
    def verdict_allowed(cls, value: str) -> str:
        if value not in {"supported", "contradicted", "insufficient"}:
            raise ValueError("verdict must be supported, contradicted, or insufficient")
        return value


def configure_verifier(client: Optional[AsyncGroq]) -> None:
    global _client
    _client = client


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _iso_now() -> str:
    return _utc_now().replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _claim_hash(claim_text: str) -> str:
    return hashlib.sha256(claim_text.strip().lower().encode("utf-8")).hexdigest()


def _claim_id(claim_text: str) -> str:
    return "claim_" + _claim_hash(claim_text)[:12]


def _empty_verdict(claim_text: str, reasoning: str = "Insufficient retrieved evidence to verify this claim.") -> dict:
    return {
        "claim_id": _claim_id(claim_text),
        "claim_text": claim_text,
        "verdict": "insufficient",
        "confidence": 0.0,
        "evidence": [],
        "reasoning": reasoning,
        "verified_at": _iso_now(),
    }


async def _load_cache() -> dict:
    if not CACHE_PATH.exists():
        return {}
    try:
        return json.loads(CACHE_PATH.read_text())
    except Exception:
        return {}


async def _write_cache(cache: dict) -> None:
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(cache, indent=2, sort_keys=True))


def _fresh(entry: dict) -> bool:
    raw = entry.get("cached_at")
    if not raw:
        return False
    try:
        cached_at = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return False
    return _utc_now() - cached_at < CACHE_TTL


def _source_type(url: str) -> str:
    host = ""
    try:
        from urllib.parse import urlparse

        host = urlparse(url).netloc.lower()
    except Exception:
        pass
    if "wikipedia.org" in host:
        return "wiki"
    if any(domain in host for domain in ("snopes.com", "factcheck.org", "politifact.com", "fullfact.org", "reuters.com/fact-check")):
        return "fact_check"
    if any(domain in host for domain in (".gov", ".edu", "who.int", "un.org", "fda.gov", "cdc.gov")):
        return "primary"
    return "news"


def _dedupe_evidence(items: list[dict]) -> list[dict]:
    seen = set()
    out = []
    for item in items:
        url = str(item.get("url", "")).strip()
        if not url or url in seen:
            continue
        seen.add(url)
        out.append(item)
        if len(out) >= 5:
            break
    return out


async def _rewrite_query(client: AsyncGroq, claim_text: str) -> str:
    try:
        resp = await client.chat.completions.create(
            model=MODEL_FAST,
            messages=[
                {
                    "role": "user",
                    "content": (
                        "Rewrite this factual claim as a concise web search query "
                        "(max 10 words). Return only the query, no quotes or punctuation.\n\n"
                        f"Claim: {claim_text[:600]}"
                    ),
                }
            ],
            temperature=0.1,
            max_tokens=40,
        )
        query = (resp.choices[0].message.content or "").strip()
        query = re.sub(r"[\"'`]", "", query)
        return query[:180] or claim_text[:180]
    except Exception:
        return claim_text[:180]


async def _google_fact_check(query: str) -> list[dict]:
    key = os.environ.get("GOOGLE_FACT_CHECK_API_KEY")
    if not key:
        return []
    url = "https://factchecktools.googleapis.com/v1alpha1/claims:search"
    params = {"query": query, "key": key, "pageSize": 5, "languageCode": "en"}
    async with httpx.AsyncClient(timeout=10.0) as http:
        resp = await http.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()
    evidence = []
    for claim in data.get("claims", []):
        for review in claim.get("claimReview", [])[:2]:
            review_url = review.get("url", "")
            publisher = review.get("publisher", {}).get("name", "")
            title = review.get("title") or claim.get("text", "")
            rating = review.get("textualRating", "")
            evidence.append(
                {
                    "url": review_url,
                    "title": title,
                    "snippet": f"{publisher}: {rating}".strip(": "),
                    "source_type": "fact_check",
                    "relevance": 0.95,
                }
            )
    return _dedupe_evidence(evidence)


async def _brave_search(query: str) -> list[dict]:
    key = os.environ.get("BRAVE_SEARCH_API_KEY")
    if not key:
        return []
    headers = {"X-Subscription-Token": key, "Accept": "application/json"}
    params = {"q": query, "count": 5, "search_lang": "en", "safesearch": "moderate"}
    async with httpx.AsyncClient(timeout=10.0) as http:
        resp = await http.get("https://api.search.brave.com/res/v1/web/search", headers=headers, params=params)
        resp.raise_for_status()
        data = resp.json()
    evidence = []
    for item in data.get("web", {}).get("results", [])[:5]:
        url = item.get("url", "")
        evidence.append(
            {
                "url": url,
                "title": item.get("title", ""),
                "snippet": item.get("description", ""),
                "source_type": _source_type(url),
                "relevance": 0.75,
            }
        )
    return _dedupe_evidence(evidence)


async def _retrieve(query: str) -> list[dict]:
    evidence = await _google_fact_check(query)
    if not evidence:
        evidence = await _brave_search(query)
    return evidence[:5]


def _reasoning_cites_evidence(reasoning: str, evidence: list[dict]) -> bool:
    if not reasoning:
        return False
    urls = [item["url"] for item in evidence if item.get("url")]
    return any(url in reasoning for url in urls)


async def _ground(client: AsyncGroq, claim_text: str, evidence: list[dict]) -> GroundingResult:
    evidence_lines = "\n".join(
        f"- URL: {item['url']}\n  Title: {item.get('title', '')}\n  Snippet: {item.get('snippet', '')}"
        for item in evidence
    )
    prompt = (
        "Given a claim and retrieved evidence, return a JSON object with keys "
        "verdict, confidence, and reasoning. verdict must be one of supported, "
        "contradicted, insufficient. Cite evidence by full URL in reasoning. "
        "If the evidence does not directly address the claim, return insufficient. "
        "Do not use training knowledge.\n\n"
        f"Claim: {claim_text}\n\nEvidence:\n{evidence_lines}"
    )
    resp = await client.chat.completions.create(
        model=MODEL_REASON,
        messages=[
            {"role": "system", "content": "You are a fact-checker. Output only valid JSON."},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.1,
        max_tokens=700,
    )
    raw = resp.choices[0].message.content or "{}"
    try:
        return GroundingResult(**json.loads(raw))
    except (json.JSONDecodeError, ValidationError) as first_error:
        retry = await client.chat.completions.create(
            model=MODEL_REASON,
            messages=[
                {"role": "system", "content": "Output only valid JSON matching: verdict, confidence, reasoning."},
                {"role": "user", "content": prompt},
                {"role": "assistant", "content": raw},
                {"role": "user", "content": f"Fix the JSON validation error and return only valid JSON: {first_error}"},
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=700,
        )
        return GroundingResult(**json.loads(retry.choices[0].message.content or "{}"))


async def verify_claim(claim_text: str, *, force_refresh: bool = False) -> dict:
    claim_text = claim_text.strip()
    if not claim_text:
        raise VerificationError("claim_text is required")

    key = _claim_hash(claim_text)
    async with _cache_lock:
        cache = await _load_cache()
        cached = cache.get(key)
        if cached and not force_refresh and _fresh(cached):
            return cached["verdict"]

    if _client is None:
        raise VerificationError("Verifier client is not configured")

    query = await _rewrite_query(_client, claim_text)
    try:
        evidence = await _retrieve(query)
    except httpx.HTTPError as exc:
        raise VerificationError(f"Search API failed: {exc}") from exc

    if len(evidence) < 2:
        verdict = _empty_verdict(claim_text)
    else:
        try:
            grounded = await _ground(_client, claim_text, evidence)
        except Exception:
            verdict = _empty_verdict(claim_text, "Grounding model could not produce a valid evidence-based verdict.")
        else:
            if grounded.verdict == "insufficient" or not _reasoning_cites_evidence(grounded.reasoning, evidence):
                verdict = _empty_verdict(claim_text)
            else:
                verdict = {
                    "claim_id": _claim_id(claim_text),
                    "claim_text": claim_text,
                    "verdict": grounded.verdict,
                    "confidence": grounded.confidence,
                    "evidence": [Evidence(**item).dict() for item in evidence],
                    "reasoning": grounded.reasoning,
                    "verified_at": _iso_now(),
                }

    async with _cache_lock:
        cache = await _load_cache()
        cache[key] = {"cached_at": _iso_now(), "verdict": verdict}
        await _write_cache(cache)
    return verdict
