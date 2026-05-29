"""Claim-hash verdict cache.

A duplicate claim across articles (or re-analysis of the same article) must not
re-fire the 20-30 external search/scrape/ground calls a single verification
costs. Verdicts are keyed by the normalized claim hash and persisted to a JSON
file with a TTL. An asyncio lock serializes the read-modify-write so concurrent
verifications don't clobber each other's entries.

Ported from the (now deleted) gkin/verification/verify_claim.py cache.
"""

from __future__ import annotations

import asyncio
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from .util import claim_hash, iso_now

DEFAULT_PATH = Path(os.environ.get("GKIN_VERIFY_CACHE", ".gkin_cache/verification_cache.json"))
DEFAULT_TTL = timedelta(days=30)


class VerdictCache:
    def __init__(self, path: Path = DEFAULT_PATH, ttl: timedelta = DEFAULT_TTL):
        self.path = Path(path)
        self.ttl = ttl
        self._lock = asyncio.Lock()

    def _load(self) -> dict:
        if not self.path.exists():
            return {}
        try:
            return json.loads(self.path.read_text())
        except Exception:
            return {}

    def _write(self, data: dict) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(data, indent=2, sort_keys=True))

    def _fresh(self, entry: dict) -> bool:
        raw = entry.get("cached_at")
        if not raw:
            return False
        try:
            cached_at = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            return False
        return datetime.now(timezone.utc) - cached_at < self.ttl

    async def get(self, claim_text: str) -> Optional[dict]:
        """Return a fresh cached verdict dict, or None on miss/stale."""
        key = claim_hash(claim_text)
        async with self._lock:
            entry = self._load().get(key)
        if entry and self._fresh(entry):
            return entry.get("verdict")
        return None

    async def put(self, claim_text: str, verdict: dict) -> None:
        key = claim_hash(claim_text)
        async with self._lock:
            data = self._load()
            data[key] = {"cached_at": iso_now(), "verdict": verdict}
            self._write(data)
