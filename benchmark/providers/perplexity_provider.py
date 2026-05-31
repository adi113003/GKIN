"""Perplexity adapter.

Config: PERPLEXITY_API_KEY (required), PERPLEXITY_MODEL (default "sonar").
Perplexity does its own online retrieval, so it is the closest external
comparison to GKIN's grounded behavior. The API can return structured
`citations`; we merge those with any URLs found inline.
"""

from __future__ import annotations

import os

import requests

from .base import result, extract_urls, trim

NAME = "Perplexity"
KEY = "perplexity"

API_URL = "https://api.perplexity.ai/chat/completions"
TIMEOUT = 60.0

SYSTEM = (
    "You are a careful fact-checking assistant. Verify the claim or answer the "
    "verification question. Cite your sources with URLs, build a dated timeline if "
    "relevant, separate verified facts from uncertain ones, and push back on false "
    "or overstated claims."
)


def available() -> tuple[bool, str]:
    if not os.environ.get("PERPLEXITY_API_KEY"):
        return False, "PERPLEXITY_API_KEY not set"
    return True, ""


def query(prompt_obj: dict) -> dict:
    pid = prompt_obj["id"]
    key = os.environ.get("PERPLEXITY_API_KEY")
    model = os.environ.get("PERPLEXITY_MODEL", "sonar")
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
        body = r.json()
        text = body["choices"][0]["message"]["content"]
        # Perplexity returns top-level "citations" (list of URLs) on most models.
        api_cites = body.get("citations") or []
        urls = list(dict.fromkeys([*api_cites, *extract_urls(text)]))
        return result(NAME, pid, answer=trim(text),
                      citations=[{"url": u} for u in urls if u],
                      metadata={"model": model, "api_citations": len(api_cites)})
    except Exception as e:  # noqa: BLE001
        return result(NAME, pid, error=str(e)[:200], metadata={"model": model})
