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
import time
import urllib.parse
from typing import Callable

import httpx

SearchFn = Callable[[str, int], list]

# ── GDELT (keyless, global news coverage + dated anchors) ─────────────────────
# GDELT DOC 2.0 API is free and needs no key, but enforces a strict ~1 request
# per 5 seconds limit (HTTP 429 + a plaintext warning otherwise). So GDELT is
# offered as an OPT-IN backend and used mainly for the single-call timeline —
# it is deliberately NOT folded into the multi-call 'auto' path.
_GDELT_DOC = "https://api.gdeltproject.org/api/v2/doc/doc"
_GDELT_MIN_INTERVAL = 5.0  # seconds between GDELT calls (their policy)
_GDELT_UA = "GKIN-TruthNavigator/1.0 (media-literacy fact-check research)"
_gdelt_last_call = 0.0


def _gdelt_throttle() -> None:
    """Block (in the worker thread) just long enough to honor GDELT's 1-req/5s
    policy. Cheap when calls are already spaced (e.g. one timeline call)."""
    global _gdelt_last_call
    gap = _GDELT_MIN_INTERVAL - (time.monotonic() - _gdelt_last_call)
    if gap > 0:
        time.sleep(min(gap, _GDELT_MIN_INTERVAL))
    _gdelt_last_call = time.monotonic()


def _gdelt_date_to_iso(seendate: str) -> str:
    """GDELT seendate 'YYYYMMDDTHHMMSSZ' -> 'YYYY-MM-DD' (or '' if unparseable)."""
    s = (seendate or "").strip()
    return f"{s[0:4]}-{s[4:6]}-{s[6:8]}" if len(s) >= 8 and s[:8].isdigit() else ""


def _gdelt_query(text: str, max_terms: int = 6) -> str:
    """Build a GDELT-friendly query: GDELT ANDs bare terms and chokes on long
    sentences/punctuation, so keep the first few meaningful words only."""
    cleaned = re.sub(r"[^\w\s]", " ", text or "")
    return " ".join(cleaned.split()[:max_terms]).strip()


def _gdelt_doc(query: str, *, mode: str, maxrecords: int, sort: str,
               timespan: str | None = None) -> list[dict]:
    """One GDELT DOC ArtList call, returning the raw 'articles' list. Fail-soft:
    raises nothing — returns [] on rate-limit / HTTP / parse error."""
    q = _gdelt_query(query)
    if not q:
        return []
    _gdelt_throttle()
    params = {"query": q, "mode": mode, "maxrecords": max(1, min(maxrecords, 250)),
              "format": "json", "sort": sort}
    if timespan:
        params["timespan"] = timespan
    try:
        resp = httpx.get(_GDELT_DOC, params=params,
                         headers={"User-Agent": _GDELT_UA}, timeout=15.0)
        if resp.status_code == 429:
            return []  # rate limited — caller falls back
        resp.raise_for_status()
        return (resp.json() or {}).get("articles", []) or []
    except Exception:  # noqa: BLE001  (incl. non-JSON warning bodies)
        return []


def gdelt_search(query: str, max_results: int = 10) -> list[dict]:
    """Keyless GDELT news-coverage backend (SearchFn shape: {title, snippet, url},
    plus bonus date/domain keys that downstream code may ignore). Opt-in only —
    honors the 5s rate limit and fails soft to []. Best for low-volume use."""
    arts = _gdelt_doc(query, mode="artlist", maxrecords=min(max(max_results, 1), 75),
                      sort="hybridrel")
    if not arts:
        return []
    out: list[dict] = []
    for a in arts[:max_results]:
        url = a.get("url", "")
        if not url:
            continue
        domain, date = a.get("domain", ""), _gdelt_date_to_iso(a.get("seendate", ""))
        snippet = " · ".join(x for x in (domain, a.get("sourcecountry", ""), date) if x)
        out.append({"title": a.get("title", "") or domain or url, "snippet": snippet,
                    "url": url, "date": date, "domain": domain})
    return out


def gdelt_timeline(query: str, max_records: int = 40, timespan: str = "18m") -> list[dict]:
    """Dated cross-outlet coverage anchors for a claim, oldest-first, as
    [{date, hostname, url, title}] — the shape server._build_timeline wants.
    Keyless, rate-limit aware, fail-soft to []."""
    arts = _gdelt_doc(query, mode="artlist", maxrecords=max_records, sort="dateasc",
                      timespan=timespan)
    out: list[dict] = []
    seen: set[str] = set()
    for a in arts:
        url = a.get("url", "")
        if not url or url in seen:
            continue
        seen.add(url)
        out.append({"date": _gdelt_date_to_iso(a.get("seendate", "")),
                    "hostname": a.get("domain", ""), "url": url,
                    "title": a.get("title", "") or a.get("domain", "") or url})
    out.sort(key=lambda e: e["date"] or "9999")
    return out


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
    """Which backends are usable. Wikipedia and GDELT are keyless so always
    available (GDELT is opt-in due to its rate limit; see resolve_backend)."""
    return {
        "wikipedia": True,
        "gdelt": True,
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
    if name == "gdelt":
        # Opt-in: GDELT first (dated global coverage), DDG as the safety net.
        # Kept OUT of 'auto' because 'auto' fires several searches per analysis
        # and GDELT's 1-req/5s limit would throttle/429 the whole run.
        return chained(gdelt_search, ddg)
    if name == "brave":
        return chained(brave_search, ddg)
    if name == "google":
        return chained(google_search, ddg)
    return merged(chained(brave_search, google_search, ddg), wikipedia_search)
