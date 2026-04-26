"""
server.py — GKIN Truth Navigator v3.

New in v3:
  · User authentication (register / login / JWT)
  · Conspiracy mode chat (speculative narrative analysis)
  · All analysis endpoints protected by auth

New in v2:
  · DeepSeek R1 chain-of-thought reasoning
  · Parallel claim verification (semaphore-capped at 4)
  · Tool-calling agentic chat (web search, fact-check, historical parallels)
  · Whisper large-v3 audio / video transcription
  · Vision model screenshot & image analysis
  · Multi-article narrative comparison (up to 4)
  · Dynamic AI-generated chat suggestions

Endpoints:
  POST /register      {username, email, password}       → {token, username, email}
  POST /login         {username, password}              → {token, username, email}
  GET  /me            (auth)                            → {username, email}
  POST /analyze       {article}          (auth)         → enriched analysis JSON
  POST /chat          {message, ...}     (auth)         → streaming text
  POST /transcribe    multipart          (auth)         → {transcript}
  POST /analyze-image multipart          (auth)         → enriched analysis JSON
  POST /compare       {articles[]}       (auth)         → {analyses[], comparison}
  POST /suggestions   {analysis}         (auth)         → {suggestions[]}
  GET  /random        (auth)                            → {title, text, label}
  GET  /              → static/index.html

Setup:
  pip install fastapi uvicorn groq pandas python-multipart duckduckgo-search python-jose[cryptography] passlib[bcrypt]
  export GROQ_API_KEY="your_key"
  export SECRET_KEY="your-secret-key"   # optional, auto-generated if omitted
  python server.py
"""

import os
import re
import json
import base64
import asyncio
import pathlib
import secrets
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, UploadFile, File, Depends
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from groq import AsyncGroq
import pandas as pd

try:
    from jose import JWTError, jwt
    from passlib.context import CryptContext
    _AUTH_OK = True
except ImportError:
    _AUTH_OK = False
    jwt = None          # type: ignore
    JWTError = Exception
    CryptContext = None  # type: ignore

# ── Model IDs ─────────────────────────────────────────────────────────────────
MODEL_REASON  = "deepseek-r1-distill-llama-70b"
MODEL_STRUCT  = "llama-3.3-70b-versatile"
MODEL_FAST    = "llama-3.1-8b-instant"
MODEL_VISION  = "llama-3.2-90b-vision-preview"
MODEL_WHISPER = "whisper-large-v3"

WELFAKE_CSV       = "WELFake_Dataset.csv"
USERS_FILE        = "users.json"
SECRET_KEY        = os.environ.get("SECRET_KEY", "gkin-dev-" + secrets.token_hex(16))
ALGORITHM         = "HS256"
TOKEN_EXPIRE_DAYS = 7

NARRATIVE_CLUSTERS = [
    "anti_vaccine", "election_fraud", "climate_denial", "immigration_threat",
    "economic_doom", "tech_surveillance", "elite_conspiracy", "pharma_corruption",
    "media_corruption", "cultural_decline", "historical_revisionism",
    "health_miracle", "financial_scam", "geopolitical_blame", "crime_panic",
    "gender_panic", "religious_persecution", "food_fear", "ai_panic", "none",
]

# ── Prompts ───────────────────────────────────────────────────────────────────

REASONING_PROMPT = """You are a senior media analyst with expertise in propaganda, cognitive biases, and persuasion psychology. Analyze the following article thoroughly.

Examine in detail:
1. What factual claims are made — quote them precisely. How verifiable are they?
2. What persuasion techniques are deployed? Cite exact phrases from the text.
3. What emotions is this article designed to trigger and why?
4. What important context, counterarguments, or data is absent?
5. What narrative pattern does this fit into?
6. How manipulative is this article overall on a 0-100 scale, and why?

Be specific. Quote the article directly. Think step by step.

Article:
\"\"\"
{article}
\"\"\"
"""

