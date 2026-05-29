"""Batch entry point for verifying a set of claims.

Wraps the controller with the three things a real request needs: the claim-hash
cache (so duplicate claims don't re-fire external calls), in-batch dedupe, and a
hard per-article cap on how many claims actually run the loop — so one article
can't fan out into hundreds of search/scrape/ground calls.

Returns one verdict dict per input claim, in input order, regardless of dedupe
or capping, so callers can zip results back onto their claim list.
"""

from __future__ import annotations

import asyncio
from typing import Optional

from .cache import VerdictCache
from .controller import run_claim
from .nodes import Deps
from .verdict import insufficient

DEFAULT_MAX_CLAIMS = 5     # per-article cap; configurable per request
DEFAULT_CONCURRENCY = 4    # parallel claim verifications


async def verify_claims(
    claims: list[str],
    deps: Deps,
    *,
    cache: Optional[VerdictCache] = None,
    max_claims: int = DEFAULT_MAX_CLAIMS,
    force_refresh: bool = False,
    concurrency: int = DEFAULT_CONCURRENCY,
) -> list[dict]:
    """Verify ``claims`` and return verdict dicts aligned to the input order.

    - Blank claims -> INSUFFICIENT placeholder (skipped_empty).
    - Duplicate claims -> verified once, result fanned back out.
    - Claims beyond ``max_claims`` distinct claims -> INSUFFICIENT placeholder
      (skipped_claim_cap), never sent to the loop.
    - Cache hits short-circuit the loop entirely (unless force_refresh).
    """
    cleaned = [(i, (c or "").strip()) for i, c in enumerate(claims)]

    # Distinct, non-empty claims in first-seen order, capped.
    seen: dict[str, str] = {}
    for _, text in cleaned:
        if text and text not in seen:
            seen[text] = text
    distinct = list(seen)
    to_process = set(distinct[:max_claims])
    over_cap = set(distinct[max_claims:])

    sem = asyncio.Semaphore(max(1, concurrency))

    async def _verify_one(text: str) -> dict:
        if cache and not force_refresh:
            hit = await cache.get(text)
            if hit is not None:
                hit = {**hit, "cached": True}
                return hit
        async with sem:
            verdict = await run_claim(text, deps)
        result = verdict.model_dump(mode="json")
        result["cached"] = False
        if cache:
            await cache.put(text, verdict.model_dump(mode="json"))
        return result

    results = await asyncio.gather(*[_verify_one(t) for t in to_process])
    by_text = {t: r for t, r in zip(to_process, results)}

    out: list[dict] = []
    for _, text in cleaned:
        if not text:
            out.append(_placeholder(text, "skipped_empty", "Empty claim text."))
        elif text in by_text:
            out.append(by_text[text])
        elif text in over_cap:
            out.append(_placeholder(
                text, "skipped_claim_cap",
                f"Skipped: exceeded the per-article cap of {max_claims} verified claims.",
            ))
        else:  # shouldn't happen, but stay total
            out.append(_placeholder(text, "skipped_unknown", "Claim was not processed."))
    return out


def _placeholder(text: str, flag: str, reason: str) -> dict:
    v = insufficient(text, reason, flags=[flag]).model_dump(mode="json")
    v["cached"] = False
    return v
