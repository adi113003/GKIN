# GKIN — Truth Navigator

**Media literacy you can audit.** GKIN doesn't just label an article true or fake — it
turns each checkable claim into a verdict you can trace back to the exact source sentence
that justifies it, and it refuses to commit when the evidence isn't there.

> **Tagline:** *Don't trust the verdict — trust the evidence behind it.*

| | |
|---|---|
| **Course** | CS343 — Neural AI |
| **Repo** | https://github.com/adi113003/GKIN |
| **Live demo** | **<https://gkin.app>** · analyzer at **<https://gkin.app/app>** |
| **Status** | Working full-stack app + agentic fact-check loop + benchmark suite |

---

## Try it on the public site (no install)

**Live:** <https://gkin.app>  ·  **Analyzer:** <https://gkin.app/app>

1. Open **<https://gkin.app>** and click **"Analyze an article."**
2. On the login screen, **create an account** (any username + email + 6-character
   password) or sign in. *A free account is required — there is no install or local setup.*
3. In the analyzer, click **"Load a sample article"** — or paste your own article text or a
   news URL — then press **Analyze**.
4. Read the scorecard: 0–100 manipulation index, named persuasion techniques (with exact
   quotes), emotional framing, missing context, and extracted claims.
5. Click **"Verify with sources"** to run the grounded fact-check loop — each claim comes
   back **SUPPORTED / CONTRADICTED / INSUFFICIENT** with the exact source sentence behind it.
6. Open the **Timeline** for GDELT coverage of the story, and use the **chat** panel to ask
   follow-up questions about the analysis.

> The headline flow (text/URL → Analyze → Verify) runs on Groq plus keyless
> Wikipedia / DuckDuckGo / GDELT. Screenshot and audio inputs are available from the
> **Upload** and **mic** buttons (or the **MEDIA** tab).

---

## What it does

Paste an article, URL, screenshot, audio file, or YouTube link. GKIN runs **two detection
systems in parallel**:

1. **LLM analysis pipeline** (Groq-hosted Llama / DeepSeek / Whisper) — chain-of-thought
   reasoning over the text: manipulation tactics, emotional framing, persuasion techniques
   (with exact quotes), missing context, AI-vs-human authorship, and a 0–100 manipulation
   index anchored to an auditable scorecard.
2. **Classical ML classifier** — TF-IDF + Logistic Regression (and a fine-tuned DistilBERT)
   trained on WELFake (72,073 articles) for a binary real/fake label.

On top of that sits the thing the midterm feedback asked for — an **agentic,
retrieval-grounded fact-checking loop** that produces verdicts you can audit.

## The core idea: grounding by construction

The midterm reviewer's question was *"how do you know what GKIN generates is true?"* Our
answer is structural, not promotional:

- A **SUPPORTED** or **CONTRADICTED** verdict is *impossible to construct* without at least
  one `EvidenceSpan` — a real source URL **plus the exact sentence**, copied verbatim, that
  justifies the call. This is enforced by a Pydantic validator in
  [`gkin/agentic/verdict.py`](gkin/agentic/verdict.py), so an ungrounded verdict is a
  `ValidationError`, not a code-review note.
- Every cited sentence is **re-validated against the scraped page text**
  ([`nodes.validated_spans`](gkin/agentic/nodes.py)) — if the model paraphrases or
  hallucinates a quote, the citation is dropped and the verdict falls back to
  **INSUFFICIENT**.
- Sources are scored against a **trusted-source allowlist** (`TRUSTED_SOURCES` in
  [`server.py`](server.py)): Tier 1 government/academic, Tier 2 established journalism,
  Tier 3 fact-checkers/reference. A hard verdict resting only on unverified (Tier 0) sources
  is **automatically downgraded to INSUFFICIENT** ([`apply_tier_policy`](gkin/agentic/verdict.py)).
- **INSUFFICIENT is the only label allowed to stand on no evidence.** GKIN is designed to say
  *"I don't know"* rather than bluff — that abstention is a feature, not a bug.

See **[docs/RESPONSE_TO_MIDTERM_FEEDBACK.md](docs/RESPONSE_TO_MIDTERM_FEEDBACK.md)** for the
full midterm → final story, and **[docs/COMPETITIVE_COMPARISON.md](docs/COMPETITIVE_COMPARISON.md)**
for how this compares to ChatGPT / Gemini / Perplexity.

---

## Architecture

