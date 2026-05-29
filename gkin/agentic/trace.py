"""Lightweight, vendor-free observability for the agentic fact-checking loop.

`@trace` wraps each state-machine node and emits one structured JSON log line
per invocation: node name, a truncated summary of inputs/outputs, wall-clock
latency, Groq token usage, and success/failure. No vendor SDK — just stdlib
``logging`` + ``contextvars`` so it works under asyncio without leaking token
counts between concurrently-running nodes.

Token accounting works by node: ``@trace`` opens a fresh per-node bucket in a
``ContextVar`` for the duration of the call, and any code inside the node calls
``record_usage(resp.usage)`` after a Groq completion to add to it. Nested traced
nodes each get their own bucket (innermost wins), so usage is attributed to the
node that actually spent the tokens rather than double-counted up the stack.
"""

from __future__ import annotations

import asyncio
import contextvars
import functools
import json
import logging
import time
from datetime import datetime, timezone
from typing import Any, Callable, Optional

logger = logging.getLogger("gkin.agentic.trace")

# Per-node token bucket. None when we are outside any traced node, in which case
# record_usage() is a no-op (so nodes can be called untraced in tests).
_token_ctx: contextvars.ContextVar[Optional[dict]] = contextvars.ContextVar(
    "gkin_trace_tokens", default=None
)

_MISSING = object()


def configure_tracing(level: int = logging.INFO, *, stream=None) -> None:
    """Attach a JSON-passthrough handler so traces print as raw JSON lines.

    Idempotent: safe to call more than once. Callers who already configure
    ``gkin.agentic.trace`` logging themselves can skip this.
    """
    if any(getattr(h, "_gkin_trace", False) for h in logger.handlers):
        logger.setLevel(level)
        return
    handler = logging.StreamHandler(stream)
    handler.setFormatter(logging.Formatter("%(message)s"))
    handler._gkin_trace = True  # type: ignore[attr-defined]
    logger.addHandler(handler)
    logger.setLevel(level)
    logger.propagate = False


def record_usage(usage: Any) -> None:
    """Accumulate Groq token usage into the current node's bucket.

    Tolerant of ``None`` and of either a Groq ``CompletionUsage`` object or a
    plain dict. No-op when called outside a traced node.
    """
    bucket = _token_ctx.get()
    if bucket is None or usage is None:
        return
    for key in ("prompt_tokens", "completion_tokens", "total_tokens"):
        val = getattr(usage, key, None)
        if val is None and isinstance(usage, dict):
            val = usage.get(key)
        if val:
            bucket[key] += int(val)
    bucket["calls"] += 1


def current_tokens() -> Optional[dict]:
    """Return a copy of the current node's token bucket, or None if untraced."""
    bucket = _token_ctx.get()
    return dict(bucket) if bucket is not None else None


def _summarize(value: Any, limit: int = 160, _depth: int = 0) -> Any:
    """Produce a compact, JSON-safe summary of an arbitrary value.

    Truncates long strings, caps dict/list breadth, and never raises — a
    summary that blows up must not take a node's real result down with it.
    """
    try:
        if value is None or isinstance(value, (bool, int, float)):
            return value
        if isinstance(value, str):
            if len(value) <= limit:
                return value
            return value[:limit] + f"…(+{len(value) - limit} chars)"
        if _depth >= 3:
            return f"<{type(value).__name__}>"
        if isinstance(value, dict):
            out = {}
            for i, (k, v) in enumerate(value.items()):
                if i >= 12:
                    out["…"] = f"+{len(value) - 12} more keys"
                    break
                out[str(k)] = _summarize(v, limit, _depth + 1)
            return out
        if isinstance(value, (list, tuple, set)):
            seq = list(value)
            sample = [_summarize(v, limit, _depth + 1) for v in seq[:3]]
            return {"len": len(seq), "sample": sample}
        # Pydantic models and other objects: best-effort dump.
        dump = getattr(value, "model_dump", None)
        if callable(dump):
            return _summarize(dump(), limit, _depth + 1)
        return _summarize(repr(value), limit, _depth)
    except Exception:
        return f"<unsummarizable {type(value).__name__}>"


def _emit(
    name: str,
    args: tuple,
    kwargs: dict,
    result: Any,
    ok: bool,
    error: Optional[str],
    latency_ms: float,
    tokens: dict,
) -> None:
    # Skip injected callables and dependency containers (marked _trace_skip) in
    # the input summary — the state dict is what matters for debugging prompts.
    def _skip(v: Any) -> bool:
        return callable(v) or getattr(v, "_trace_skip", False)

    summarized_args = [_summarize(a) for a in args if not _skip(a)]
    record = {
        "event": "node",
        "node": name,
        "ok": ok,
        "latency_ms": latency_ms,
        "tokens": tokens,
        "input": {
            "args": summarized_args,
            "kwargs": {k: _summarize(v) for k, v in kwargs.items() if not _skip(v)},
        },
        "output": _summarize(result) if ok else None,
        "error": error,
        "ts": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    try:
        logger.info(json.dumps(record, default=str))
    except Exception:
        # Logging must never break the loop.
        logger.info('{"event":"node","node":"%s","ok":%s,"log_error":true}' % (name, str(ok).lower()))


def trace(node_name: Optional[str] = None) -> Callable:
    """Decorator that emits a structured JSON trace line per node invocation.

    Works on both ``async def`` and plain ``def`` nodes.
    """

    def decorator(fn: Callable) -> Callable:
        name = node_name or fn.__name__

        def _fresh_bucket() -> dict:
            return {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0, "calls": 0}

        if asyncio.iscoroutinefunction(fn):

            @functools.wraps(fn)
            async def awrapper(*args, **kwargs):
                token = _token_ctx.set(_fresh_bucket())
                start = time.perf_counter()
                result: Any = _MISSING
                error: Optional[str] = None
                try:
                    result = await fn(*args, **kwargs)
                    return result
                except Exception as exc:  # noqa: BLE001 — re-raised below
                    error = repr(exc)
                    raise
                finally:
                    latency_ms = round((time.perf_counter() - start) * 1000, 2)
                    tokens = _token_ctx.get() or _fresh_bucket()
                    _token_ctx.reset(token)
                    _emit(
                        name, args, kwargs,
                        result if result is not _MISSING else None,
                        error is None, error, latency_ms, dict(tokens),
                    )

            return awrapper

        @functools.wraps(fn)
        def swrapper(*args, **kwargs):
            token = _token_ctx.set(_fresh_bucket())
            start = time.perf_counter()
            result: Any = _MISSING
            error: Optional[str] = None
            try:
                result = fn(*args, **kwargs)
                return result
            except Exception as exc:  # noqa: BLE001 — re-raised below
                error = repr(exc)
                raise
            finally:
                latency_ms = round((time.perf_counter() - start) * 1000, 2)
                tokens = _token_ctx.get() or _fresh_bucket()
                _token_ctx.reset(token)
                _emit(
                    name, args, kwargs,
                    result if result is not _MISSING else None,
                    error is None, error, latency_ms, dict(tokens),
                )

        return swrapper

    return decorator
