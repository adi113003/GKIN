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
import re
import urllib.parse
from typing import Callable

import httpx

SearchFn = Callable[[str, int], list]


def wikipedia_search(query: str, max_results: int = 10) -> list[dict]:
    """Free, keyless MediaWiki search. No signup, no rate cost.

    Returns canonical en.wikipedia.org article URLs (which trafilatura scrapes
    cleanly) with HTML stripped from the match snippet. Wikipedia is a single
    domain, so use it MERGED with a general backend rather than alone."""
    try:
        resp = httpx.get(
            "https://en.wikipedia.org/w/api.php",
            params={
                "action": "query", "list": "search", "srsearch": query,
                "format": "json", "srlimit": min(max_results, 20), "srprop": "snippet",
            },
            # Wikimedia API policy asks for a descriptive User-Agent.
            headers={"User-Agent": "GKIN-TruthNavigator/1.0 (fact-check research)"},
            timeout=10.0,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:  # noqa: BLE001
        return [{"error": f"wikipedia: {exc}"}]
    out = []
    for item in (data.get("query", {}).get("search", []) or [])[:max_results]:
        title = item.get("title", "")
        snippet = re.sub(r"<[^>]+>", "", item.get("snippet", "") or "")
        snippet = (
            snippet.replace("&quot;", '"').replace("&amp;", "&")
            .replace("&#39;", "'").replace("&nbsp;", " ").strip()
        )
        url = "https://en.wikipedia.org/wiki/" + urllib.parse.quote(title.replace(" ", "_"))
        out.append({"title": title, "snippet": snippet, "url": url})
    return out


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
    """Which backends are usable. Wikipedia is keyless so always available."""
    return {
        "wikipedia": True,
        "brave": bool(os.environ.get("BRAVE_SEARCH_API_KEY")),
        "google": bool(os.environ.get("GOOGLE_SEARCH_API_KEY") and os.environ.get("GOOGLE_SEARCH_CX")),
    }


def merged(*backends: SearchFn) -> SearchFn:
    """Concatenate results from every backend, deduped by URL, preserving order.

    Use this to SUPPLEMENT a general web search with a single-domain source like
    Wikipedia, rather than letting one replace the other (which chained() does)."""

    def _search(query: str, max_results: int = 10) -> list[dict]:
        seen: set[str] = set()
        out: list[dict] = []
        for backend in backends:
            try:
                res = backend(query, max_results)
            except Exception:  # noqa: BLE001
                continue
            for r in (res or []):
                if not isinstance(r, dict) or r.get("error") or not r.get("url"):
                    continue
                if r["url"] in seen:
                    continue
                seen.add(r["url"])
                out.append(r)
        return out

    return _search


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

    name: 'auto' (default) | 'wikipedia' | 'brave' | 'google' | 'ddg'.
    ddg: the injected DuckDuckGo callable (server._ddg_search), always the final
    fallback so search never hard-fails if a keyed provider is down/unset.

    'auto' = the best available general web search (Brave -> Google -> DDG)
    MERGED with Wikipedia, so every run gets diverse web sources plus reliable
    encyclopedic coverage. Keyed providers stay optional; nothing requires a key.
    """
    name = (name or "auto").lower()
    if name == "ddg":
        return ddg
    if name == "wikipedia":
        return wikipedia_search
    if name == "brave":
        return chained(brave_search, ddg)
    if name == "google":
        return chained(google_search, ddg)
    return merged(chained(brave_search, google_search, ddg), wikipedia_search)