STRUCTURE_PROMPT = """Based on this analysis of a news article, produce a structured JSON object.

Analysis:
{analysis}

Return ONLY valid JSON matching this schema exactly:
{{
  "claims": [
    {{"text": "claim text", "type": "Verifiable | Opinion | Unverifiable", "confidence": 0.0}}
  ],
  "persuasion_techniques": [
    {{"technique": "fear_appeal | bandwagon | loaded_language | false_urgency | authority_appeal | whataboutism | black_and_white",
      "span": "exact quote from article", "explanation": "one sentence"}}
  ],
  "emotion_scores": {{"fear": 0, "anger": 0, "disgust": 0, "hope": 0, "guilt": 0, "ingroup_framing": 0}},
  "manipulation_index": 0,
  "missing_context": [
    {{"gap": "what is missing", "why_it_matters": "one sentence"}}
  ],
  "narrative_cluster": "one of the 20 categories"
}}

Rules:
- All scores 0-100 integers. narrative_cluster must be one of: {clusters}.
- Cap techniques at 8, claims at 12, missing_context at 5.
"""

CLAIM_VERIFY_PROMPT = """You are a fact-checker. Evaluate this specific claim in one sentence.

Claim: {claim}

Return JSON: {{"verdict": "accurate | partially_accurate | misleading | false | unverifiable", "explanation": "one sentence"}}"""

COMPARISON_PROMPT = """You are a media analyst comparing multiple news articles. Identify coordination, contradictions, and divergent framing.

Articles:
{summaries}

Return JSON:
{{
  "shared_narrative_clusters": ["clusters appearing in multiple articles"],
  "coordinated_techniques": ["persuasion techniques used across multiple articles"],
  "factual_contradictions": [
    {{"claim_a": "...", "article_index_a": 0, "claim_b": "...", "article_index_b": 1, "contradiction": "one sentence"}}
  ],
  "narrative_divergence": "one paragraph on how these articles frame the same reality differently",
  "coordination_score": 0,
  "coordination_explanation": "one sentence on whether these articles push the same agenda"
}}

coordination_score 0-100: 100 = clearly coordinated propaganda campaign.
"""

CHAT_SYSTEM_CONTEXT = """You are Truth Navigator, a media literacy assistant. Answer questions using ONLY the article analysis below. Do not draw on outside knowledge. If asked something the analysis doesn't cover, say so clearly.

Quote specific spans when explaining techniques. Keep answers 2-4 sentences unless asked for more.

MODE: Context-only — strictly grounded in the analysis.

ARTICLE ANALYSIS:
{analysis}"""

CHAT_SYSTEM_OPEN = """You are Truth Navigator, an advanced media intelligence assistant with web search tools and deep knowledge of history, geopolitics, media ecosystems, and current events.

Use the article analysis as your starting point, then go further:
- Provide historical context and real-world parallels
- Fact-check specific claims using your search tools
- Correlate this story with broader global events and trends
- Answer any question the user has, even if it goes beyond the article

When you use a tool, incorporate its results into your answer. Be substantive and cite your sources. Aim for 3-6 sentences or more when questions warrant depth.

MODE: Open research — analysis + web tools + world knowledge.

ARTICLE ANALYSIS:
{analysis}"""

CHAT_SYSTEM_CONSPIRACY = """You are Truth Navigator in Conspiracy Mode — an investigative analyst who reads beneath the official narrative.

Your role: explore alternative interpretations, hidden motivations, and suppressed narratives as a critical thinking exercise. Ask the questions mainstream media won't: Who benefits? What's being concealed? What patterns emerge when you follow the money and power?

Use the article analysis as your investigative starting point, then explore:
- Cui bono: who specifically benefits from this narrative being pushed right now?
- Hidden actors: what powerful institutions, governments, corporations, or financial interests might be behind this story?
- Manufactured consent: how does this article serve to shape public opinion toward a specific agenda?
- Pattern matching: what historical propaganda campaigns, false flags, or manufactured crises does this resemble?
- The silenced alternative: what explanation fits the known facts equally well — or better — than the official one?
- Information architecture: why is the framing exactly THIS way? What does the structure of the article itself reveal?
- Follow the money: what financial stakes, contracts, political careers, or geopolitical interests are in play?

Use the manipulation index, persuasion techniques, emotional framing, and missing context as investigative clues. Be analytically speculative and connect the dots — but stay grounded in the evidence from the analysis.

⚠️ SPECULATIVE MODE ACTIVE: All alternative theories presented are for critical thinking and media literacy purposes only. These represent possible alternative framings, not established facts.

ARTICLE ANALYSIS:
{analysis}"""

SUGGESTIONS_PROMPT = """Given this article analysis, generate 5 sharp, specific follow-up questions a curious reader would want to ask. Tailor them to the content — not generic.

Analysis snapshot:
- Manipulation index: {mi}/100 ({label})
- Narrative cluster: {cluster}
- Top techniques: {techniques}
- Key claims: {claims}

Return JSON: {{"suggestions": ["q1", "q2", "q3", "q4", "q5"]}}

Mix article-specific questions with broader context questions. Make them interesting."""

