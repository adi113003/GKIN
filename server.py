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
  POST /fetch-url     {url}              (auth)         → {title, text}
  POST /compare       {articles[]}       (auth)         → {analyses[], comparison}
  POST /suggestions   {analysis}         (auth)         → {suggestions[]}
  GET  /random        (auth)                            → {title, text, label}
  GET  /              → static/index.html

Setup:
  pip install fastapi uvicorn groq pandas python-multipart duckduckgo-search python-jose[cryptography] passlib[bcrypt] trafilatura motor youtube-transcript-api
  export GROQ_API_KEY="your_key"
  export SECRET_KEY="your-secret-key"   # optional, auto-generated if omitted
  export MONGODB_URI="mongodb://localhost:27017"  # optional, defaults to localhost
  python server.py
"""

import os
import re
import html as _html
import json
import base64
import asyncio
import pathlib
import secrets
import statistics as _stats
import urllib.parse
import urllib.request
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Optional

from dotenv import load_dotenv
load_dotenv()

from motor.motor_asyncio import AsyncIOMotorClient

import urllib.parse
import httpx

from fastapi import FastAPI, HTTPException, UploadFile, File, Depends, Query
from fastapi.responses import StreamingResponse, FileResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from groq import AsyncGroq
import pandas as pd
import trafilatura

from gkin.agentic import Deps as AgenticDeps, VerdictCache, configure_tracing, verify_claims

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
# Reasoning pass only (plain, non-JSON). deepseek-r1-distill-llama-70b was
# decommissioned by Groq; gpt-oss-120b is a live chain-of-thought replacement.
# NB: reasoning models are unreliable under response_format=json_object, so all
# JSON calls below use MODEL_STRUCT, not MODEL_REASON.
MODEL_REASON  = "openai/gpt-oss-120b"
MODEL_STRUCT  = "llama-3.3-70b-versatile"
MODEL_FAST    = "llama-3.1-8b-instant"
MODEL_VISION  = "llama-3.2-90b-vision-preview"
MODEL_WHISPER = "whisper-large-v3"

WELFAKE_CSV          = "WELFake_Dataset.csv"
MONGODB_URI          = os.environ.get("MONGODB_URI", "mongodb://localhost:27017")
SECRET_KEY           = os.environ.get("SECRET_KEY", "gkin-dev-" + secrets.token_hex(16))
ALGORITHM            = "HS256"
TOKEN_EXPIRE_DAYS    = 7
GOOGLE_CLIENT_ID     = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI  = os.environ.get("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/google/callback")
FRONTEND_URL         = os.environ.get("FRONTEND_URL", "")

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
    {{"text": "claim text", "type": "Verifiable | Opinion | Unverifiable", "confidence": 0.0, "citation_ids": []}}
  ],
  "persuasion_techniques": [
    {{"technique": "fear_appeal | bandwagon | loaded_language | false_urgency | authority_appeal | whataboutism | black_and_white",
      "span": "exact quote from article", "explanation": "one sentence"}}
  ],
  "emotion_scores": {{"fear": 0, "anger": 0, "disgust": 0, "hope": 0, "guilt": 0, "ingroup_framing": 0}},
  "manipulation_rubric": {{
    "components": [
      {{"name": "persuasion_techniques", "points": 0, "max": 40, "rationale": "which techniques, scored per the table"}},
      {{"name": "emotional_intensity", "points": 0, "max": 25, "rationale": "based on the emotion_scores above"}},
      {{"name": "missing_context", "points": 0, "max": 20, "rationale": "severity of one-sided omissions"}},
      {{"name": "framing_language", "points": 0, "max": 15, "rationale": "headline/structure/attribution slant"}}
    ],
    "band": "straightforward | mild_framing | noticeable | heavy | propaganda"
  }},
  "manipulation_index": 0,
  "missing_context": [
    {{"gap": "what is missing", "why_it_matters": "one sentence"}}
  ],
  "narrative_cluster": "one of the 20 categories"
}}

Rules:
- All emotion scores are 0-100 integers. narrative_cluster must be one of: {clusters}.
- Cap techniques at 8, claims at 12, missing_context at 5.
- For each Verifiable claim, include a citation_ids array. Leave it empty here — the
  server populates it after evidence retrieval by matching the scraped sources used
  to verify that claim (indices into sources_used). Opinion/Unverifiable claims
  must keep citation_ids as an empty array.

MANIPULATION SCORECARD — do not pick a vibe-based number. Score each of the four
components below against its stated rules, put the points + a one-line rationale in
manipulation_rubric.components, and set manipulation_index = the SUM of the four
component point values (0-100). The number must equal the sum; a human will audit
each component against these rules.

1. persuasion_techniques (0-40): score every distinct technique you listed above,
   then sum and cap at 40.
   - High-impact (fear_appeal, false_urgency, loaded_language): 0 if absent,
     ~5 for a single/mild instance, up to 10 if pervasive or intense — per technique.
   - Medium-impact (bandwagon, authority_appeal, black_and_white, whataboutism):
     0 if absent, ~3 mild, up to 6 if pervasive — per technique.
2. emotional_intensity (0-25): driven by the emotion_scores. If the strongest
   emotion is <30 -> 0-5; 30-60 -> 6-15; >60 -> 16-25. Add a few points when
   multiple emotions are simultaneously high.
3. missing_context (0-20): 0 if no material omissions; 5-10 for minor gaps;
   11-20 when omissions are one-sided enough to change a reader's interpretation.
4. framing_language (0-15): headline/lede slant, attribution framing, and loaded
   structure not already captured above. 0 neutral; up to 15 heavily slanted.

BANDS (set manipulation_rubric.band from the total): 0-20 straightforward,
21-40 mild_framing, 41-60 noticeable, 61-80 heavy, 81-100 propaganda.
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

IMPORTANT: All web search queries MUST be in English regardless of the article's original language. Translate any non-English claim or topic to English before calling search tools. Always respond to the user in English.

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

IMPORTANT: All web search queries MUST be in English. Translate non-English topics before calling search tools. Always respond in English.

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

# ── AI-Generated text detection ────────────────────────────────────────────────

AI_PHRASES = [
    "it is important to note", "it is worth noting", "it is crucial to",
    "it is essential to", "it should be noted", "as previously mentioned",
    "in conclusion", "furthermore", "moreover", "in summary",
    "with that being said", "on the other hand", "in light of",
    "it can be argued", "it is clear that", "taking into account",
    "it goes without saying", "needless to say", "at the end of the day",
    "the fact of the matter", "it's important to", "it's worth",
    "delve into", "dive into", "shed light on", "in today's world",
    "the landscape of", "a testament to", "plays a crucial role",
    "in the realm of", "multifaceted", "it is worth mentioning",
    "revolutionize", "game-changer", "transformative", "seamlessly",
    "leverage", "utilize", "robust", "pivotal", "noteworthy",
    "in today's", "as we navigate", "it is undeniable", "it is imperative",
    "rest assured", "look no further", "without further ado",
    "as an ai", "as a language model", "i cannot provide",
]

AI_DETECT_PROMPT = """You are an expert forensic linguist specializing in AI-generated text detection.