```
                    ┌─────────────────────── Frontend ───────────────────────┐
   Article / URL    │  landing-src/  (React + Vite + Tailwind)  → marketing   │
   / screenshot  ─► │  static/ + landing/analyzer  (analyzer workspace)       │
   / audio / yt     │  chrome-extension/  (in-page analysis)                  │
                    └───────────────────────────┬─────────────────────────────┘
                                                 │  HTTPS / JSON
                    ┌────────────────────────────▼─────────────────────────────┐
                    │  server.py  (FastAPI)                                      │
                    │   /analyze  /verify-claims  /timeline  /chat  /transcribe  │
                    │   /analyze-image  /fetch-url  /compare  auth (JWT)         │
                    └───┬───────────────┬───────────────┬───────────────┬───────┘
                        │               │               │               │
              ┌─────────▼──────┐  ┌─────▼───────┐  ┌────▼─────────┐  ┌──▼────────────┐
              │ gkin/agentic/  │  │ ML classifier│  │ Groq LLM API │  │ MongoDB Atlas │
              │ state-machine  │  │ baseline_*.  │  │ Llama/DeepSeek│ │ users / auth  │
              │ fact-check loop│  │ joblib +     │  │ /Whisper/Vision│ │               │
              │ + TRUSTED_SRC  │  │ DistilBERT   │  └──────────────┘  └───────────────┘
              └───────┬────────┘
                      │  web search (Wikipedia / DDG / Brave / Google)
                      │  + trafilatura page scrape  → tier-tagged evidence
                      ▼
          SUPPORTED / CONTRADICTED / INSUFFICIENT  (+ cited spans, confidence, audit trail)
```

### The agentic loop (per claim)

`extract → build_query → retrieve → ground → emit`, with one guarded
`reformulate → retrieve → ground` retry when evidence is thin or grounding is weak. It is an
explicit, framework-free state machine ([`gkin/agentic/controller.py`](gkin/agentic/controller.py))
with a hard iteration cap, so it always terminates and the verify step can never be skipped
before a hard verdict is emitted.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + TypeScript + Tailwind + Framer Motion (landing); vanilla SPA (analyzer) |
| Backend | Python 3, FastAPI, Uvicorn |
| AI / LLM | Groq-hosted `llama-3.3-70b-versatile`, `gpt-oss-120b`, `llama-3.1-8b-instant`, `llama-4-scout-17b` (vision), `whisper-large-v3` |
| ML | scikit-learn (TF-IDF + LogReg), DistilBERT (HuggingFace Transformers), WELFake |
| Retrieval | Wikipedia API + DuckDuckGo (keyless) · optional Brave / Google · trafilatura scrape |
| Data / Auth | MongoDB Atlas (Motor async), JWT (python-jose, passlib/bcrypt) |
| Browser | Chrome extension (Manifest V3) |

---

## Quick start

```bash
# 1. Install
pip install fastapi uvicorn groq pydantic pandas python-multipart \
            ddgs trafilatura python-jose[cryptography] passlib[bcrypt] \
            motor python-dotenv requests scikit-learn joblib

# 2. Configure  (copy .env.example → .env and fill in)
export GROQ_API_KEY="your_groq_key"          # required for LLM + verification
# MONGODB_URI=...                             # optional; auth degrades without it
# BRAVE_API_KEY / GOOGLE_API_KEY              # optional search backends

# 3. Run
python server.py            # or: uvicorn server:app --port 8000
```

Open **http://localhost:8000/** (landing) or **http://localhost:8000/app**
(analyzer workspace). Register an account, click **Load a sample article**, and run a scan.

### Key endpoints

| Endpoint | Purpose |
|---|---|
| `POST /analyze` | Full LLM + ML analysis of article text |
| `POST /verify-claims` | **Agentic grounded fact-check** → cited SUPPORTED/CONTRADICTED/INSUFFICIENT verdicts |
| `POST /timeline` | Narrative forensics timeline of an event |
| `POST /fetch-url` `/transcribe` `/analyze-image` | URL / audio / screenshot ingestion |
| `GET /benchmark` | Serves benchmark JSON for the in-app accuracy panel |

---

## Benchmarks

```bash
# Out-of-distribution accuracy of the ML classifier (the honest headline number)
python benchmark/run_benchmark.py --dataset liar
python benchmark/run_benchmark.py --dataset gonzalo
python benchmark/generate_report.py && open benchmark/BENCHMARK_REPORT.md

# Agentic fact-check loop vs. a bare LLM (and optionally ChatGPT / Gemini / Perplexity)
uvicorn server:app --port 8000 &
export GKIN_JWT="$(curl -s -XPOST localhost:8000/login \
  -H content-type:application/json \
  -d '{"username":"tester","password":"testpass123"}' | python -c 'import sys,json;print(json.load(sys.stdin)["token"])')"
python benchmark/run_verification_benchmark.py --baseline
```

### Automated competitor benchmark (GKIN vs ChatGPT / Gemini / Perplexity)

Sends the same verification prompts to every available provider and scores each answer on a
shared 7-category rubric (rule-based, or optional LLM-as-judge). **Missing API keys are
skipped gracefully — no numbers are hardcoded.**

