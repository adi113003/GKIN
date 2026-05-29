"""Optional keyed search backends (Brave, Google) for the agentic loop.

Free DuckDuckGo scraping has unstable ranking, so a well-sourced page that
exists may not surface in a given run — which is why some true/false claims
land on INSUFFICIENT. Keyed APIs (Brave Web Search, Google Programmable Search)
return stable, higher-quality results.

Each backend is a *sync* ``Callable[[str, int], list[dict]]`` returning the same
shape as ``server._ddg_search`` ({title, snippet, url}), so it drops straight
into ``Deps.ddg_search`` (which the loop calls via ``asyncio.to_thread``). All
backends are key-gated and fail soft: a missing key returns ``[]`` and an HTTP
error returns ``[{"error": ...}]``, so ``retrieve_evidence`` just moves on.

Env vars:
  BRAVE_SEARCH_API_KEY      -> enables the Brave backend
  GOOGLE_SEARCH_API_KEY     -> Google Programmable Search (Custom Search JSON API)
  GOOGLE_SEARCH_CX          -> the Programmable Search engine id (cx)
"""

from __future__ import annotations

import os
from typing import Callable

import httpx

SearchFn = Callable[[str, int], list]


def brave_search(query: str, max_results: int = 10) -> list[dict]:
    key = os.environ.get("BRAVE_SEARCH_API_KEY")
    if not key:
        return []
    try:
        resp = httpx.get(
            "https://api.search.brave.com/res/v1/web/search",
            headers={"X-Subscription-Token": key, "Accept": "application/json"},
            params={"q": query, "count": min(max_results, 20), "search_lang": "en", "safesearch": "moderate"},
            timeout=10.0,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:  # noqa: BLE001
        return [{"error": f"brave: {exc}"}]
    out = []
    for item in (data.get("web", {}).get("results", []) or [])[:max_results]:
        out.append({
            "title": item.get("title", ""),
            "snippet": item.get("description", ""),
            "url": item.get("url", ""),
        })
    return out


def google_search(query: str, max_results: int = 10) -> list[dict]:
    key = os.environ.get("GOOGLE_SEARCH_API_KEY")
    cx = os.environ.get("GOOGLE_SEARCH_CX")
    if not key or not cx:
        return []
    try:
        resp = httpx.get(
            "https://www.googleapis.com/customsearch/v1",
            # Custom Search JSON API caps num at 10 per request.
            params={"key": key, "cx": cx, "q": query, "num": min(max_results, 10)},
            timeout=10.0,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:  # noqa: BLE001
        return [{"error": f"google: {exc}"}]
    out = []
    for item in (data.get("items", []) or [])[:max_results]:
        out.append({
            "title": item.get("title", ""),
            "snippet": item.get("snippet", ""),
            "url": item.get("link", ""),
        })
    return out


def available() -> dict:
    """Which keyed backends are configured in the environment."""
    return {
        "brave": bool(os.environ.get("BRAVE_SEARCH_API_KEY")),
        "google": bool(os.environ.get("GOOGLE_SEARCH_API_KEY") and os.environ.get("GOOGLE_SEARCH_CX")),
    }


def chained(*backends: SearchFn) -> SearchFn:
    """Combine backends: return the first one that yields non-empty, error-free
    results. Lets you prefer a keyed API and fall back to DuckDuckGo."""

    def _search(query: str, max_results: int = 10) -> list[dict]:
        fallback: list = []
        for backend in backends:
            try:
                res = backend(query, max_results)
            except Exception:  # noqa: BLE001
                continue
            clean = [r for r in (res or []) if isinstance(r, dict) and not r.get("error") and r.get("url")]
            if clean:
                return clean
            fallback = res or fallback
        return fallback

    return _search


def resolve_backend(name: str | None, ddg: SearchFn) -> SearchFn:
    """Pick a search backend.

    name: 'brave' | 'google' | 'ddg' | 'auto' (default).
    ddg: the injected DuckDuckGo callable (server._ddg_search), always the final
    fallback so search never hard-fails if a keyed provider is down/unset.
    'auto' prefers Brave, then Google, then DDG.
    """
    name = (name or "auto").lower()
    if name == "ddg":
        return ddg
    if name == "brave":
        return chained(brave_search, ddg)
    if name == "google":
        return chained(google_search, ddg)
    return chained(brave_search, google_search, ddg)