Analyze this article for signs that it was written by an AI language model rather than a human journalist.

Key AI writing signals to look for:
- Unnaturally uniform sentence length and structure (low burstiness)
- Overuse of hedging transitions: "Furthermore", "Moreover", "It is important to note", "It is worth mentioning"
- Perfectly balanced "on one hand / on the other hand" structures
- Generic comprehensive coverage with no editorial voice, opinion, or personality
- Absence of idiom, humor, sarcasm, or stylistic quirks
- Overly smooth flow with no rough edges, abrupt cuts, or stylistic choices
- Formulaic paragraph structure (topic sentence → evidence → conclusion)
- Repetitive sentence templates across paragraphs
- Lack of named sources cited naturally ("John Smith, a professor at..." vs vague "experts say")
- Unnatural specificity mixed with vague generalities
- No typos, contractions used awkwardly, or colloquialisms

Statistical pre-analysis (already computed):
- Sentence burstiness: {burstiness} (humans typically > 0.5; AI typically < 0.4)
- Vocabulary richness (type-token ratio): {vocab_richness}
- Known AI phrase count: {ai_phrase_hits}
- Average sentence length: {avg_sentence_length} words

Article:
\"\"\"
{article}
\"\"\"

Return ONLY valid JSON:
{{
  "ai_confidence": 0,
  "verdict": "HUMAN | LIKELY HUMAN | UNCERTAIN | LIKELY AI | AI",
  "reasoning": "2-3 sentences citing specific textual evidence",
  "ai_signals": ["specific phrases or patterns from the text that suggest AI authorship"],
  "human_signals": ["specific phrases or patterns from the text that suggest human authorship"]
}}

ai_confidence: integer 0-100. 0 = definitely human-written, 100 = definitely AI-generated.
Base your assessment on specific textual evidence, not just the statistics."""

TIMELINE_EXTRACT_PROMPT = """Extract the core topic and diverse search queries from this article for comprehensive narrative timeline research.

Article (first 1000 chars):
\"\"\"
{article}
\"\"\"

Return ONLY valid JSON:
{{
  "topic": "3-6 word topic phrase for searching (e.g. 'Iran nuclear talks deadline')",
  "search_queries": [
    "query focused on the core event or main claim",
    "query focused on the key actors or people involved",
    "query focused on the latest development or outcome",
    "query focused on background or historical context",
    "query for fact-check, verification, or debunking angle",
    "query for opposing perspectives, criticism, or counter-narrative"
  ],
  "core_claim": "the single most central factual claim in one sentence"
}}"""

TIMELINE_ANALYZE_PROMPT = """You are a narrative forensics analyst. Deeply analyze how this news story evolved across different sources and dates.

Topic: {topic}
Core claim from original article: {core_claim}

Related articles found across the web (sorted oldest to newest where dates are known):
{articles_text}

Analyze each article and the overall narrative pattern. Look for:
- Where did the story originate? Which source published earliest?
- What claims were added, dropped, or distorted as it spread?
- Which outlets corroborated vs. contradicted vs. independently reported?
- Is there a coordinated amplification pattern?
- What important context was omitted?

Return ONLY valid JSON:
{{
  "origin_assessment": "2-3 sentences on which source appears to be the origin and why, noting the earliest date or earliest report found",
  "narrative_verdict": "one of exactly: CORROBORATED | CONTRADICTED | DISPUTED | MIXED | UNVERIFIED",
  "credibility_score": 0,
  "article_assessments": [
    {{
      "index": 1,
      "corroboration": "one of exactly: CORROBORATES | CONTRADICTS | INDEPENDENT | PARTIAL | UNRELATED",
      "key_quote": "the single most relevant sentence from this article (max 120 chars)",
      "bias_note": "3-5 word description e.g. 'neutral wire report', 'left-leaning op-ed', 'sensationalist headline', 'pro-government framing'"
    }}
  ],
  "narrative_shifts": [
    {{
      "what_changed": "specific claim or framing that shifted (10-15 words)",
      "original_version": "how it was originally stated",
      "mutated_version": "how it changed in later coverage",
      "source": "outlet where this change first appeared"
    }}
  ],
  "dropped_context": ["important fact or context omitted as the story spread", "another omitted fact"],
  "amplification_chain": ["source1", "source2", "source3", "source4", "source5", "source6", "source7", "source8"],
  "timeline_summary": "3-4 sentence summary: where the story started, how it evolved, who corroborated or contradicted it, and overall credibility assessment"
}}

IMPORTANT: credibility_score must be an integer 0-100 (0=fully fake/contradicted by all sources, 100=fully corroborated by multiple credible independent sources).
Provide article_assessments for EVERY article indexed above. Keep narrative_shifts to at most 6. Keep amplification_chain to at most 8 outlets."""

FAKE_DETECT_PROMPT = """You are an expert misinformation analyst. Your job is to determine whether a news article is FAKE or REAL.

You have been given:
1. The original article text
2. A manipulation analysis
3. Scraped web pages — each labeled with its trust tier

SOURCE TRUST TIERS (apply when scoring):
- Tier 1 (highest): government .gov sites, peer-reviewed journals (PubMed/arXiv/JSTOR), official press releases
- Tier 2 (verified journalism): Reuters, AP, AFP, BBC, NPR, NYT, Washington Post, WSJ, major regional outlets
- Tier 3 (fact-checkers): PolitiFact, Snopes, FactCheck.org, Full Fact, AP Fact Check
- Unverified: social media, anonymous blogs, partisan sites — do NOT treat as corroboration

SCORING RULES:
- Corroboration from Tier 1 or Tier 2 sources strongly lowers fake_confidence.
- Corroboration ONLY from Unverified sources should NOT lower fake_confidence.
- If {only_unverified} is true (no Tier 1/2/3 sources found), raise fake_confidence by at least 20 points.
- Contradiction from any Tier 1 or Tier 2 source raises fake_confidence significantly.

Article:
\"\"\"
{article}
\"\"\"

Manipulation analysis:
- Manipulation index: {manipulation_index}/100
- Persuasion techniques: {techniques}
- Dominant emotions: {emotions}
- Narrative cluster: {narrative_cluster}
- Claim verdicts: {claim_verifications}
- Trusted sources found: {trusted_source_count} of {total_sources} scraped pages are Tier 1/2/3

