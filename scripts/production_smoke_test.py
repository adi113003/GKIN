#!/usr/bin/env python3
"""GKIN production smoke test — verifies the demo-critical flow end to end.

Checks (against GKIN_BASE_URL, default http://localhost:8000):
  1. GET  /health            → 200, status ok, reports groq_configured
  2. GET  /                  → 200 (landing page served)
  3. GET  /app               → 200 (analyzer workspace served)
  4. auth: register+login    → JWT (skips authed checks if auth unavailable)
  5. POST /verify-claims     → grounded verdict with the expected schema
  6. POST /timeline          → narrative timeline with the expected keys

Design goals: fail loudly but never crash; missing optional providers/keys are
reported, not fatal. Prints a clean PASS/FAIL summary and exits non-zero on any
CRITICAL failure (health, landing, analyzer, verify-claims schema).

Usage:
    python scripts/production_smoke_test.py
    GKIN_BASE_URL=https://gkin.app python scripts/production_smoke_test.py
    GKIN_BASE_URL=https://gkin.app python scripts/production_smoke_test.py --quick   # skip slow LLM calls

Env (all optional):
    GKIN_BASE_URL     default http://localhost:8000
    GKIN_SMOKE_TIMEOUT  per-request timeout seconds (default 120)
    GKIN_TEST_USER / GKIN_TEST_PASS   smoke account (default smoketest/smoketest123)
"""

from __future__ import annotations

import argparse
import os
import sys
import time

import requests

BASE = os.environ.get("GKIN_BASE_URL", "http://localhost:8000").rstrip("/")
TIMEOUT = float(os.environ.get("GKIN_SMOKE_TIMEOUT", "120"))
USER = os.environ.get("GKIN_TEST_USER", "gkin_smoke")
PASS = os.environ.get("GKIN_TEST_PASS", "gkinsmoke123")

results: list[tuple[str, bool, bool, str]] = []  # (name, ok, critical, detail)


def record(name: str, ok: bool, critical: bool, detail: str = "") -> bool:
    results.append((name, ok, critical, detail))
    mark = "PASS" if ok else ("FAIL" if critical else "WARN")
    print(f"  [{mark}] {name}" + (f" — {detail}" if detail else ""), flush=True)
    return ok


def check_health() -> None:
    try:
        r = requests.get(f"{BASE}/health", timeout=15)
        ok = r.status_code == 200 and r.json().get("status") == "ok"
        deps = r.json().get("dependencies", {}) if ok else {}
        record("GET /health", ok, critical=True,
               detail=f"groq={deps.get('groq_configured')} mongo={deps.get('mongo_connected')} "
                      f"search={deps.get('search_backends')}" if ok else f"HTTP {r.status_code}")
        if ok and not deps.get("groq_configured"):
            record("groq configured", False, critical=True,
                   detail="GROQ_API_KEY missing — /analyze & /verify-claims will fail")
    except Exception as e:  # noqa: BLE001
        record("GET /health", False, critical=True, detail=str(e)[:120])


def check_page(path: str, name: str, critical: bool) -> None:
    try:
        r = requests.get(f"{BASE}{path}", timeout=20)
        record(name, r.status_code == 200, critical, detail=f"HTTP {r.status_code}")
    except Exception as e:  # noqa: BLE001
        record(name, False, critical, detail=str(e)[:120])


def get_token() -> str | None:
    try:
        requests.post(f"{BASE}/register", timeout=20,
                      json={"username": USER, "email": f"{USER}@smoke.local", "password": PASS})
    except Exception:
        pass
    try:
        r = requests.post(f"{BASE}/login", json={"username": USER, "password": PASS}, timeout=20)
        if r.status_code == 200:
            tok = r.json().get("token") or r.json().get("access_token")
            record("auth register+login", bool(tok), critical=False,
                   detail="got JWT" if tok else "no token in response")
            return tok
        record("auth register+login", False, critical=False, detail=f"HTTP {r.status_code}")
    except Exception as e:  # noqa: BLE001
        record("auth register+login", False, critical=False, detail=str(e)[:120])
    return None


