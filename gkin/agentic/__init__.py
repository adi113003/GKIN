"""Agentic, retrieval-grounded fact-checking loop (framework-free).

An explicit state machine — small pure node functions, a controller that decides
the next node, a max-iteration cap and a retry counter — that turns each
verifiable claim into an auditable SUPPORTED / CONTRADICTED / INSUFFICIENT
verdict carrying the exact source URLs and sentences that justify it.
"""

from .cache import VerdictCache
from .controller import run_claim
from .nodes import Deps
from .search import available as search_available, resolve_backend
from .service import verify_claims
from .trace import configure_tracing, record_usage, trace

__all__ = [
    "Deps",
    "VerdictCache",
    "configure_tracing",
    "record_usage",
    "resolve_backend",
    "run_claim",
    "search_available",
    "trace",
    "verify_claims",
]