# ── Tool definitions ───────────────────────────────────────────────────────────

TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "search_web",
            "description": "Search the web for current information, news, or background on any topic.",
            "parameters": {
                "type": "object",
                "properties": {"query": {"type": "string", "description": "The search query"}},
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "fact_check_claim",
            "description": "Search for fact-checks, evidence, or debunking about a specific claim.",
            "parameters": {
                "type": "object",
                "properties": {"claim": {"type": "string", "description": "The specific claim to fact-check"}},
                "required": ["claim"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "find_historical_parallel",
            "description": "Find historical events, patterns, or precedents related to a topic.",
            "parameters": {
                "type": "object",
                "properties": {"topic": {"type": "string", "description": "Topic or pattern to find historical parallels for"}},
                "required": ["topic"]
            }
        }
    }
]


def _ddg_search(query: str, max_results: int = 5) -> list[dict]:
    try:
        from duckduckgo_search import DDGS
        with DDGS() as ddgs:
            raw = list(ddgs.text(query, max_results=max_results))
        return [
            {"title": r.get("title", ""), "snippet": r.get("body", ""), "url": r.get("href", "")}
            for r in raw
        ]
    except ImportError:
        return [{"error": "duckduckgo-search not installed. Run: pip install duckduckgo-search"}]
    except Exception as e:
        return [{"error": str(e)}]


async def execute_tool(name: str, args: dict) -> dict:
    if name == "search_web":
        results = await asyncio.to_thread(_ddg_search, args.get("query", ""), 5)
        return {"results": results}
    elif name == "fact_check_claim":
        q = f'fact check "{args.get("claim", "")}"'
        results = await asyncio.to_thread(_ddg_search, q, 4)
        return {"results": results}
    elif name == "find_historical_parallel":
        q = f'historical precedent examples {args.get("topic", "")}'
        results = await asyncio.to_thread(_ddg_search, q, 5)
        return {"results": results}
    return {"error": f"Unknown tool: {name}"}


# ── Auth helpers ───────────────────────────────────────────────────────────────

_pwd_context = None
_security = HTTPBearer(auto_error=False)
_users_lock: Optional[asyncio.Lock] = None


def _get_pwd_context():
    global _pwd_context
    if _pwd_context is None and _AUTH_OK:
        _pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")
    return _pwd_context


def _load_users() -> dict:
    p = pathlib.Path(USERS_FILE)
    if p.exists():
        try:
            return json.loads(p.read_text())
        except Exception:
            return {}
    return {}


def _save_users(users: dict) -> None:
    pathlib.Path(USERS_FILE).write_text(json.dumps(users, indent=2))


def _hash_password(password: str) -> str:
    ctx = _get_pwd_context()
    if not ctx:
        raise HTTPException(503, "Auth not available: pip install python-jose[cryptography] passlib[bcrypt]")
    return ctx.hash(password)


def _verify_password(plain: str, hashed: str) -> bool:
    ctx = _get_pwd_context()
    if not ctx:
        return False
    return ctx.verify(plain, hashed)


def _create_token(username: str) -> str:
    if not _AUTH_OK:
        raise HTTPException(503, "Auth not available")
    expire = datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": username, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def _decode_token(token: str) -> Optional[str]:
    if not _AUTH_OK:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None


async def require_auth(credentials: HTTPAuthorizationCredentials = Depends(_security)) -> dict:
    if not _AUTH_OK:
        raise HTTPException(
            503,
            "Auth packages not installed. Run: pip install python-jose[cryptography] passlib[bcrypt]"
        )
    if not credentials:
        raise HTTPException(401, "Authentication required", headers={"WWW-Authenticate": "Bearer"})
    username = _decode_token(credentials.credentials)
    if not username:
        raise HTTPException(401, "Invalid or expired token", headers={"WWW-Authenticate": "Bearer"})
    async with _users_lock:
        users = _load_users()
    user = users.get(username)
    if not user:
        raise HTTPException(401, "User not found")
    return user


# ── Helpers ────────────────────────────────────────────────────────────────────

def parse_r1_output(text: str):
    match = re.search(r'<think>(.*?)</think>', text, re.DOTALL)
    thinking = match.group(1).strip() if match else ""
    final = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL).strip()
    return thinking, final