Scraped web pages for verification (with trust tier):
{search_results}

Return ONLY valid JSON — no prose, no markdown:
{{
  "fake_confidence": 0,
  "reasoning": "2-3 sentences referencing specific scraped pages and their tiers",
  "red_flags": ["specific red flags found"],
  "trust_signals": ["specific trust signals found, citing tier where relevant"]
}}

fake_confidence is an integer 0-100. 0 = definitely real, 100 = definitely fake.
"""

# ── Trusted source allowlist ──────────────────────────────────────────────────

TRUSTED_SOURCES: dict[str, dict] = {
    # Tier 1 — Primary / Official
    ".gov":              {"tier": 1, "name": "Government (.gov)"},
    "pubmed.ncbi.nlm.nih.gov": {"tier": 1, "name": "PubMed"},
    "arxiv.org":         {"tier": 1, "name": "arXiv"},
    "jstor.org":         {"tier": 1, "name": "JSTOR"},
    "who.int":           {"tier": 1, "name": "WHO"},
    "un.org":            {"tier": 1, "name": "United Nations"},
    "europa.eu":         {"tier": 1, "name": "European Union"},
    # Tier 2 — Established journalism
    "reuters.com":       {"tier": 2, "name": "Reuters"},
    "apnews.com":        {"tier": 2, "name": "Associated Press"},
    "afp.com":           {"tier": 2, "name": "AFP"},
    "bbc.com":           {"tier": 2, "name": "BBC News"},
    "bbc.co.uk":         {"tier": 2, "name": "BBC News"},
    "npr.org":           {"tier": 2, "name": "NPR"},
    "pbs.org":           {"tier": 2, "name": "PBS NewsHour"},
    "nytimes.com":       {"tier": 2, "name": "New York Times"},
    "washingtonpost.com":{"tier": 2, "name": "Washington Post"},
    "wsj.com":           {"tier": 2, "name": "Wall Street Journal"},
    "theguardian.com":   {"tier": 2, "name": "The Guardian"},
    "economist.com":     {"tier": 2, "name": "The Economist"},
    "ft.com":            {"tier": 2, "name": "Financial Times"},
    "bloomberg.com":     {"tier": 2, "name": "Bloomberg"},
    "time.com":          {"tier": 2, "name": "TIME"},
    "theatlantic.com":   {"tier": 2, "name": "The Atlantic"},
    # Tier 3 — Fact-checkers
    "politifact.com":    {"tier": 3, "name": "PolitiFact"},
    "snopes.com":        {"tier": 3, "name": "Snopes"},
    "factcheck.org":     {"tier": 3, "name": "FactCheck.org"},
    "fullfact.org":      {"tier": 3, "name": "Full Fact"},
}


def _source_tier(url: str) -> dict:
    """Return tier info for a URL, or unverified if not in allowlist."""
    try:
        host = urllib.parse.urlparse(url).hostname or ""
    except Exception:
        return {"tier": 0, "name": "Unverified", "trusted": False}
    # Exact match first, then suffix match
    for domain, info in TRUSTED_SOURCES.items():
        if domain.startswith("."):
            if host.endswith(domain) or host == domain[1:]:
                return {**info, "trusted": True}
        elif host == domain or host.endswith("." + domain):
            return {**info, "trusted": True}
    return {"tier": 0, "name": host or "Unverified", "trusted": False}


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
_mongo_client: Optional[AsyncIOMotorClient] = None
_users_col = None


def _get_pwd_context():
    global _pwd_context
    if _pwd_context is None and _AUTH_OK:
        _pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")
    return _pwd_context


def _get_users_col():
    if _users_col is None:
        raise HTTPException(503, "Database not ready")
    return _users_col


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
    user = await _get_users_col().find_one({"username": username}, {"_id": 0})
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
_fake_model = None
_verdict_cache: Optional[VerdictCache] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _client, _claim_sem, _mongo_client, _users_col, _fake_model, _verdict_cache
    api_key = os.environ.get("GROQ_API_KEY")
    if api_key:
        _client = AsyncGroq(api_key=api_key)
    _claim_sem = asyncio.Semaphore(4)
    configure_tracing()          # structured JSON traces for the agentic loop
    _verdict_cache = VerdictCache()
    _mongo_client = AsyncIOMotorClient(MONGODB_URI)
    _users_col = _mongo_client["gkin"]["users"]
    await _users_col.create_index("username", unique=True)
    await _users_col.create_index("email", unique=True)
    _get_pwd_context()
    try:
        import joblib
        _fake_model = joblib.load("baseline_model.joblib")
        print("✓ Fake detection model loaded (97% accuracy on WELFake)")
    except Exception as e:
        print(f"⚠ Fake detection model not loaded: {e}")
    yield
    _mongo_client.close()


app = FastAPI(title="GKIN Truth Navigator v3", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.mount("/assets", StaticFiles(directory="static/assets"), name="assets")
app.mount("/landing", StaticFiles(directory="static/landing"), name="landing")
app.mount("/analyzer", StaticFiles(directory="static/analyzer"), name="analyzer")


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

class FetchUrlRequest(BaseModel):
    url: str

class TimelineRequest(BaseModel):
    article: str

class VerifyClaimsRequest(BaseModel):
    claims: list[str]
    max_claims: int = 5      # per-article cap on claims that run the loop
    force_refresh: bool = False


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

    col = _get_users_col()
    try:
        await col.insert_one({
            "username": req.username,
            "email": req.email,
            "hashed_password": _hash_password(req.password),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:
        err = str(e)
        if "username" in err:
            raise HTTPException(409, "Username already taken")
        if "email" in err:
            raise HTTPException(409, "Email already registered")
        raise HTTPException(500, "Registration failed")

    token = _create_token(req.username)
    return {"token": token, "username": req.username, "email": req.email}


@app.post("/login")
async def login(req: LoginRequest):
    if not _AUTH_OK:
        raise HTTPException(503, "Auth not available: pip install python-jose[cryptography] passlib[bcrypt]")
    user = await _get_users_col().find_one({"username": req.username}, {"_id": 0})
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


# ── Google OAuth ──────────────────────────────────────────────────────────────

@app.get("/auth/google")
async def auth_google():
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(503, "Google OAuth not configured — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET")
    params = urllib.parse.urlencode({
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
    })
    return RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{params}")


@app.get("/auth/google/callback")
async def auth_google_callback(code: str = Query(None), error: str = Query(None)):
    if error or not code:
        return RedirectResponse("/?auth_error=google_denied")

    async with httpx.AsyncClient() as http:
        token_resp = await http.post("https://oauth2.googleapis.com/token", data={
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        })
        tokens = token_resp.json()
        if "error" in tokens:
            return RedirectResponse("/?auth_error=token_exchange_failed")

        userinfo_resp = await http.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        userinfo = userinfo_resp.json()

    email = userinfo.get("email", "")
    if not email:
        return RedirectResponse("/?auth_error=no_email")

    col = _get_users_col()
    user = await col.find_one({"email": email}, {"_id": 0})

    if user:
        username = user["username"]
    else:
        base = re.sub(r'[^a-zA-Z0-9_]', '', email.split("@")[0].replace(".", "_"))[:28] or "user"
        username = base
        counter = 1
        while await col.find_one({"username": username}):
            username = f"{base}{counter}"
            counter += 1
        await col.insert_one({
            "username": username,
            "email": email,
            "google_id": userinfo.get("id", ""),
            "hashed_password": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    token = _create_token(username)
    base = FRONTEND_URL.rstrip("/") if FRONTEND_URL else ""
    return RedirectResponse(f"{base}/login?token={token}&username={urllib.parse.quote(username)}")


# ── Analysis pipeline ──────────────────────────────────────────────────────────

def _scrape_page_sync(url: str) -> Optional[str]:
    try:
        downloaded = trafilatura.fetch_url(url)
        if not downloaded:
            return None
        text = trafilatura.extract(downloaded, include_comments=False, include_tables=False)
        return text[:1500] if text else None
    except Exception:
        return None


async def _scrape_pages(urls: list[str]) -> list[dict]:
    async def _one(url):
        try:
            text = await asyncio.wait_for(asyncio.to_thread(_scrape_page_sync, url), timeout=7.0)
            return {"url": url, "text": text} if text else None
        except Exception:
            return None
    results = await asyncio.gather(*[_one(u) for u in urls[:10]])
    return [r for r in results if r]


async def _fake_detect(client: AsyncGroq, article_text: str, structured: dict) -> dict:
    claims = structured.get("claims", [])
    verifiable = [c for c in claims if c.get("type") == "Verifiable"][:3]
    if not verifiable:
        verifiable = claims[:3]

    # ── Step 1: ML model score (trained on 72k WELFake articles) ──────────────
    ml_fc: Optional[int] = None
    if _fake_model is not None:
        try:
            proba = _fake_model.predict_proba([article_text])[0]
            ml_fc = int(proba[1] * 100)  # proba[1] = P(fake)
        except Exception:
            pass

    # ── Step 2: Search DDG for each verifiable claim, collect real URLs ────────
    sources_checked: list[dict] = []
    all_urls: list[str] = []
    url_to_claim: dict[str, str] = {}  # which Verifiable claim each URL was retrieved for

    for claim_obj in verifiable:
        claim_text = claim_obj.get("text", "")[:150]
        results = await asyncio.to_thread(_ddg_search, f'"{claim_text}"', 4)
        for r in results:
            if r.get("error") or not r.get("url") or not r.get("title"):
                continue
            sources_checked.append({
                "claim": claim_text,
                "url": r["url"],
                "title": r["title"],
                "supports": None,
            })
            all_urls.append(r["url"])
            url_to_claim.setdefault(r["url"], claim_text)

    # Broader topic search to pad up to 10 pages
    if len(all_urls) < 10:
        topic_query = article_text[:120].replace('"', '')
        extra = await asyncio.to_thread(_ddg_search, topic_query + " news", 6)
        for r in extra:
            if r.get("error") or not r.get("url") or not r.get("title"):
                continue
            if r["url"] not in all_urls:
                sources_checked.append({
                    "claim": "topic search",
                    "url": r["url"],
                    "title": r["title"],
                    "supports": None,
                })
                all_urls.append(r["url"])
                url_to_claim.setdefault(r["url"], "topic search")

    # Prioritise trusted sources: sort so Tier 1/2/3 URLs come first
    all_urls.sort(key=lambda u: _source_tier(u)["tier"] if _source_tier(u)["trusted"] else 99)

    # ── Step 3: Scrape up to 10 pages (with metadata for citations) ───────────
    scraped = await _scrape_pages_with_meta(all_urls[:10])
    scraped_block = ""
    for i, page in enumerate(scraped):
        tier_info = _source_tier(page.get("url", ""))
        tier_label = f"Tier {tier_info['tier']} — {tier_info['name']}" if tier_info["trusted"] else f"Unverified — {tier_info['name']}"
        scraped_block += f"\n--- Page {i+1} [{tier_label}] ({page['url']}) ---\n{page['text']}\n"
    if not scraped_block:
        scraped_block = "No pages could be scraped."

    # Build sources_used: surfacing the scraped evidence with full metadata so
    # the frontend can render citations + a per-claim timeline. No new API calls
    # — this is the same scrape data the LLM sees, just preserved in the response.
    sources_used: list[dict] = []
    for page in scraped:
        url = page.get("url", "")
        hostname = page.get("hostname") or ""
        if not hostname and url:
            try:
                hostname = urllib.parse.urlparse(url).hostname or ""
            except Exception:
                hostname = ""
        snippet = (page.get("text") or "")[:240].strip()
        if snippet:
            # Round to nearest sentence end if possible
            cut = max(snippet.rfind(". "), snippet.rfind("! "), snippet.rfind("? "))
            if cut > 80:
                snippet = snippet[: cut + 1]
        tier_info = _source_tier(url)
        sources_used.append({
            "url": url,
            "hostname": hostname,
            "title": page.get("title", "") or hostname or url,
            "published_date": page.get("date") or None,
            "claim_supported": url_to_claim.get(url, "topic search"),
            "relevance_snippet": snippet,
            "tier": tier_info["tier"],
            "tier_name": tier_info["name"],
            "trusted": tier_info["trusted"],
        })

    # ── Step 4: LLM reasoning over scraped content ─────────────────────────────
    techniques = [t.get("technique", "") for t in structured.get("persuasion_techniques", [])[:5]]
    emo = structured.get("emotion_scores", {})
    top_emotions = sorted(emo.items(), key=lambda x: -x[1])[:3]
    claim_verdicts = [
        f'{c.get("text","")[:80]}: {c.get("verification",{}).get("verdict","?")}'
        for c in claims[:5]
    ]

    trusted_count = sum(1 for s in sources_used if s.get("trusted"))
    only_unverified = trusted_count == 0 and len(sources_used) > 0

    prompt = FAKE_DETECT_PROMPT.format(
        article=article_text[:4000],
        manipulation_index=structured.get("manipulation_index", 0),
        techniques=", ".join(techniques) or "none",
        emotions=", ".join(f"{k}={v}" for k, v in top_emotions),
        narrative_cluster=structured.get("narrative_cluster", "none"),
        claim_verifications="; ".join(claim_verdicts) or "none",
        search_results=scraped_block[:8000],
        trusted_source_count=trusted_count,
        total_sources=len(sources_used),
        only_unverified=only_unverified,
    )

    llm_fc = 50
    llm_reasoning = "LLM analysis unavailable."
    red_flags: list[str] = []
    trust_signals: list[str] = []
    try:
        resp = await client.chat.completions.create(
            model=MODEL_STRUCT,
            messages=[
                {"role": "system", "content": "Output only valid JSON. No prose."},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
            max_tokens=600,
        )
        llm_out = json.loads(resp.choices[0].message.content)
        llm_fc = max(0, min(100, int(llm_out.get("fake_confidence", 50))))
        llm_reasoning = llm_out.get("reasoning", "")
        red_flags = llm_out.get("red_flags", [])
        trust_signals = llm_out.get("trust_signals", [])
    except Exception:
        pass

    # ── Step 5: Combine ML (60%) + LLM (40%) ──────────────────────────────────
    if ml_fc is not None:
        combined_fc = int(round(0.6 * ml_fc + 0.4 * llm_fc))
    else:
        combined_fc = llm_fc
    combined_fc = max(0, min(100, combined_fc))
    trust_rating = 100 - combined_fc

    if combined_fc <= 20:   verdict = "REAL"
    elif combined_fc <= 40: verdict = "LIKELY REAL"
    elif combined_fc <= 60: verdict = "UNCERTAIN"
    elif combined_fc <= 80: verdict = "LIKELY FAKE"
    else:                   verdict = "FAKE"

    return {
        "fake_confidence": combined_fc,
        "trust_rating": trust_rating,
        "verdict": verdict,
        "reasoning": llm_reasoning,
        "red_flags": red_flags,
        "trust_signals": trust_signals,
        "sources_checked": sources_checked[:10],
        "sources_used": sources_used,
        "trusted_source_count": trusted_count,
        "only_unverified_sources": only_unverified,
        "ml_score": ml_fc,
        "pages_scraped": len(scraped),
    }


def _compute_ai_stats(text: str) -> dict:
    sentences = [s.strip() for s in re.split(r'[.!?]+', text) if len(s.strip()) > 10]
    words = re.findall(r'\b[a-zA-Z]+\b', text.lower())
    if not sentences or not words:
        return {"ai_stat_score": 50, "burstiness": 0.5, "vocab_richness": 0.5,
                "ai_phrase_hits": 0, "avg_sentence_length": 20}

    sent_lengths = [len(s.split()) for s in sentences]
    mean_len = _stats.mean(sent_lengths)
    std_len = _stats.stdev(sent_lengths) if len(sent_lengths) > 1 else 0
    burstiness = round(std_len / mean_len if mean_len > 0 else 0, 3)

    unique_words = len(set(words))
    ttr = round(unique_words / len(words), 3)

    text_lower = text.lower()
    phrase_hits = sum(1 for p in AI_PHRASES if p in text_lower)
    phrase_density = phrase_hits / max(len(words) / 100, 1)

    avg_sent = round(mean_len, 1)

    # Low burstiness → AI-like
    burst_score = max(0, min(100, int((0.55 - burstiness) * 180))) if burstiness < 0.55 else 0
    # High phrase density → AI-like
    phrase_score = min(100, int(phrase_density * 35))
    # Sentence length in AI sweet-spot (17-24 words) → AI-like
    sent_score = max(0, 45 - int(abs(avg_sent - 20) * 3))
    # Low TTR → AI-like
    ttr_score = max(0, int((0.58 - ttr) * 120)) if ttr < 0.58 else 0

    ai_stat_score = max(0, min(100,
        int(burst_score * 0.35 + phrase_score * 0.35 + sent_score * 0.15 + ttr_score * 0.15)
    ))
    return {
        "ai_stat_score": ai_stat_score,
        "burstiness": burstiness,
        "vocab_richness": ttr,
        "ai_phrase_hits": phrase_hits,
        "avg_sentence_length": avg_sent,
    }


async def _ai_detect(client: AsyncGroq, article_text: str) -> dict:
    stats = _compute_ai_stats(article_text)
    prompt = AI_DETECT_PROMPT.format(
        article=article_text[:5000],
        burstiness=stats["burstiness"],
        vocab_richness=stats["vocab_richness"],
        ai_phrase_hits=stats["ai_phrase_hits"],
        avg_sentence_length=stats["avg_sentence_length"],
    )
    llm_ai_conf = 50
    reasoning = "LLM analysis unavailable."
    ai_signals: list[str] = []
    human_signals: list[str] = []
    try:
        resp = await client.chat.completions.create(
            model=MODEL_STRUCT,
            messages=[
                {"role": "system", "content": "Output only valid JSON. No prose."},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
            max_tokens=500,
        )
        out = json.loads(resp.choices[0].message.content)
        llm_ai_conf = max(0, min(100, int(out.get("ai_confidence", 50))))
        reasoning = out.get("reasoning", "")
        ai_signals = out.get("ai_signals", [])
        human_signals = out.get("human_signals", [])
    except Exception:
        pass

    # 50% statistical, 50% LLM
    combined = max(0, min(100, int(round(0.5 * stats["ai_stat_score"] + 0.5 * llm_ai_conf))))

    if combined <= 20:   verdict = "HUMAN"
    elif combined <= 40: verdict = "LIKELY HUMAN"
    elif combined <= 60: verdict = "UNCERTAIN"
    elif combined <= 80: verdict = "LIKELY AI"
    else:                verdict = "AI GENERATED"

    return {
        "ai_confidence": combined,
        "verdict": verdict,
        "reasoning": reasoning,
        "ai_signals": ai_signals,
        "human_signals": human_signals,
        "stats": stats,
    }


def _scrape_with_meta_sync(url: str) -> Optional[dict]:
    try:
        downloaded = trafilatura.fetch_url(url)
        if not downloaded:
            return None
        result = trafilatura.extract(
            downloaded, output_format="json", with_metadata=True,
            include_comments=False, include_tables=False, favor_precision=True,
        )
        if not result:
            return None
        data = json.loads(result)
        text = (data.get("text") or "").strip()
        if len(text) < 80:
            return None
        return {
            "url": url,
            "title": (data.get("title") or "").strip(),
            "date": (data.get("date") or "").strip(),
            "hostname": (data.get("hostname") or "").strip(),
            "text": text[:2000],
        }
    except Exception:
        return None


async def _scrape_pages_with_meta(urls: list[str]) -> list[dict]:
    async def _one(url):
        try:
            return await asyncio.wait_for(
                asyncio.to_thread(_scrape_with_meta_sync, url), timeout=8.0
            )
        except Exception:
            return None
    results = await asyncio.gather(*[_one(u) for u in urls[:20]])
    return [r for r in results if r]


async def _build_timeline(client: AsyncGroq, article_text: str) -> dict:
    # Step 1: extract topic + 6 diverse search queries
    try:
        ext_resp = await client.chat.completions.create(
            model=MODEL_FAST,
            messages=[
                {"role": "system", "content": "Output only valid JSON. No prose."},
                {"role": "user", "content": TIMELINE_EXTRACT_PROMPT.format(article=article_text[:1000])},
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
            max_tokens=300,
        )
        ext = json.loads(ext_resp.choices[0].message.content)
        topic = ext.get("topic", "")
        queries = ext.get("search_queries", [topic])[:6]
        core_claim = ext.get("core_claim", "")
    except Exception:
        topic = article_text[:80]
        queries = [topic]
        core_claim = topic

    # Step 2: run all queries in parallel — 4 results each, deduped.
    # Sequential search was the main reason /timeline hit nginx's 60s timeout.
    async def _one_search(q: str) -> list[dict]:
        try:
            return await asyncio.wait_for(
                asyncio.to_thread(_ddg_search, q, 4), timeout=10.0
            )
        except Exception:
            return []
    search_batches = await asyncio.gather(*[_one_search(q) for q in queries])

    all_urls: list[str] = []
    seen: set[str] = set()
    for batch in search_batches:
        for r in batch:
            url = r.get("url", "")
            if url and url not in seen and not r.get("error"):
                seen.add(url)
                all_urls.append(url)

    # Step 3: scrape up to 12 pages with full metadata (was 20 — still enough
    # signal for the narrative analysis, halves worst-case scrape time)
    pages = await _scrape_pages_with_meta(all_urls[:12])

    # Sort by date where available
    def _date_key(p):
        d = p.get("date", "")
        return d if d else "9999"
    pages.sort(key=_date_key)

    if not pages:
        return {
            "topic": topic,
            "core_claim": core_claim,
            "entries": [],
            "sources_used": [],
            "claim_timeline": [],
            "narrative_shifts": [],
            "dropped_context": [],
            "amplification_chain": [],
            "origin_assessment": "No related articles could be found.",
            "timeline_summary": "Insufficient data to build a narrative timeline.",
            "narrative_verdict": "UNVERIFIED",
            "credibility_score": 50,
        }

    # Step 4: build text block for LLM (1200 chars per article for depth)
    articles_text = ""
    entries = []
    for i, p in enumerate(pages):
        label = f"[{i+1}] {p.get('hostname','?')} | {p.get('date','date unknown')} | {p.get('title','')}"
        articles_text += f"\n{label}\n{p['text'][:1200]}\n"
        entries.append({
            "index": i + 1,
            "url": p["url"],
            "title": p.get("title", ""),
            "date": p.get("date", ""),
            "hostname": p.get("hostname", ""),
        })

    # Step 5: deep LLM narrative forensics analysis
    try:
        ana_resp = await client.chat.completions.create(
            model=MODEL_STRUCT,
            messages=[
                {"role": "system", "content": "Output only valid JSON. No prose."},
                {"role": "user", "content": TIMELINE_ANALYZE_PROMPT.format(
                    topic=topic,
                    core_claim=core_claim,
                    articles_text=articles_text[:9000],
                )},
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
            max_tokens=1800,
        )
        ana = json.loads(ana_resp.choices[0].message.content)
    except Exception:
        ana = {
            "origin_assessment": "Analysis unavailable.",
            "narrative_shifts": [],
            "dropped_context": [],
            "amplification_chain": [],
            "timeline_summary": "Timeline data collected but narrative analysis failed.",
            "narrative_verdict": "UNVERIFIED",
            "credibility_score": 50,
            "article_assessments": [],
        }

    # Step 6: merge per-article assessments into entries
    assessments = {a.get("index"): a for a in ana.get("article_assessments", [])}
    for e in entries:
        asmt = assessments.get(e["index"], {})
        e["corroboration"] = asmt.get("corroboration", "INDEPENDENT")
        e["key_quote"] = asmt.get("key_quote", "")
        e["bias_note"] = asmt.get("bias_note", "")

    # Step 7: build sources_used + claim_timeline for the citations UI.
    # /timeline currently focuses on a single core_claim, so claim_timeline is
    # a one-entry array. pages is already sorted oldest→newest above.
    sources_used = []
    for p in pages:
        snippet = (p.get("text") or "")[:240].strip()
        cut = max(snippet.rfind(". "), snippet.rfind("! "), snippet.rfind("? "))
        if cut > 80:
            snippet = snippet[: cut + 1]
        sources_used.append({
            "url": p.get("url", ""),
            "hostname": p.get("hostname", "") or "",
            "title": p.get("title", "") or p.get("hostname", "") or p.get("url", ""),
            "published_date": p.get("date") or None,
            "claim_supported": core_claim or topic,
            "relevance_snippet": snippet,
        })

    dated = [p for p in pages if p.get("date")]
    first_reported = ""
    if dated:
        d0 = dated[0]
        first_reported = f"{d0.get('hostname', '')} · {d0.get('date', '')}".strip(" ·")

    timeline_entries = []
    for i, p in enumerate(pages):
        a = assessments.get(i + 1, {})
        corro = (a.get("corroboration") or "INDEPENDENT").upper()
        diff_map = {
            "CORROBORATES": "Restates the original claim.",
            "CONTRADICTS":  "Contradicts the original claim.",
            "PARTIAL":      "Partial agreement; some details differ.",
            "INDEPENDENT":  "Independent report on the same topic.",
            "UNRELATED":    "Adjacent topic; does not address the claim.",
        }
        how = a.get("key_quote") or diff_map.get(corro, "Coverage of the same topic.")
        timeline_entries.append({
            "date": p.get("date") or "",
            "hostname": p.get("hostname", "") or "",
            "url": p.get("url", ""),
            "how_claim_changed": how[:200],
        })

    claim_timeline = [{
        "claim": core_claim or topic,
        "first_reported": first_reported,
        "timeline_entries": timeline_entries,
    }] if timeline_entries else []

    return {
        "topic": topic,
        "core_claim": core_claim,
        "entries": entries,
        "sources_used": sources_used,
        "claim_timeline": claim_timeline,
        "narrative_shifts": ana.get("narrative_shifts", []),
        "dropped_context": ana.get("dropped_context", []),
        "amplification_chain": ana.get("amplification_chain", []),
        "origin_assessment": ana.get("origin_assessment", ""),
        "timeline_summary": ana.get("timeline_summary", ""),
        "narrative_verdict": ana.get("narrative_verdict", "UNVERIFIED"),
        "credibility_score": int(ana.get("credibility_score", 50)),
    }


def _reconcile_manipulation_index(result: dict) -> None:
    """Anchor manipulation_index to the rubric: it must equal the clamped sum of
    the four component scores, not a free-floating number the model picked. If
    the rubric is missing/malformed, leave the model's index untouched. Also
    backfills the band from the total so it can't disagree with the score."""
    rubric = result.get("manipulation_rubric")
    if not isinstance(rubric, dict):
        return
    components = rubric.get("components")
    if not isinstance(components, list) or not components:
        return
    total = 0
    for comp in components:
        if not isinstance(comp, dict):
            continue
        try:
            pts = int(round(float(comp.get("points", 0) or 0)))
        except (TypeError, ValueError):
            pts = 0
        try:
            cap = int(comp.get("max", 100))
        except (TypeError, ValueError):
            cap = 100
        total += max(0, min(pts, cap))
    total = max(0, min(100, total))
    result["manipulation_index"] = total
    rubric["subtotal"] = total
    if total <= 20:   band = "straightforward"
    elif total <= 40: band = "mild_framing"
    elif total <= 60: band = "noticeable"
    elif total <= 80: band = "heavy"
    else:             band = "propaganda"
    rubric["band"] = band


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