def check_verify(token: str) -> None:
    try:
        t0 = time.time()
        r = requests.post(f"{BASE}/verify-claims", timeout=TIMEOUT,
                          headers={"Authorization": f"Bearer {token}"},
                          json={"claims": ["Water boils at 100 degrees Celsius at sea level."],
                                "max_claims": 1, "force_refresh": True})
        dt = time.time() - t0
        if r.status_code != 200:
            record("POST /verify-claims", False, critical=True, detail=f"HTTP {r.status_code}")
            return
        body = r.json()
        v = (body.get("verdicts") or [{}])[0]
        label = v.get("label")
        schema_ok = ("verdicts" in body and label in ("SUPPORTED", "CONTRADICTED", "INSUFFICIENT")
                     and "evidence" in v and "confidence" in v)
        record("POST /verify-claims schema", schema_ok, critical=True,
               detail=f"label={label} evidence={len(v.get('evidence', []))} {dt:.1f}s")
        # Not committing on the verdict VALUE (depends on live retrieval) — only that
        # the loop returns a well-formed, grounded-by-construction verdict.
        if label in ("SUPPORTED", "CONTRADICTED") and not v.get("evidence"):
            record("grounded-by-construction", False, critical=True,
                   detail="hard verdict with no evidence span (should be impossible)")
    except Exception as e:  # noqa: BLE001
        record("POST /verify-claims", False, critical=True, detail=str(e)[:120])


def check_timeline(token: str) -> None:
    try:
        article = ("The Apollo 11 mission landed humans on the Moon on July 20, 1969. "
                   "NASA broadcast the event live and it was corroborated by multiple "
                   "independent observatories and news organizations at the time.")
        r = requests.post(f"{BASE}/timeline", timeout=TIMEOUT,
                          headers={"Authorization": f"Bearer {token}"},
                          json={"article": article})
        if r.status_code != 200:
            record("POST /timeline", False, critical=False, detail=f"HTTP {r.status_code}")
            return
        body = r.json()
        record("POST /timeline schema", "timeline_summary" in body, critical=False,
               detail=f"keys={sorted(body)[:4]}")
    except Exception as e:  # noqa: BLE001
        record("POST /timeline", False, critical=False, detail=str(e)[:120])


def main() -> int:
    ap = argparse.ArgumentParser(description="GKIN production smoke test")
    ap.add_argument("--quick", action="store_true",
                    help="skip slow LLM calls (verify-claims, timeline)")
    args = ap.parse_args()

    print(f"GKIN smoke test → {BASE}  (timeout {TIMEOUT}s){'  [quick]' if args.quick else ''}\n")
    check_health()
    check_page("/", "GET / (landing)", critical=True)
    check_page("/app", "GET /app (analyzer)", critical=True)

    token = get_token()
    if args.quick:
        print("  [SKIP] verify-claims / timeline (--quick)")
    elif token:
        check_verify(token)
        check_timeline(token)
    else:
        record("authed checks", False, critical=False, detail="no token — skipped verify/timeline")

    crit_fail = [n for n, ok, crit, _ in results if not ok and crit]
    warns = [n for n, ok, crit, _ in results if not ok and not crit]
    print(f"\n{'='*52}")
    print(f"  PASS: {sum(1 for _, ok, _, _ in results if ok)}"
          f"   FAIL(critical): {len(crit_fail)}   WARN: {len(warns)}")
    if crit_fail:
        print(f"  CRITICAL FAILURES: {', '.join(crit_fail)}")
    print(f"  RESULT: {'NOT READY ❌' if crit_fail else 'DEMO-READY ✅'}")
    print("=" * 52)
    return 1 if crit_fail else 0


if __name__ == "__main__":
    sys.exit(main())
