"""Stdlib (no-pytest) tests for the @trace decorator.

Run: python -m gkin.agentic.tests.test_trace
"""

from __future__ import annotations

import asyncio
import io
import json
import logging

from gkin.agentic.trace import (
    current_tokens,
    logger,
    record_usage,
    trace,
)


def _capture():
    """Attach a fresh JSON-capturing handler; return (buffer, detach)."""
    buf = io.StringIO()
    handler = logging.StreamHandler(buf)
    handler.setFormatter(logging.Formatter("%(message)s"))
    prev_handlers = logger.handlers[:]
    prev_level = logger.level
    prev_prop = logger.propagate
    logger.handlers = [handler]
    logger.setLevel(logging.INFO)
    logger.propagate = False

    def detach():
        logger.handlers = prev_handlers
        logger.setLevel(prev_level)
        logger.propagate = prev_prop

    return buf, detach


def _lines(buf):
    return [json.loads(l) for l in buf.getvalue().splitlines() if l.strip()]


def test_emits_one_line_with_latency_and_output():
    buf, detach = _capture()
    try:

        @trace("double")
        async def double(state):
            return {"value": state["value"] * 2}

        out = asyncio.run(double({"value": 21}))
        assert out == {"value": 42}
        records = _lines(buf)
        assert len(records) == 1
        rec = records[0]
        assert rec["node"] == "double"
        assert rec["ok"] is True
        assert rec["error"] is None
        assert isinstance(rec["latency_ms"], (int, float))
        assert rec["output"] == {"value": 42}
    finally:
        detach()


def test_captures_groq_usage_tokens():
    buf, detach = _capture()
    try:

        class FakeUsage:
            prompt_tokens = 120
            completion_tokens = 30
            total_tokens = 150

        @trace("grounder")
        async def grounder(state):
            # Simulate two Groq calls inside one node.
            record_usage(FakeUsage())
            record_usage({"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15})
            return "ok"

        asyncio.run(grounder({}))
        rec = _lines(buf)[0]
        assert rec["tokens"]["prompt_tokens"] == 130, rec["tokens"]
        assert rec["tokens"]["completion_tokens"] == 35, rec["tokens"]
        assert rec["tokens"]["total_tokens"] == 165, rec["tokens"]
        assert rec["tokens"]["calls"] == 2, rec["tokens"]
    finally:
        detach()


def test_failure_is_logged_and_reraised():
    buf, detach = _capture()
    try:

        @trace()
        async def boom(_state):
            raise ValueError("kaboom")

        raised = False
        try:
            asyncio.run(boom({}))
        except ValueError:
            raised = True
        assert raised, "exception must propagate"
        rec = _lines(buf)[0]
        assert rec["ok"] is False
        assert "kaboom" in rec["error"]
        assert rec["output"] is None
    finally:
        detach()


def test_tokens_isolated_between_concurrent_nodes():
    buf, detach = _capture()
    try:

        @trace("node_a")
        async def node_a():
            record_usage({"total_tokens": 100, "prompt_tokens": 100, "completion_tokens": 0})
            await asyncio.sleep(0.01)
            # After awaiting, our bucket must still only hold our own tokens.
            return current_tokens()["total_tokens"]

        @trace("node_b")
        async def node_b():
            await asyncio.sleep(0.005)
            record_usage({"total_tokens": 7, "prompt_tokens": 7, "completion_tokens": 0})
            return current_tokens()["total_tokens"]

        async def run():
            return await asyncio.gather(node_a(), node_b())

        a_total, b_total = asyncio.run(run())
        assert a_total == 100, a_total
        assert b_total == 7, b_total
        totals = sorted(r["tokens"]["total_tokens"] for r in _lines(buf))
        assert totals == [7, 100], totals
    finally:
        detach()


def test_record_usage_noop_outside_trace():
    # Must not raise when called with no active node.
    record_usage({"total_tokens": 5})
    assert current_tokens() is None


def test_long_strings_truncated_in_summary():
    buf, detach = _capture()
    try:

        @trace("echo")
        async def echo(_state):
            return "x" * 5000

        asyncio.run(echo({"big": "y" * 5000}))
        rec = _lines(buf)[0]
        assert "chars)" in rec["output"]
        assert len(rec["output"]) < 400
    finally:
        detach()


def test_sync_node_supported():
    buf, detach = _capture()
    try:

        @trace("sync_node")
        def sync_node(state):
            return state["n"] + 1

        assert sync_node({"n": 4}) == 5
        rec = _lines(buf)[0]
        assert rec["node"] == "sync_node"
        assert rec["output"] == 5
    finally:
        detach()


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