async def _translate_if_needed(client, text: str) -> tuple[str, str]:
    """Detect language; translate to English if non-English.
    Returns (text, language_name). Falls back silently on any error."""
    try:
        detect_resp = await client.chat.completions.create(
            model=MODEL_FAST,
            messages=[{"role": "user", "content":
                f"What language is this text written in? Reply with just the language name, nothing else.\n\n{text[:600]}"}],
            temperature=0.0,
            max_tokens=12,
        )
        language = detect_resp.choices[0].message.content.strip().strip(".")
    except Exception:
        return text, "English"

    if "english" in language.lower():
        return text, "English"

    try:
        trans_resp = await client.chat.completions.create(
            model=MODEL_FAST,
            messages=[
                {"role": "system", "content":
                    "Translate the following text to English. Preserve the full meaning and all details. "
                    "Output only the translation with no preamble or explanation."},
                {"role": "user", "content": text},
            ],
            temperature=0.1,
            max_tokens=6000,
        )
        translated = trans_resp.choices[0].message.content.strip()
        return translated, language
    except Exception:
        return text, language


@app.post("/analyze")
async def analyze(req: AnalyzeRequest, user: dict = Depends(require_auth)):
    if len(req.article) < 200:
        raise HTTPException(400, "Article too short (need at least 200 chars)")

    client = get_client()
    raw_text = req.article[:12000]
    article_text, source_language = await _translate_if_needed(client, raw_text)

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

    # Anchor manipulation_index to the auditable rubric sum (additive field).
    _reconcile_manipulation_index(result)

    claims = result.get("claims", [])
    if claims:
        verifications, fake_result, ai_result = await asyncio.gather(
            asyncio.gather(*[_verify_claim(client, c.get("text", "")) for c in claims]),
            _fake_detect(client, article_text, result),
            _ai_detect(client, article_text),
        )
        for claim, v in zip(result["claims"], verifications):
            claim["verification"] = v
    else:
        fake_result, ai_result = await asyncio.gather(
            _fake_detect(client, article_text, result),
            _ai_detect(client, article_text),
        )

    result["reasoning_trace"] = thinking
    result["fake_detection"] = fake_result
    result["ai_detection"] = ai_result
    result["source_language"] = source_language

    # Attach citation_ids to each Verifiable claim by matching against the
    # claim text used at DDG-search time (preserved in sources_used.claim_supported).
    # Deterministic — same scrape data the LLM already saw, no extra API call.
    raw_sources = fake_result.get("sources_used", []) if isinstance(fake_result, dict) else []
    claim_to_indices: dict[str, list[int]] = {}
    if raw_sources:
        for i, s in enumerate(raw_sources):
            key = s.get("claim_supported", "")
            claim_to_indices.setdefault(key, []).append(i)

    referenced: set[int] = set()
    if result.get("claims"):
        for claim in result["claims"]:
            if claim.get("type") != "Verifiable":
                claim["citation_ids"] = []
                continue
            needle = (claim.get("text", "") or "")[:150]
            ids = claim_to_indices.get(needle, [])
            claim["_pending_ids"] = ids
            referenced.update(ids)

    # Prune sources_used to only sources at least one Verifiable claim cites.
    # Drops "topic search" padding + any scraped page no claim tied back to.
    kept_sources: list[dict] = []
    old_to_new: dict[int, int] = {}
    for old_idx, s in enumerate(raw_sources):
        if old_idx in referenced:
            old_to_new[old_idx] = len(kept_sources)
            kept_sources.append(s)

    if result.get("claims"):
        for claim in result["claims"]:
            pending = claim.pop("_pending_ids", None)
            if pending is None:
                continue
            claim["citation_ids"] = [old_to_new[i] for i in pending if i in old_to_new]

    result["sources_used"] = kept_sources

    return result


