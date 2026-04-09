"""
server.py — GKIN Truth Navigator web backend.

Endpoints:
  POST /analyze   body: {article: str}
                  returns: structured analysis JSON
  POST /chat      body: {message: str, analysis: dict, history: list}
                  returns: streaming text response from Groq
  GET  /random    returns: {title, text, label} from WELFake CSV
  GET  /          serves static/index.html

Setup:
  pip install fastapi uvicorn groq pandas python-multipart
  export GROQ_API_KEY="your_key"
  python server.py

Then open http://localhost:8000 in your browser.
"""

import os
import json
import random
import pathlib
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq
import pandas as pd

MODEL_ANALYSIS = "llama-3.3-70b-versatile"
MODEL_CHAT = "llama-3.3-70b-versatile"
WELFAKE_CSV = "WELFake_Dataset.csv"  # adjust path if needed

NARRATIVE_CLUSTERS = [
    "anti_vaccine", "election_fraud", "climate_denial", "immigration_threat",
    "economic_doom", "tech_surveillance", "elite_conspiracy", "pharma_corruption",
    "media_corruption", "cultural_decline", "historical_revisionism",
    "health_miracle", "financial_scam", "geopolitical_blame", "crime_panic",
    "gender_panic", "religious_persecution", "food_fear", "ai_panic", "none",
]

ANALYSIS_PROMPT = """You are a media literacy analyst. Given a news article, produce a structured JSON analysis identifying factual claims, persuasion techniques, emotional framing, missing context, and narrative patterns.

Analyze the article objectively. Do NOT take a political side. Focus on HOW the article is constructed to persuade, not WHETHER its conclusions are correct.

Return ONLY valid JSON matching this exact schema:

{{
  "claims": [
    {{"text": "claim text", "type": "Verifiable | Opinion | Unverifiable", "confidence": 0.0}}
  ],
  "persuasion_techniques": [
    {{"technique": "fear_appeal | bandwagon | loaded_language | false_urgency | authority_appeal | whataboutism | black_and_white",
      "span": "exact quote from article", "explanation": "one sentence"}}
  ],
  "emotion_scores": {{
    "fear": 0, "anger": 0, "disgust": 0, "hope": 0, "guilt": 0, "ingroup_framing": 0
  }},
  "manipulation_index": 0,
  "missing_context": [
    {{"gap": "what's missing", "why_it_matters": "one sentence"}}
  ],
  "narrative_cluster": "one of the 20 categories or 'none'"
}}

Definitions:
- Verifiable: fact checkable against public records/data.
- Opinion: value judgment or interpretation.
- Unverifiable: factual claim that cannot practically be checked.
- fear_appeal: invoking threat to motivate belief.
- bandwagon: appeal to popularity.
- loaded_language: emotionally charged word choices.
- false_urgency: artificial time pressure.
- authority_appeal: citing authority instead of evidence.
- whataboutism: deflecting by pointing to unrelated wrongs.
- black_and_white: presenting complex issues as only two options.
- manipulation_index 0-20: straight reporting. 20-40: mild framing. 40-60: noticeable persuasion. 60-80: heavy manipulation. 80-100: propaganda.

All emotion scores and manipulation_index are integers 0-100.
narrative_cluster must be one of: {clusters}.
Cap persuasion_techniques at 8. Cap claims at 12. Cap missing_context at 5.

Article:
\"\"\"
{article}
\"\"\"
"""

CHAT_SYSTEM_PROMPT = """You are Truth Navigator, a friendly media literacy assistant. You help users understand a news article they just analyzed.

You have been given the structured analysis of the article below. Answer the user's questions using this analysis as your primary source. Be conversational, clear, and honest. If the user asks something the analysis doesn't cover, say so — don't make things up.

When explaining persuasion techniques or manipulation scores, quote the specific spans from the analysis to make your explanations concrete. Keep responses short — 2-4 sentences unless the user asks for more detail.

ARTICLE ANALYSIS (JSON):
{analysis}
"""


app = FastAPI(title="GKIN Truth Navigator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_client: Optional[Groq] = None
_welfake_df: Optional[pd.DataFrame] = None


def get_client() -> Groq:
    global _client
    if _client is None:
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise HTTPException(500, "GROQ_API_KEY not set on server")
        _client = Groq(api_key=api_key)
    return _client


def get_welfake() -> Optional[pd.DataFrame]:
    global _welfake_df
    if _welfake_df is None and pathlib.Path(WELFAKE_CSV).exists():
        df = pd.read_csv(WELFAKE_CSV)
        df = df[df["text"].notna() & (df["text"].str.len() > 300)]
        _welfake_df = df.reset_index(drop=True)
    return _welfake_df


class AnalyzeRequest(BaseModel):
    article: str


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    analysis: dict
    history: list[ChatMessage] = []


@app.post("/analyze")
def analyze(req: AnalyzeRequest):
    if not req.article or len(req.article) < 200:
        raise HTTPException(400, "Article too short (need at least 200 chars)")

    client = get_client()
    prompt = ANALYSIS_PROMPT.format(
        clusters=", ".join(NARRATIVE_CLUSTERS),
        article=req.article[:12000],
    )

    try:
        response = client.chat.completions.create(
            model=MODEL_ANALYSIS,
            messages=[
                {"role": "system", "content": "You output only valid JSON. No prose."},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
        )
        text = response.choices[0].message.content
        return json.loads(text)
    except Exception as e:
        raise HTTPException(500, f"Analysis failed: {e}")


@app.post("/chat")
def chat(req: ChatRequest):
    client = get_client()
    system = CHAT_SYSTEM_PROMPT.format(analysis=json.dumps(req.analysis, indent=2))

    messages = [{"role": "system", "content": system}]
    for m in req.history:
        messages.append({"role": m.role, "content": m.content})
    messages.append({"role": "user", "content": req.message})

    def stream_response():
        try:
            stream = client.chat.completions.create(
                model=MODEL_CHAT,
                messages=messages,
                temperature=0.5,
                stream=True,
            )
            for chunk in stream:
                delta = chunk.choices[0].delta.content
                if delta:
                    yield delta
        except Exception as e:
            yield f"\n[Error: {e}]"

    return StreamingResponse(stream_response(), media_type="text/plain")


@app.get("/random")
def random_article():
    df = get_welfake()
    if df is None:
        raise HTTPException(404, f"WELFake dataset not found at {WELFAKE_CSV}")
    row = df.sample(1).iloc[0]
    return {
        "title": str(row.get("title", "") or ""),
        "text": str(row.get("text", "")),
        "label": int(row.get("label", -1)),  # 1=fake, 0=real in WELFake
    }


@app.get("/")
def index():
    return FileResponse("static/index.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)