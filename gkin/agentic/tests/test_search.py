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

    # brave/google/auto -> chains that fall back to ddg when keys are absent
    with _env(BRAVE_SEARCH_API_KEY=None, GOOGLE_SEARCH_API_KEY=None, GOOGLE_SEARCH_CX=None):
        for name in ("brave", "google", "auto", None):
            fn = search.resolve_backend(name, sentinel_ddg)
            out = fn("q", 5)
            assert out and out[0]["url"] == "https://ddg.example/z", name


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