def _build_agentic_deps() -> AgenticDeps:
    """Wire the agentic loop to this server's existing DuckDuckGo + trafilatura
    + source-tier path. Injected so gkin.agentic never imports server."""
    return AgenticDeps(
        client=get_client(),
        ddg_search=_ddg_search,
        scrape_pages=_scrape_pages_with_meta,
        source_tier=_source_tier,
    )


@app.post("/verify-claims")
async def verify_claims_endpoint(req: VerifyClaimsRequest, _user: dict = Depends(require_auth)):
    """Agentic, retrieval-grounded per-claim fact-checking.

    Each claim runs the explicit state machine (extract -> query -> retrieve ->
    ground -> emit) and returns an auditable SUPPORTED / CONTRADICTED /
    INSUFFICIENT verdict carrying the exact source URLs + sentences. Grounded by
    construction, claim-hash cached, capped at max_claims per request.

    Independent of /analyze. This is the intended eventual replacement for the
    ungrounded _verify_claim path, but /analyze is left unchanged for now.
    """
    if not req.claims:
        raise HTTPException(400, "claims is required and must be non-empty")
    deps = _build_agentic_deps()
    verdicts = await verify_claims(
        req.claims,
        deps,
        cache=_verdict_cache,
        max_claims=req.max_claims,
        force_refresh=req.force_refresh,
    )
    return {"count": len(verdicts), "verdicts": verdicts}


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


