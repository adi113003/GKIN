"""GKIN adapter — queries the local GKIN server's real grounded endpoints.

Routing (per-prompt `gkin_endpoint`):
  - "verify"   -> POST /verify-claims  (grounded SUPPORTED/CONTRADICTED/INSUFFICIENT
                  verdicts carrying verbatim, credibility-tiered evidence spans)
  - "timeline" -> POST /timeline        (dated narrative + cited sources)

Config:
  GKIN_BASE_URL   (default http://localhost:8000)
  GKIN_JWT        (use this token directly), else
  GKIN_USERNAME / GKIN_PASSWORD  (default benchmark account; auto-registered)
"""

from __future__ import annotations

import os
from typing import Optional

import requests

from .base import result, trim

NAME = "GKIN"
KEY = "gkin"

BASE_URL = os.environ.get("GKIN_BASE_URL", "http://localhost:8000").rstrip("/")
USERNAME = os.environ.get("GKIN_USERNAME", "benchmark")
PASSWORD = os.environ.get("GKIN_PASSWORD", "benchmarkpass123")
TIMEOUT = float(os.environ.get("GKIN_TIMEOUT", "180"))

_token: Optional[str] = None


def _login() -> Optional[str]:
    """Return a JWT: env override, else login, else register-then-login."""
    global _token
    if _token:
        return _token
    env = os.environ.get("GKIN_JWT")
    if env:
        _token = env
        return _token
    # try login; if it fails, register then login
    for attempt in (0, 1):
        try:
            r = requests.post(f"{BASE_URL}/login",
                              json={"username": USERNAME, "password": PASSWORD}, timeout=15)
            if r.status_code == 200:
                d = r.json()
                _token = d.get("token") or d.get("access_token")
                if _token:
                    return _token
        except requests.RequestException:
            return None
        if attempt == 0:
            try:
                requests.post(f"{BASE_URL}/register",
                              json={"username": USERNAME, "email": f"{USERNAME}@bench.local",
                                    "password": PASSWORD}, timeout=15)
            except requests.RequestException:
                return None
    return None


def available() -> tuple[bool, str]:
    try:
        requests.get(f"{BASE_URL}/", timeout=5)
    except requests.RequestException:
        return False, f"GKIN server not reachable at {BASE_URL} (start it: python server.py)"
    if _login() is None:
        return False, f"GKIN reachable at {BASE_URL} but could not authenticate"
    return True, ""


def _headers() -> dict:
    return {"Authorization": f"Bearer {_login()}", "Content-Type": "application/json"}


def _query_verify(claim: str, prompt_id: str) -> dict:
    # Default: force_refresh (live behaviour). Set GKIN_FORCE_REFRESH=0 (the
    # runner's --gkin-cache) to reuse cached verdicts for reproducible scores.
    force = os.environ.get("GKIN_FORCE_REFRESH", "1") != "0"
    r = requests.post(f"{BASE_URL}/verify-claims",
                      json={"claims": [claim], "max_claims": 1, "force_refresh": force},
                      headers=_headers(), timeout=TIMEOUT)
    r.raise_for_status()
    verdicts = r.json().get("verdicts", [])
    if not verdicts:
        return result(NAME, prompt_id, answer="No verdict returned.", error="empty_verdicts")
    v = verdicts[0]
    label = v.get("label", "INSUFFICIENT")
    conf = v.get("confidence", 0.0)
    parts = [f"VERDICT: {label} (confidence {conf:.2f}).",
             v.get("reasoning", "").strip()]
    citations = []
    if v.get("evidence"):
        parts.append("Evidence:")
        for e in v["evidence"]:
            tn = e.get("tier_name", "Unverified")
            parts.append(f'- [{tn}] "{e.get("sentence","").strip()}" ({e.get("url","")})')
            citations.append({"url": e.get("url", ""), "tier": e.get("tier", 0),
                              "tier_name": tn, "snippet": e.get("sentence", "")})
    else:
        parts.append("No grounded evidence was retrieved, so GKIN abstains (INSUFFICIENT).")
    return result(NAME, prompt_id, answer=trim("\n".join(p for p in parts if p)),
                  citations=citations,
                  metadata={"label": label, "confidence": conf,
                            "low_confidence": v.get("low_confidence"),
                            "flags": v.get("flags", []), "endpoint": "/verify-claims"})


def _query_timeline(topic: str, prompt_id: str) -> dict:
    r = requests.post(f"{BASE_URL}/timeline", json={"article": topic},
                      headers=_headers(), timeout=TIMEOUT)
    r.raise_for_status()
    d = r.json()
    parts = [d.get("timeline_summary", "").strip()]
    for ct in d.get("claim_timeline", []):
        parts.append(f"\nClaim: {ct.get('claim','')}")
        for te in ct.get("timeline_entries", []):
            parts.append(f"- {te.get('date','(undated)')}: {te.get('how_claim_changed','')} "
                         f"({te.get('hostname','')})")
    citations = [{"url": s.get("url", ""), "tier": s.get("tier", 0),
                  "tier_name": s.get("tier_name", ""),
                  "snippet": s.get("relevance_snippet", "") or s.get("claim_supported", "")}
                 for s in d.get("sources_used", [])]
    return result(NAME, prompt_id, answer=trim("\n".join(p for p in parts if p)),
                  citations=citations,
                  metadata={"endpoint": "/timeline",
                            "n_sources": len(d.get("sources_used", []))})


def query(prompt_obj: dict) -> dict:
    pid = prompt_obj["id"]
    endpoint = prompt_obj.get("gkin_endpoint", "verify")
    claim = prompt_obj.get("gkin_claim") or prompt_obj["prompt"]
    try:
        if endpoint == "timeline":
            # /timeline requires >=100 chars of seed text to extract a topic from,
            # so combine the prompt + claim and pad with explicit framing if short.
            seed = f"{prompt_obj['prompt']} {claim}".strip()
            if len(seed) < 120:
                seed += (" Provide a detailed chronological timeline of the major dated "
                         "events, citing a source for each event.")
            return _query_timeline(seed, pid)
        return _query_verify(claim, pid)
    except requests.RequestException as e:
        return result(NAME, pid, error=str(e)[:200])
    except Exception as e:  # noqa: BLE001
        return result(NAME, pid, error=str(e)[:200])
