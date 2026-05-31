"""Shared helpers for provider adapters."""

from __future__ import annotations

import re
from typing import Any, Optional

URL_RE = re.compile(r"https?://[^\s\)\]\}>\"']+")


def result(
    provider: str,
    prompt_id: str,
    answer: str = "",
    citations: Optional[list[dict]] = None,
    metadata: Optional[dict] = None,
    error: Optional[str] = None,
) -> dict:
    """Build the common provider-result structure the runner + scorer expect."""
    return {
        "provider": provider,
        "prompt_id": prompt_id,
        "answer": answer or "",
        "citations": citations or [],
        "metadata": metadata or {},
        "error": error,
    }


def extract_urls(text: str) -> list[str]:
    """Pull bare URLs out of free text (competitor answers cite inline)."""
    if not text:
        return []
    seen, out = set(), []
    for u in URL_RE.findall(text):
        u = u.rstrip(".,);")
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out


def trim(text: str, limit: int = 4000) -> str:
    text = (text or "").strip()
    return text if len(text) <= limit else text[:limit] + " …[truncated]"