# ── URL fetch ─────────────────────────────────────────────────────────────────

MAX_WORDS_URL = 3000

def _fetch_article_sync(url: str):
    downloaded = trafilatura.fetch_url(url)
    if not downloaded:
        return None, None
    result = trafilatura.extract(
        downloaded,
        output_format="json",
        with_metadata=True,
        include_comments=False,
        include_tables=False,
        favor_precision=True,
    )
    if not result:
        return None, None
    data = json.loads(result)
    title = (data.get("title") or "").strip()
    text = (data.get("text") or "").strip()
    words = text.split()
    if len(words) > MAX_WORDS_URL:
        text = " ".join(words[:MAX_WORDS_URL]) + " [...truncated]"
    return title, text

# ── YouTube transcript helpers ─────────────────────────────────────────────────

_YT_HOSTS = {"www.youtube.com", "youtube.com", "youtu.be", "m.youtube.com"}

def _is_youtube_url(url: str) -> bool:
    return urllib.parse.urlparse(url).netloc in _YT_HOSTS

def _extract_youtube_video_id(url: str) -> str | None:
    parsed = urllib.parse.urlparse(url)
    if parsed.netloc == "youtu.be":
        return parsed.path.lstrip("/").split("?")[0] or None
    return urllib.parse.parse_qs(parsed.query).get("v", [None])[0]