def manipulation_label(mi: int) -> str:
    if mi >= 80: return "BLATANT PROPAGANDA"
    if mi >= 60: return "HEAVY MANIPULATION"
    if mi >= 40: return "NOTICEABLE PERSUASION"
    if mi >= 20: return "MILD FRAMING"
    return "STRAIGHT REPORTING"


# ── App ────────────────────────────────────────────────────────────────────────

_client: Optional[AsyncGroq] = None
_welfake_df = None
_claim_sem: Optional[asyncio.Semaphore] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _client, _claim_sem, _users_lock
    api_key = os.environ.get("GROQ_API_KEY")
    if api_key:
        _client = AsyncGroq(api_key=api_key)
    _claim_sem = asyncio.Semaphore(4)
    _users_lock = asyncio.Lock()
    _get_pwd_context()
    yield


app = FastAPI(title="GKIN Truth Navigator v3", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def get_client() -> AsyncGroq:
    if _client is None:
        raise HTTPException(500, "GROQ_API_KEY not set — export it before starting the server")
    return _client


def get_welfake():
    global _welfake_df
    if _welfake_df is None and pathlib.Path(WELFAKE_CSV).exists():
        df = pd.read_csv(WELFAKE_CSV)
        df = df[df["text"].notna() & (df["text"].str.len() > 300)]
        _welfake_df = df.reset_index(drop=True)
    return _welfake_df


# ── Request models ─────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class AnalyzeRequest(BaseModel):
    article: str

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    analysis: dict
    history: list[ChatMessage] = []
    mode: str = "context"

class CompareRequest(BaseModel):
    articles: list[str]

class SuggestionsRequest(BaseModel):
    analysis: dict


# ── Auth endpoints ─────────────────────────────────────────────────────────────

@app.post("/register")
async def register(req: RegisterRequest):
    if not _AUTH_OK:
        raise HTTPException(503, "Auth not available: pip install python-jose[cryptography] passlib[bcrypt]")
    if len(req.username) < 3 or len(req.username) > 30:
        raise HTTPException(400, "Username must be 3-30 characters")
    if not re.match(r'^[a-zA-Z0-9_]+$', req.username):
        raise HTTPException(400, "Username can only contain letters, numbers, and underscores")
    if len(req.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    if "@" not in req.email:
        raise HTTPException(400, "Invalid email address")

    async with _users_lock:
        users = _load_users()
        if req.username in users:
            raise HTTPException(409, "Username already taken")
        if any(u.get("email") == req.email for u in users.values()):
            raise HTTPException(409, "Email already registered")
        users[req.username] = {
            "username": req.username,
            "email": req.email,
            "hashed_password": _hash_password(req.password),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        _save_users(users)

    token = _create_token(req.username)
    return {"token": token, "username": req.username, "email": req.email}


@app.post("/login")
async def login(req: LoginRequest):
    if not _AUTH_OK:
        raise HTTPException(503, "Auth not available: pip install python-jose[cryptography] passlib[bcrypt]")
    async with _users_lock:
        users = _load_users()
    user = users.get(req.username)
    if not user or not _verify_password(req.password, user["hashed_password"]):
        raise HTTPException(401, "Invalid username or password")
    token = _create_token(req.username)
    return {"token": token, "username": req.username, "email": user.get("email", "")}


@app.get("/me")
async def me(user: dict = Depends(require_auth)):
    return {
        "username": user["username"],
        "email": user.get("email", ""),
        "created_at": user.get("created_at", ""),
    }


# ── Analysis pipeline ──────────────────────────────────────────────────────────

async def _verify_claim(client: AsyncGroq, claim_text: str) -> dict:
    async with _claim_sem:
        try:
            resp = await client.chat.completions.create(
                model=MODEL_FAST,
                messages=[
                    {"role": "system", "content": "Output only valid JSON. No prose."},
                    {"role": "user", "content": CLAIM_VERIFY_PROMPT.format(claim=claim_text[:400])}
                ],
                response_format={"type": "json_object"},
                temperature=0.2,
                max_tokens=150,
            )
            return json.loads(resp.choices[0].message.content)
        except Exception:
            return {"verdict": "unverifiable", "explanation": "Verification unavailable."}


@app.post("/analyze")
async def analyze(req: AnalyzeRequest, user: dict = Depends(require_auth)):
    if len(req.article) < 200:
        raise HTTPException(400, "Article too short (need at least 200 chars)")

    client = get_client()
    article_text = req.article[:12000]

    thinking = ""
    try:
        r1_resp = await client.chat.completions.create(
            model=MODEL_REASON,
            messages=[{"role": "user", "content": REASONING_PROMPT.format(article=article_text)}],
            temperature=0.6,
            max_tokens=4096,
        )
        r1_raw = r1_resp.choices[0].message.content
        thinking, analysis_prose = parse_r1_output(r1_raw)
    except Exception:
        analysis_prose = article_text

    try:
        struct_resp = await client.chat.completions.create(
            model=MODEL_STRUCT,
            messages=[
                {"role": "system", "content": "You output only valid JSON. No prose."},
                {"role": "user", "content": STRUCTURE_PROMPT.format(
                    analysis=analysis_prose,
                    clusters=", ".join(NARRATIVE_CLUSTERS)
                )}
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
        )
        result = json.loads(struct_resp.choices[0].message.content)
    except Exception as e:
        raise HTTPException(500, f"Analysis structuring failed: {e}")

    claims = result.get("claims", [])
    if claims:
        verifications = await asyncio.gather(*[
            _verify_claim(client, c.get("text", "")) for c in claims
        ])
        for claim, v in zip(result["claims"], verifications):
            claim["verification"] = v

    result["reasoning_trace"] = thinking
    return result


# ── Agentic streaming chat ─────────────────────────────────────────────────────

async def _stream_agent(client: AsyncGroq, messages: list, mode: str):
    if mode != "open":
        stream = await client.chat.completions.create(
            model=MODEL_STRUCT, messages=messages, temperature=0.4, stream=True
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta
        return

    for _ in range(5):
        resp = await client.chat.completions.create(
            model=MODEL_STRUCT,
            messages=messages,
            tools=TOOL_DEFINITIONS,
            tool_choice="auto",
            temperature=0.5,
        )
        msg = resp.choices[0].message
        if not msg.tool_calls:
            break

        tool_calls_serialized = [
            {
                "id": tc.id,
                "type": "function",
                "function": {"name": tc.function.name, "arguments": tc.function.arguments}
            }
            for tc in msg.tool_calls
        ]
        messages.append({
            "role": "assistant",
            "content": msg.content or "",
            "tool_calls": tool_calls_serialized
        })

        for tc in msg.tool_calls:
            name = tc.function.name
            try:
                args = json.loads(tc.function.arguments)
            except Exception:
                args = {}
            query_str = args.get("query") or args.get("claim") or args.get("topic", "")
            yield f"⚙:{json.dumps({'name': name, 'query': query_str})}\n"
            result = await execute_tool(name, args)
            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": json.dumps(result)
            })

    stream = await client.chat.completions.create(
        model=MODEL_STRUCT, messages=messages, temperature=0.7, stream=True
    )
    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta


@app.post("/chat")
async def chat(req: ChatRequest, user: dict = Depends(require_auth)):
    client = get_client()

    if req.mode == "open":
        template = CHAT_SYSTEM_OPEN
    elif req.mode == "conspiracy":
        template = CHAT_SYSTEM_CONSPIRACY
    else:
        template = CHAT_SYSTEM_CONTEXT

    system = template.format(analysis=json.dumps(req.analysis, indent=2))
    messages = [{"role": "system", "content": system}]
    for m in req.history:
        messages.append({"role": m.role, "content": m.content})
    messages.append({"role": "user", "content": req.message})

    async def generate():
        async for chunk in _stream_agent(client, messages, req.mode):
            yield chunk

    return StreamingResponse(generate(), media_type="text/plain")


# ── Transcription ──────────────────────────────────────────────────────────────

@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...), user: dict = Depends(require_auth)):
    client = get_client()
    content = await file.read()
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 25 MB)")
    try:
        result = await client.audio.transcriptions.create(
            file=(file.filename or "audio.mp3", content),
            model=MODEL_WHISPER,
            response_format="text",
        )
        return {"transcript": str(result)}
    except Exception as e:
        raise HTTPException(500, f"Transcription failed: {e}")