```bash
python server.py                                              # GKIN must be up
python benchmark/run_competitor_benchmark.py                  # all available, heuristic
python benchmark/run_competitor_benchmark.py --mode judge     # + LLM-as-judge (needs OPENAI_API_KEY)
python benchmark/run_competitor_benchmark.py --providers gkin openai perplexity gemini
# → benchmark/results/latest_report.md  (+ .json, .csv)
```

Optional environment variables (all skip-safe):

| Var | Purpose | Default |
|---|---|---|
| `GKIN_BASE_URL` | GKIN server URL | `http://localhost:8000` |
| `GKIN_USERNAME` / `GKIN_PASSWORD` | benchmark account (auto-registered) | `benchmark` / `benchmarkpass123` |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | enable ChatGPT (+ LLM-judge) | model `gpt-4o-mini` |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | enable Gemini | model `gemini-1.5-flash` |
| `PERPLEXITY_API_KEY` / `PERPLEXITY_MODEL` | enable Perplexity | model `sonar` |
| `JUDGE_MODEL` | model used by `--mode judge` | `gpt-4o-mini` |

See [`benchmark/README.md`](benchmark/README.md) and
[`docs/COMPETITIVE_COMPARISON.md`](docs/COMPETITIVE_COMPARISON.md). We report our
limitations honestly — the classifier is near-chance on truly out-of-distribution data;
the agentic loop is the part designed to generalize because it grounds every verdict in
live retrieved evidence rather than learned publisher style.

---

## Documentation

| Doc | What it covers |
|---|---|
| [docs/RESPONSE_TO_MIDTERM_FEEDBACK.md](docs/RESPONSE_TO_MIDTERM_FEEDBACK.md) | Where we were at midterm → where we are now; every feedback point, what we changed |
| [docs/COMPETITIVE_COMPARISON.md](docs/COMPETITIVE_COMPARISON.md) | GKIN vs ChatGPT / Gemini / Perplexity — capability matrix + benchmark methodology |
| [docs/FINAL_REPORT.md](docs/FINAL_REPORT.md) | Final report draft mapped to the 11 rubric sections |
| [docs/PRESENTATION_KIT.md](docs/PRESENTATION_KIT.md) | 1-min pitch, 3-min demo script, slide outline, Q&A prep |
| [CLAUDE.md](CLAUDE.md) | Engineering notes, model IDs, WELFake leakage analysis, gotchas |

---

## Tests

```bash
python -m pytest gkin/agentic/tests/ -q     # agentic loop unit tests (state machine, grounding, tiers)
```

## Limitations (read these)

- The ML classifier learned *publisher style*, not truth — ~chance on out-of-distribution data
  (LIAR). Documented in [CLAUDE.md](CLAUDE.md) and the benchmark report.
- The agentic loop is only as good as what live web search surfaces; for very recent or
  obscure claims it will (correctly) return INSUFFICIENT rather than guess.
- The trusted-source allowlist is hand-curated and English-centric; it is a starting point,
  not a complete map of credible sources.
- **A free account is required** to use the analyzer (register on the public site); there is
  no guest mode. The landing page and login stay up even if the auth database is briefly down.
- Screenshot/audio inputs depend on Groq vision/Whisper availability; if a model is busy the
  app shows a clear message and the core text/URL flow is unaffected.

---

## Deploying & environment (maintainers)

Deploy is automated on push to `main` (GitHub Actions → SSH to the DigitalOcean box →
`git fetch`/reset + `pm2 restart server`). **The deploy does not run a frontend build or
`pip install`**, so the box serves exactly the committed files.

**Required server env vars** (set in the box's `.env` / pm2 env — never commit real keys):

| Var | Why | If missing |
|---|---|---|
| `GROQ_API_KEY` | all LLM analysis + verification | `/analyze` etc. return 500 |
| `MONGODB_URI` | register/login (auth) | landing/app stay up; login returns 503 |
| `SECRET_KEY` | signs JWT auth tokens | **pin a fixed value** — otherwise every restart silently logs users out |

Optional: `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI=https://gkin.app/auth/google/callback` / `FRONTEND_URL=https://gkin.app` (the "Continue with Google" button is hidden until these are set); `BRAVE_API_KEY` / `GOOGLE_API_KEY` (extra search backends).

**Frontend builds → committed assets.** The React frontends are pre-built into `static/`:
`landing-src/` → `static/landing/` (run `npm --prefix landing-src run build`), and
`landing/` → `static/analyzer/` (run `npm --prefix landing run build`). Vite emits
content-hashed bundles, so **always stage the whole `static/` tree after a rebuild**:

```bash
git add -A static/      # ⚠ NOT `git commit -am` — that skips the new (untracked) JS/CSS
                        #   and the deployed HTML would 404 its own bundle (white screen)
git status static/      # confirm new assets/*.js|.css are staged, old ones deleted
```