def _get_youtube_title_sync(video_id: str) -> str:
    try:
        req = urllib.request.Request(
            f"https://www.youtube.com/watch?v={video_id}",
            headers={"User-Agent": "Mozilla/5.0"},
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            page = resp.read().decode("utf-8", errors="ignore")
        m = re.search(r'<meta property="og:title" content="([^"]+)"', page)
        if m:
            return _html.unescape(m.group(1))
        m = re.search(r'<title>([^<]+)</title>', page)
        if m:
            return _html.unescape(m.group(1).replace(" - YouTube", "").strip())
    except Exception:
        pass
    return f"YouTube Video ({video_id})"

def _fetch_youtube_transcript_sync(url: str):
    from youtube_transcript_api import YouTubeTranscriptApi
    from youtube_transcript_api._errors import NoTranscriptFound, TranscriptsDisabled

    video_id = _extract_youtube_video_id(url)
    if not video_id:
        raise ValueError("Could not parse a YouTube video ID from that URL.")

    title = _get_youtube_title_sync(video_id)

    api = YouTubeTranscriptApi()
    try:
        # Try English first, then fall back to any available language
        try:
            fetched = api.fetch(video_id, languages=["en", "en-US", "en-GB"])
        except NoTranscriptFound:
            transcript_list = api.list(video_id)
            transcript = next(iter(transcript_list))
            fetched = api.fetch(video_id, languages=[transcript.language_code])
    except TranscriptsDisabled:
        raise ValueError("This video has captions/transcripts disabled by the uploader.")
    except StopIteration:
        raise ValueError(
            "No transcript found for this video. "
            "Try a video that has captions (auto-generated or manual)."
        )
    except Exception as e:
        raise ValueError(f"Could not fetch transcript: {e}")

    # Join all caption segments into flowing text
    text = " ".join(entry.text.strip() for entry in fetched)
    text = re.sub(r"\s+", " ", text).strip()

    words = text.split()
    if len(words) > MAX_WORDS_URL:
        text = " ".join(words[:MAX_WORDS_URL]) + " [...truncated]"

    return title, text

@app.post("/fetch-url")
async def fetch_url(req: FetchUrlRequest, _user: dict = Depends(require_auth)):
    url = req.url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(400, "URL must start with http:// or https://")

    is_yt = _is_youtube_url(url)
    try:
        if is_yt:
            title, text = await asyncio.to_thread(_fetch_youtube_transcript_sync, url)
        else:
            title, text = await asyncio.to_thread(_fetch_article_sync, url)
    except ValueError as e:
        raise HTTPException(422, str(e))
    except Exception as e:
        raise HTTPException(500, f"Failed to fetch URL: {e}")

    if not text or len(text) < 50:
        raise HTTPException(422, "Could not extract enough content from that URL. Try pasting the text directly.")

    client = get_client()
    text, source_language = await _translate_if_needed(client, text)

    return {
        "title": title,
        "text": text,
        "source_type": "youtube" if is_yt else "article",
        "source_language": source_language,
    }


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


# ── Narrative Timeline ────────────────────────────────────────────────────────

@app.post("/timeline")
async def narrative_timeline(req: TimelineRequest, user: dict = Depends(require_auth)):
    if len(req.article) < 100:
        raise HTTPException(400, "Article too short (need at least 100 chars)")
    client = get_client()
    result = await _build_timeline(client, req.article[:10000])
    return result


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


@app.get("/benchmark")
def benchmark():
    """Latest GKIN benchmark numbers, read from disk.

    Frontend uses this to render a live "How accurate is GKIN?" panel. Public
    (no auth) — these are the same numbers the report exposes. Returns 404 if
    the benchmark hasn't been run yet so the frontend can hide the panel.
    """
    bench_dir = pathlib.Path(__file__).parent / "benchmark" / "results"
    payload: dict = {"available": False}
    files = {
        "ood_latest": "ood_benchmark.json",
        "ood_liar": "ood_benchmark_liar.json",
        "ood_gonzalo": "ood_benchmark_gonzalo.json",
        "manipulation": "manipulation_benchmark.json",
    }
    for key, fname in files.items():
        fp = bench_dir / fname
        if not fp.exists():
            continue
        try:
            payload[key] = json.loads(fp.read_text())
            payload["available"] = True
        except (OSError, json.JSONDecodeError):
            continue

    if not payload["available"]:
        raise HTTPException(404, "No benchmark results on disk. Run `python benchmark/run_benchmark.py`.")

    # Pull a compact, frontend-friendly headline from whichever OOD run is the
    # truly-OOD one (LIAR by convention) so callers don't have to navigate the
    # full payload to render the hero number.
    primary = payload.get("ood_liar") or payload.get("ood_latest")
    if primary:
        gk = primary.get("gkin", {})
        rb = primary.get("baseline_random", {})
        payload["headline"] = {
            "dataset": primary.get("metadata", {}).get("dataset"),
            "gkin_accuracy": gk.get("accuracy"),
            "random_baseline_accuracy": rb.get("accuracy"),
            "delta_vs_random": primary.get("delta_vs_random"),
            "n_total": primary.get("metadata", {}).get("n_total"),
            "model_kind": primary.get("metadata", {}).get("model_kind"),
            "run_at": primary.get("metadata", {}).get("run_at"),
        }

    return payload


@app.get("/")
def landing():
    return FileResponse("static/landing/index.html")

@app.get("/login")
def login_page():
    return FileResponse("static/landing/login.html")

@app.get("/app")
def analyzer():
    return FileResponse("static/analyzer/analyzer.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
