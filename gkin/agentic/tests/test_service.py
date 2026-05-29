"""Stdlib tests for the batch service: cache, dedupe, per-article cap.

Run: python -m gkin.agentic.tests.test_service
"""

from __future__ import annotations

import asyncio
import tempfile
from pathlib import Path

from gkin.agentic.cache import VerdictCache
from gkin.agentic.service import verify_claims
from gkin.agentic.tests.test_controller import FakeClient, make_deps


def _supported_client():
    sentence = "NASA confirmed the presence of water on the sunlit surface of the Moon in 2020."
    return FakeClient(grounding=(
        '{"verdict":"supported","confidence":0.92,"reasoning":"r",'
        f'"citations":[{{"url":"https://nasa.gov/moon","sentence":"{sentence}"}}]}}'
    ))


def test_dedupe_runs_claim_once():
    client = _supported_client()
    deps = make_deps(client)
    claims = ["Water on the Moon", "Water on the Moon", "Water on the Moon"]
    out = asyncio.run(verify_claims(claims, deps, cache=None, max_claims=5))
    assert len(out) == 3
    assert all(r["label"] == "SUPPORTED" for r in out)
    # Only one ground call despite three identical claims.
    ground_calls = sum(1 for _, p in client.calls if "EVIDENCE:" in p or "fact-checker" in p)
    assert ground_calls == 1, client.calls


def test_per_article_cap_skips_extra_claims():
    client = _supported_client()
    deps = make_deps(client)
    claims = [f"distinct claim number {i}" for i in range(8)]
    out = asyncio.run(verify_claims(claims, deps, cache=None, max_claims=3))
    assert len(out) == 8
    processed = [r for r in out if "skipped_claim_cap" not in r["flags"]]
    skipped = [r for r in out if "skipped_claim_cap" in r["flags"]]
    assert len(processed) == 3, len(processed)
    assert len(skipped) == 5, len(skipped)
    assert all(r["label"] == "INSUFFICIENT" for r in skipped)


def test_cache_hit_skips_loop():
    with tempfile.TemporaryDirectory() as d:
        cache = VerdictCache(path=Path(d) / "c.json")
        deps1 = make_deps(_supported_client())
        out1 = asyncio.run(verify_claims(["Water on the Moon"], deps1, cache=cache))
        assert out1[0]["label"] == "SUPPORTED"
        assert out1[0]["cached"] is False

        # Second run: fresh client that would error if its loop actually ran.
        class Boom(FakeClient):
            def _next(self, model, messages):
                raise AssertionError("loop should not run on cache hit")

        deps2 = make_deps(Boom())
        out2 = asyncio.run(verify_claims(["Water on the Moon"], deps2, cache=cache))
        assert out2[0]["label"] == "SUPPORTED"
        assert out2[0]["cached"] is True


def test_force_refresh_bypasses_cache():
    with tempfile.TemporaryDirectory() as d:
        cache = VerdictCache(path=Path(d) / "c.json")
        asyncio.run(verify_claims(["Water on the Moon"], make_deps(_supported_client()), cache=cache))
        out = asyncio.run(verify_claims(
            ["Water on the Moon"], make_deps(_supported_client()),
            cache=cache, force_refresh=True,
        ))
        assert out[0]["cached"] is False


def test_empty_claim_placeholder():
    deps = make_deps(_supported_client())
    out = asyncio.run(verify_claims(["", "   "], deps, cache=None))
    assert len(out) == 2
    assert all(r["label"] == "INSUFFICIENT" for r in out)
    assert all("skipped_empty" in r["flags"] for r in out)


def test_order_preserved():
    deps = make_deps(_supported_client())
    claims = ["", "Water on the Moon", "another distinct claim"]
    out = asyncio.run(verify_claims(claims, deps, cache=None, max_claims=5))
    assert "skipped_empty" in out[0]["flags"]
    assert out[1]["claim_text"] == "Water on the Moon"
    assert out[2]["claim_text"] == "another distinct claim"


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
