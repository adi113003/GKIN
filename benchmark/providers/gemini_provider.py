"""Google Gemini adapter.

Config: GEMINI_API_KEY (required), GEMINI_MODEL (default gemini-1.5-flash).
Answers from parametric knowledge; asked to cite sources where possible.
"""

from __future__ import annotations

import os
import time

import requests

from .base import result, extract_urls, trim

NAME = "Gemini"
KEY = "gemini"

TIMEOUT = 60.0

INSTRUCTION = (
    "You are a careful fact-checking assistant. Verify the claim or answer the "
    "verification question below. Cite specific sources with URLs where you can, "
    "build a dated timeline if relevant, separate what is verified from what is "
    "uncertain, and push back on false or overstated claims. Do not fabricate "
    "citations.\n\n"
)


def available() -> tuple[bool, str]:
    if not os.environ.get("GEMINI_API_KEY"):
        return False, "GEMINI_API_KEY not set"
    return True, ""


def query(prompt_obj: dict) -> dict:
    pid = prompt_obj["id"]
    key = os.environ.get("GEMINI_API_KEY")
    model = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
    url = (f"https://generativelanguage.googleapis.com/v1beta/models/"
           f"{model}:generateContent?key={key}")
    body = {"contents": [{"parts": [{"text": INSTRUCTION + prompt_obj["prompt"]}]}],
            "generationConfig": {"temperature": 0.0}}
    last_err = None
    # Free-tier keys throttle aggressively; back off and retry on 429.
    for attempt in range(4):
        try:
            r = requests.post(url, headers={"Content-Type": "application/json"},
                              json=body, timeout=TIMEOUT)
            if r.status_code == 429:
                # Surface the real reason (per-minute throttle vs hard quota=0 /
                # billing-required) so the report is honest, not a vague "429".
                reason = ""
                try:
                    reason = r.json().get("error", {}).get("message", "")
                except Exception:
                    reason = (r.text or "")[:160]
                last_err = f"429 quota/rate-limited: {reason[:180]}"
                if "limit: 0" in reason or "billing" in reason.lower():
                    break  # hard quota — retrying won't help
                time.sleep(8 * (attempt + 1))
                continue
            r.raise_for_status()
            cands = r.json().get("candidates", [])
            text = ""
            if cands:
                text = "".join(p.get("text", "") for p in cands[0].get("content", {}).get("parts", []))
            return result(NAME, pid, answer=trim(text),
                          citations=[{"url": u} for u in extract_urls(text)],
                          metadata={"model": model})
        except Exception as e:  # noqa: BLE001
            last_err = str(e)[:200]
            break
    return result(NAME, pid, error=last_err or "unknown error", metadata={"model": model})
