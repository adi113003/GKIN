"""Stdlib tests for the optional search backends.

Run: python -m gkin.agentic.tests.test_search
"""

from __future__ import annotations

import os
from contextlib import contextmanager

from gkin.agentic import search


@contextmanager
def _env(**kv):
    """Temporarily set/clear env vars (value None clears)."""
    saved = {k: os.environ.get(k) for k in kv}
    try:
        for k, v in kv.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v
        yield
    finally:
        for k, v in saved.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v


def test_brave_returns_empty_without_key():
    with _env(BRAVE_SEARCH_API_KEY=None):
        assert search.brave_search("anything") == []


def test_google_returns_empty_without_keys():
    with _env(GOOGLE_SEARCH_API_KEY=None, GOOGLE_SEARCH_CX=None):
        assert search.google_search("anything") == []
    # key but no cx -> still empty
    with _env(GOOGLE_SEARCH_API_KEY="k", GOOGLE_SEARCH_CX=None):
        assert search.google_search("anything") == []


def test_available_reflects_env():
    with _env(BRAVE_SEARCH_API_KEY="k", GOOGLE_SEARCH_API_KEY=None, GOOGLE_SEARCH_CX=None):
        a = search.available()
        assert a["brave"] is True
        assert a["google"] is False
    with _env(GOOGLE_SEARCH_API_KEY="k", GOOGLE_SEARCH_CX="cx", BRAVE_SEARCH_API_KEY=None):
        a = search.available()
        assert a["brave"] is False
        assert a["google"] is True


def test_chained_returns_first_nonempty():
    def empty(q, n):
        return []

    def errs(q, n):
        return [{"error": "boom"}]

    def good(q, n):
        return [{"title": "t", "snippet": "s", "url": "https://good.example/x"}]

    def other(q, n):
        return [{"title": "t2", "snippet": "s2", "url": "https://other.example/y"}]

    fn = search.chained(empty, errs, good, other)
    out = fn("q", 5)
    assert len(out) == 1
    assert out[0]["url"] == "https://good.example/x"


def test_chained_skips_raising_backend():
    def boom(q, n):
        raise RuntimeError("network down")

    def good(q, n):
        return [{"title": "t", "snippet": "s", "url": "https://good.example/x"}]

    fn = search.chained(boom, good)
    assert fn("q", 5)[0]["url"] == "https://good.example/x"


def test_chained_all_empty_returns_empty():
    fn = search.chained(lambda q, n: [], lambda q, n: [])
    assert fn("q", 5) == []


def test_resolve_backend_routing():
    sentinel_ddg = lambda q, n: [{"title": "ddg", "snippet": "", "url": "https://ddg.example/z"}]

    # ddg -> the raw injected callable
    assert search.resolve_backend("ddg", sentinel_ddg) is sentinel_ddg
    # wikipedia -> the wikipedia backend itself
    assert search.resolve_backend("wikipedia", sentinel_ddg) is search.wikipedia_search

    # brave/google -> chains that fall back to ddg when keys are absent
    with _env(BRAVE_SEARCH_API_KEY=None, GOOGLE_SEARCH_API_KEY=None, GOOGLE_SEARCH_CX=None):
        for name in ("brave", "google"):
            fn = search.resolve_backend(name, sentinel_ddg)
            out = fn("q", 5)
            assert out and out[0]["url"] == "https://ddg.example/z", name


def test_merged_dedupes_and_concatenates():
    def a(q, n):
        return [{"title": "1", "snippet": "", "url": "https://x/1"},
                {"title": "dup", "snippet": "", "url": "https://x/dup"}]

    def b(q, n):
        return [{"title": "dup2", "snippet": "", "url": "https://x/dup"},  # dropped (dup url)
                {"title": "2", "snippet": "", "url": "https://x/2"}]

    out = search.merged(a, b)("q", 5)
    urls = [r["url"] for r in out]
    assert urls == ["https://x/1", "https://x/dup", "https://x/2"], urls


def test_auto_merges_general_with_wikipedia(monkeypatch=None):
    # auto = merged(chained(brave,google,ddg), wikipedia). With no keys, the
    # general chain falls to ddg; wikipedia results are appended.
    sentinel_ddg = lambda q, n: [{"title": "ddg", "snippet": "", "url": "https://ddg.example/z"}]
    search_wiki_orig = search.wikipedia_search
    search.wikipedia_search = lambda q, n=10: [{"title": "W", "snippet": "s", "url": "https://en.wikipedia.org/wiki/W"}]
    try:
        with _env(BRAVE_SEARCH_API_KEY=None, GOOGLE_SEARCH_API_KEY=None, GOOGLE_SEARCH_CX=None):
            fn = search.resolve_backend("auto", sentinel_ddg)
            urls = [r["url"] for r in fn("q", 5)]
        assert "https://ddg.example/z" in urls
        assert "https://en.wikipedia.org/wiki/W" in urls
    finally:
        search.wikipedia_search = search_wiki_orig


def test_wikipedia_parsing_without_network():
    # Monkeypatch httpx.get to return a canned MediaWiki response.
    class FakeResp:
        def raise_for_status(self): pass
        def json(self):
            return {"query": {"search": [
                {"title": "Moon landing", "snippet": "The <span class=\"searchmatch\">Apollo</span> program &quot;landed&quot;"},
                {"title": "Great Wall of China", "snippet": "not visible from the Moon"},
            ]}}

    orig = search.httpx.get
    search.httpx.get = lambda *a, **k: FakeResp()
    try:
        out = search.wikipedia_search("moon", 5)
    finally:
        search.httpx.get = orig
    assert len(out) == 2
    assert out[0]["url"] == "https://en.wikipedia.org/wiki/Moon_landing"
    # HTML stripped, entities decoded
    assert "<span" not in out[0]["snippet"]
    assert '"landed"' in out[0]["snippet"]
    assert "Apollo" in out[0]["snippet"]


def test_wikipedia_error_is_soft():
    orig = search.httpx.get
    def boom(*a, **k):
        raise RuntimeError("offline")
    search.httpx.get = boom
    try:
        out = search.wikipedia_search("x")
    finally:
        search.httpx.get = orig
    assert out == [{"error": "wikipedia: offline"}]


def main():
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    failed = 0
    for t in tests:
        try:
            t()
            print(f"  PASS {t.__name__}")
        except Exception as exc:  # noqa: BLE001
            failed += 1
            print(f"  FAIL {t.__name__}: {exc!r}")
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
