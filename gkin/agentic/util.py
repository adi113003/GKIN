"""Shared helpers for the agentic loop: claim hashing and timestamps.

Kept tiny and dependency-free so both the verdict model and the cache can use
the same claim-identity scheme. The hash is the cache key and the basis for the
human-facing claim_id, so its normalization (strip + lowercase) defines when two
claims count as "the same claim" for caching purposes.
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone


def claim_hash(claim_text: str) -> str:
    """Stable sha256 of a normalized claim. This is the cache key."""
    return hashlib.sha256(claim_text.strip().lower().encode("utf-8")).hexdigest()


def claim_id(claim_text: str) -> str:
    """Short, human-readable id derived from the claim hash."""
    return "claim_" + claim_hash(claim_text)[:12]


def iso_now() -> str:
    """UTC timestamp, second precision, ...Z suffix."""
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