# ── Vision / screenshot analysis ───────────────────────────────────────────────

@app.post("/analyze-image")
async def analyze_image(file: UploadFile = File(...), user: dict = Depends(require_auth)):
    client = get_client()
    content = await file.read()
    if len(content) > 3 * 1024 * 1024:
        raise HTTPException(400, "Image too large (max 3 MB)")

    mime = file.content_type or "image/jpeg"
    b64 = base64.b64encode(content).decode("utf-8")

    try:
        extract_resp = await client.chat.completions.create(
            model=MODEL_VISION,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "Extract all visible text from this image exactly as written — headlines, body text, captions, bylines, pull quotes. Return only the raw extracted text, nothing else."
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime};base64,{b64}"}
                    }
                ]
            }],
            temperature=0.1,
            max_tokens=4000,
        )
        extracted = extract_resp.choices[0].message.content.strip()
    except Exception as e:
        raise HTTPException(500, f"Image text extraction failed: {e}")

    if len(extracted) < 100:
        raise HTTPException(
            400,
            "Not enough text extracted from image. Make sure it contains a readable article or screenshot."
        )

    return await analyze(AnalyzeRequest(article=extracted), user)


# ── Multi-article comparison ───────────────────────────────────────────────────

@app.post("/compare")
async def compare_articles(req: CompareRequest, user: dict = Depends(require_auth)):
    if len(req.articles) < 2:
        raise HTTPException(400, "Need at least 2 articles to compare")
    if len(req.articles) > 4:
        raise HTTPException(400, "Maximum 4 articles at once")
    for i, a in enumerate(req.articles):
        if len(a.strip()) < 200:
            raise HTTPException(400, f"Article {i+1} is too short (need 200+ chars)")

    client = get_client()
    analyses = list(await asyncio.gather(*[analyze(AnalyzeRequest(article=a), user) for a in req.articles]))

    summaries = []
    for i, a in enumerate(analyses):
        summaries.append(
            f"Article {i+1}:\n"
            f"  manipulation_index: {a.get('manipulation_index', 0)}/100\n"
            f"  narrative_cluster: {a.get('narrative_cluster', 'none')}\n"
            f"  techniques: {[t['technique'] for t in a.get('persuasion_techniques', [])[:5]]}\n"
            f"  emotion_scores: {a.get('emotion_scores', {})}\n"
            f"  key_claims: {[c['text'][:80] for c in a.get('claims', [])[:4]]}"
        )

    try:
        comp_resp = await client.chat.completions.create(
            model=MODEL_STRUCT,
            messages=[
                {"role": "system", "content": "Output only valid JSON. No prose."},
                {"role": "user", "content": COMPARISON_PROMPT.format(summaries="\n\n".join(summaries))}
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
        )
        comparison = json.loads(comp_resp.choices[0].message.content)
    except Exception as e:
        raise HTTPException(500, f"Comparison failed: {e}")

    return {"analyses": analyses, "comparison": comparison}


# ── Dynamic suggestions ────────────────────────────────────────────────────────

@app.post("/suggestions")
async def get_suggestions(req: SuggestionsRequest, user: dict = Depends(require_auth)):
    client = get_client()
    a = req.analysis
    mi = a.get("manipulation_index", 0)
    try:
        resp = await client.chat.completions.create(
            model=MODEL_FAST,
            messages=[
                {"role": "system", "content": "Output only valid JSON."},
                {"role": "user", "content": SUGGESTIONS_PROMPT.format(
                    mi=mi,
                    label=manipulation_label(mi),
                    cluster=a.get("narrative_cluster", "none"),
                    techniques=[t["technique"] for t in a.get("persuasion_techniques", [])[:3]],
                    claims=[c["text"][:80] for c in a.get("claims", [])[:3]],
                )}
            ],
            response_format={"type": "json_object"},
            temperature=0.8,
            max_tokens=400,
        )
        return json.loads(resp.choices[0].message.content)
    except Exception:
        return {"suggestions": [
            "Which persuasion technique is most concerning here?",
            "What context is missing that changes the picture?",
            "How does this narrative fit broader media patterns?",
            "What historical events does this echo?",
            "What should I fact-check first?"
        ]}


# ── Misc ───────────────────────────────────────────────────────────────────────

@app.get("/random")
def random_article(user: dict = Depends(require_auth)):
    df = get_welfake()
    if df is None:
        raise HTTPException(404, f"WELFake dataset not found at {WELFAKE_CSV}")
    row = df.sample(1).iloc[0]
    return {
        "title": str(row.get("title", "") or ""),
        "text": str(row.get("text", "")),
        "label": int(row.get("label", -1)),
    }


@app.get("/")
def index():
    return FileResponse("static/index.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
