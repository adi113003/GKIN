"""OpenAI (ChatGPT-compatible) adapter.

Config: OPENAI_API_KEY (required), OPENAI_MODEL (default gpt-4o-mini).
No browsing is assumed — the model answers from parametric knowledge. We ask it
to cite sources where it can, then score whatever it returns on the same rubric.
"""

from __future__ import annotations

import os

import requests

from .base import result, extract_urls, trim

NAME = "OpenAI"
KEY = "openai"

API_URL = "https://api.openai.com/v1/chat/completions"
TIMEOUT = 60.0

SYSTEM = (
    "You are a careful fact-checking assistant. Verify the user's claim or answer "
    "their verification question. Where you can, cite specific sources (name them and "
    "include URLs), build a dated timeline if relevant, clearly separate what is "
    "verified from what is uncertain, and push back on claims that are false or "
    "overstated. Do not fabricate citations."
)


def available() -> tuple[bool, str]:
    if not os.environ.get("OPENAI_API_KEY"):
        return False, "OPENAI_API_KEY not set"
    return True, ""


def query(prompt_obj: dict) -> dict:
    pid = prompt_obj["id"]
    key = os.environ.get("OPENAI_API_KEY")
    model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
    try:
        r = requests.post(
            API_URL,
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={"model": model, "temperature": 0.0,
                  "messages": [{"role": "system", "content": SYSTEM},
                               {"role": "user", "content": prompt_obj["prompt"]}]},
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        text = r.json()["choices"][0]["message"]["content"]
        return result(NAME, pid, answer=trim(text),
                      citations=[{"url": u} for u in extract_urls(text)],
                      metadata={"model": model})
    except Exception as e:  # noqa: BLE001
        return result(NAME, pid, error=str(e)[:200], metadata={"model": model})
