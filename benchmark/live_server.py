"""Live side-by-side comparison server — for the demo.

Type one claim in the browser and watch GKIN, ChatGPT, Perplexity (and Gemini,
if a key is set) answer it side-by-side, each scored live on the same 7-category
rubric. This is the interactive counterpart to run_competitor_benchmark.py: it
reuses the SAME provider adapters and the SAME scoring code, so what you show on
stage is the same machinery the written report is built from.

Why a separate server (not a route in server.py): the GKIN adapter talks to the
GKIN server over HTTP at :8000. Running this on its own port (default 8800) keeps
that call path identical to the batch runner and means you don't rebuild the
React app to demo it.

Run (with the GKIN server already up on :8000):
    python server.py                       # terminal 1 — GKIN itself
    python benchmark/live_server.py        # terminal 2 — this page
    # open http://localhost:8800

Env (all optional):
    LIVE_PORT (default 8800), GKIN_BASE_URL (default http://localhost:8000),
    OPENAI_API_KEY (enables ChatGPT + the LLM-as-judge scorer),
    PERPLEXITY_API_KEY, GEMINI_API_KEY, plus the per-provider model vars.
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from fastapi import FastAPI                                   # noqa: E402
from fastapi.responses import HTMLResponse, JSONResponse      # noqa: E402
from pydantic import BaseModel                                # noqa: E402

from benchmark import scoring                                 # noqa: E402
from benchmark.providers import PROVIDERS                     # noqa: E402

# Gemini is excluded from the batch runner's PROVIDERS (billing), but we still
# want to SHOW it as a greyed column so the framework's coverage is visible.
# Pull it in if the adapter imports cleanly; it self-reports unavailable w/o a key.
ALL_PROVIDERS = dict(PROVIDERS)
try:
    from benchmark.providers import gemini_provider
    ALL_PROVIDERS.setdefault(gemini_provider.KEY, gemini_provider)
except Exception:
    pass

HERE = Path(__file__).parent
PAGE = HERE / "live_compare.html"

app = FastAPI(title="GKIN Live Comparison")


class CompareIn(BaseModel):
    claim: str
    mode: str = "verify"        # "verify" | "timeline"
    expected: str = "auto"      # auto | true | false | uncertain  (verify mode only)


def build_prompt_obj(claim: str, mode: str, expected: str) -> dict:
    """Turn a free-form claim into the prompt_obj shape providers + scorers expect.

    Live claims have no curated expected_facts, so factual_correctness is scored
    structurally by the heuristic and semantically by the judge. The optional
    `expected` toggle lets a demo mark a claim as false/uncertain so the misinfo
    and uncertainty scorers engage the way they do in the curated prompt set.
    """
    claim = claim.strip()
    if mode == "timeline":
        prompt = (f"Give a dated timeline of the major events related to: {claim}. "
                  "Cite evidence (with URLs) for each event.")
        return {
            "id": "live", "prompt": prompt, "category": "live_timeline",
            "expected_facts": [], "expected_stance": "timeline",
            "expects_timeline": True, "misinfo_trap": False,
            "gkin_endpoint": "timeline", "gkin_claim": claim,
        }
    stance = {"true": "supported", "false": "rejected",
              "uncertain": "uncertain"}.get(expected, "")
    prompt = (f"Verify this claim: {claim}. Cite specific sources with URLs, "
              "clearly separate what is verified from what is uncertain, and push "
              "back if the claim is false or overstated.")
    return {
        "id": "live", "prompt": prompt, "category": "live_verify",
        "expected_facts": [], "expected_stance": stance,
        "expects_timeline": False, "misinfo_trap": expected == "false",
        "gkin_endpoint": "verify", "gkin_claim": claim,
    }


@app.get("/", response_class=HTMLResponse)
def index() -> str:
    return PAGE.read_text()


@app.get("/providers")
def providers() -> JSONResponse:
    """List every wired provider with its live availability + reason-if-not."""
    out = []
    for key, mod in ALL_PROVIDERS.items():
        try:
            ok, reason = mod.available()
        except Exception as e:  # noqa: BLE001
            ok, reason = False, str(e)[:160]
        out.append({"key": key, "name": mod.NAME, "available": ok, "reason": reason})
    return JSONResponse({
        "providers": out,
        "judge": scoring.judge_available(),
        "categories": scoring.CATEGORIES,
        "max_total": scoring.MAX_TOTAL,
        "max_per_category": scoring.MAX_PER_CATEGORY,
    })


@app.post("/compare/{key}")
async def compare(key: str, body: CompareIn) -> JSONResponse:
    """Query ONE provider and score it. The page calls this per-provider in
    parallel so each column fills as soon as that provider answers."""
    mod = ALL_PROVIDERS.get(key)
    if mod is None:
        return JSONResponse({"error": f"unknown provider '{key}'"}, status_code=404)
    ok, reason = mod.available()
    if not ok:
        return JSONResponse({"provider": mod.NAME, "skipped": True, "reason": reason})

    p = build_prompt_obj(body.claim, body.mode, body.expected)
    res = await asyncio.to_thread(mod.query, p)
    res["heuristic"] = scoring.score_heuristic(res, p)
    res["judge"] = (await asyncio.to_thread(scoring.score_with_judge, res, p)
                    if scoring.judge_available() else None)
    res["primary"] = res["judge"] if res.get("judge") else res["heuristic"]
    return JSONResponse(res)


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("LIVE_PORT", "8800"))
    print(f"GKIN live comparison → http://localhost:{port}")
    print(f"  GKIN server expected at {os.environ.get('GKIN_BASE_URL', 'http://localhost:8000')}")
    print(f"  LLM-as-judge: {'ON' if scoring.judge_available() else 'OFF (set OPENAI_API_KEY)'}")
    uvicorn.run(app, host="0.0.0.0", port=port)
