"""Agentic, retrieval-grounded fact-checking loop (framework-free).

An explicit state machine — small pure node functions, a controller that decides
the next node, a max-iteration cap and a retry counter — that turns each
verifiable claim into an auditable SUPPORTED / CONTRADICTED / INSUFFICIENT
verdict carrying the exact source URLs and sentences that justify it.
"""

from .trace import configure_tracing, record_usage, trace

__all__ = ["configure_tracing", "record_usage", "trace"]
