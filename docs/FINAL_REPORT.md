# GKIN — Final Project Report (Draft)

> Mapped 1:1 to the Final Project Report rubric (100 pts). Sections are pre-filled from the
> codebase and weekly reports. **`〘FILL〙` marks team-only facts** (interview quotes, exact
> dollar amounts, who-did-what) that only you can supply — everything else is drafted and
> verifiable in the repo. Paste this into the official template when finalizing.

**Team Name:** 〘FILL〙 · **Project:** GKIN — Truth Navigator · **Course:** CS343 Neural AI
**Members:** Adithya Asokan, Nghiem Pham, Ronak Jha 〘FILL: confirm full roster + 4th member if applicable〙
**Submitted by:** 〘FILL〙 · **Date:** 〘FILL〙

---

## 1. Executive Summary & Project Identity  *(5 pts)*

- **Project name:** GKIN — Truth Navigator
- **Tagline:** *Don't trust the verdict — trust the evidence behind it.*
- **Repository:** https://github.com/adi113003/GKIN
- **Live demo / landing:** 〘FILL: deployed URL if any〙 — locally `http://localhost:8000/`,
  analyzer at `/analyzer/analyzer.html`

**3-sentence summary:**
> Anyone trying to judge whether a news article, video, or screenshot is trustworthy is
> drowning in content and has no fast, auditable way to check it. GKIN is a media-literacy tool
> that analyzes any article — text, URL, image, or audio — for manipulation tactics and factual
> accuracy, and turns each checkable claim into a verdict bolted to the exact source sentence
> that justifies it. It runs today as a full-stack app with an agentic, retrieval-grounded
> fact-checking loop and a benchmark suite, and it deliberately answers "insufficient evidence"
> rather than guess.

---

## 2. Problem & Solution Evolution  *(10 pts)*

| Stage | Problem statement |
|---|---|
| **Proposal (April)** | 〘FILL: paste original proposal statement〙 — roughly: *"misinformation is hard for ordinary readers to detect; build a tool that flags fake news."* |
| **Midterm** | Sharpened to: *"automatically analyze an article for manipulation tactics and label it real/fake using an LLM pipeline + an ML classifier."* |
| **Final** | *"Give readers an **auditable** verdict: not just 'fake/real,' but a per-claim SUPPORTED / CONTRADICTED / INSUFFICIENT judgment traceable to a re-verified, credibility-weighted source — and honest abstention when the evidence isn't there."* |

**What drove the change?**
- **Driver 1 — midterm reviewer feedback (the big one):** *"How do you verify what GKIN generates
  is true? Multiple sources isn't enough — bad actors can seed consensus."* This reframed the
  product from "classify the article" to "make the verification auditable." (See
  [RESPONSE_TO_MIDTERM_FEEDBACK.md](RESPONSE_TO_MIDTERM_FEEDBACK.md).)
- **Driver 2 — our own benchmark:** measuring the ML classifier OOD showed it had learned
  *publisher style*, not truth (~chance on LIAR). That killed any plan to lean on the classifier
  alone and pushed us to the evidence-grounded loop.
- **Driver 3 — build constraint / honesty:** an ungrounded LLM "is this true?" call hallucinates.
  We chose to make grounding a structural invariant instead of a prompt request.

**Final target user:** 〘FILL: sharpen〙 e.g., *"students, journalists, and civically-engaged
readers who encounter a viral article/clip and want a fast, source-backed credibility check they
can verify themselves — not a black-box score."*

**Key differentiator:** verdicts that are **auditable by construction** — every confident verdict
links to a re-verified source sentence, sources are credibility-tiered, and the tool abstains
rather than bluffs. General assistants (ChatGPT/Gemini/Perplexity) don't guarantee any of these.

---

## 3. Customer Discovery & Validation  *(15 pts)*

> This section needs your real interview data. Structure is drafted; fill the evidence.

| Round | # Interviews | Top insight / quote | Resulting product change |
|---|--:|---|---|
| Pre-proposal | 〘FILL〙 | 〘FILL〙 | 〘FILL〙 |
| Proposal → Midterm | 〘FILL〙 | 〘FILL〙 | 〘FILL〙 |
| **Midterm → Final** | 〘FILL〙 | *(the midterm reviewer's "multiple sources isn't enough" — treat as expert feedback)* | rebuilt verification around grounding + trusted-source tiers + abstention |

**Three most important quotes:** 〘FILL — verbatim, anonymized, with date + user type〙

**Validation metrics (drafted — fill numbers):**
- Benchmark: agentic loop **misleading_rate** vs bare LLM / ChatGPT / Gemini / Perplexity
  (see [COMPETITIVE_COMPARISON.md](COMPETITIVE_COMPARISON.md)) — 〘FILL after running〙.
- ML classifier OOD accuracy: 50.9% (LIAR) vs 98.6% (distribution-adjacent) — *honesty metric.*
- 〘FILL: signups / demo sessions / testers if any〙

**What we got wrong:** we assumed a well-trained classifier on a 72k-article dataset (97–99%
accuracy) basically solved fake-news detection. The OOD benchmark proved that was *publisher-style
attribution*, not truth detection — a humbling, well-documented lesson (see CLAUDE.md). It's the
reason the final product centers on grounded retrieval, not the classifier.

### Automated competitor benchmark (paste results here)

Reproducible head-to-head: GKIN vs ChatGPT / Gemini / Perplexity on a shared 7-category,
0–14 rubric. Missing API keys are skipped; no numbers are hardcoded.

```bash
# GKIN must be running (python server.py). Competitor keys optional.
python benchmark/run_competitor_benchmark.py --mode heuristic
# with OPENAI_API_KEY also set, for LLM-as-judge scoring:
python benchmark/run_competitor_benchmark.py --mode judge
```

Paste the "Overall" table from `benchmark/results/latest_report.md` below after a run with
your API keys present:

| Provider | Avg total / 14 | factual | citations | source quality | traceability | timeline | uncertainty | misinfo resist |
|---|--:|--:|--:|--:|--:|--:|--:|--:|
| **GKIN** | 〘paste〙 | | | | | | | |
| ChatGPT | 〘paste〙 | | | | | | | |
| Gemini | 〘paste〙 | | | | | | | |
| Perplexity | 〘paste〙 | | | | | | | |

> *Results are reproducible whenever the same providers/keys are present. Heuristic scores are
> deterministic; LLM-as-judge scores are stored separately. Full method + limitations in
> [COMPETITIVE_COMPARISON.md](COMPETITIVE_COMPARISON.md).*

---

## 4. Technical Architecture  *(15 pts)*

Diagram: see the ASCII architecture in [`README.md`](../README.md#architecture) (replace with a
draw.io/Excalidraw export for the final). 〘FILL: link diagram〙

**Request lifecycle — `/verify-claims` (the core action):**
1. User runs a scan in the analyzer; claims extracted from `/analyze` are sent to `/verify-claims`.
2. FastAPI route validates the request and builds injected `Deps` (Groq client, search fn, scrape
   fn, source-tier fn) — `gkin.agentic` never imports `server`.
3. For each claim the **state machine** runs: `extract` (atomic assertions) → `build_query` →
   `retrieve` (search + trafilatura scrape, tier-tagged, junk dropped) → `ground` (LLM verdict
   citing verbatim sentences) → `emit`.
4. `validated_spans()` re-checks every cited sentence against the scraped text; ungrounded
   citations are dropped.
5. `apply_tier_policy()` weights by source trust — Tier-0-only → INSUFFICIENT.
6. A `Verdict` (label, confidence, evidence spans, flags, audit counters) is returned and cached
   by claim hash. The frontend renders verdict + clickable citations + timeline.

**Key entities:** `Verdict`, `EvidenceSpan`, `Deps`/state dict, `TRUSTED_SOURCES` tier map,
`VerdictCache`, user record (MongoDB).

**Non-obvious engineering decisions:**
- **Grounding enforced by Pydantic validator**, not convention — ungrounded hard verdict is
  un-constructible.
- **Framework-free state machine** (no LangGraph) with a hard iteration cap — explicit edges,
  guaranteed termination, fully unit-testable with fakes.
- **Claim-hash caching** for reproducibility/cost; **seeded** benchmarks for bit-reproducible runs.
- **Dependency injection** keeps the loop importable and testable in isolation.

---

## 5. Tools & Tech Stack  *(10 pts)*

| Layer | Final technology / why / changed since 4/6 softlock? |
|---|---|
| Front end | React + Vite + TS + Tailwind + Framer Motion (landing); vanilla SPA (analyzer). Fast iteration. 〘FILL: vs softlock〙 |
| Back end | Python + FastAPI + Uvicorn — async, simple, great for an LLM gateway. 〘FILL〙 |
| AI / ML | Groq-hosted Llama 3.3 70B / gpt-oss-120B / Llama 3.1 8B / Llama 3.2 Vision / Whisper-v3; scikit-learn baseline + DistilBERT. Groq chosen for speed + cost. 〘FILL: changed from softlock? we replaced decommissioned DeepSeek-R1 — commit 454a77e〙 |
| Database | MongoDB Atlas (Motor async) — migrated from a local-Mongo requirement to Atlas M0 mid-term (weekly report 6). |
| Infra / hosting | 〘FILL: Vercel/Render/local?〙; remote GPU box (96GB) for DistilBERT training. |
| Auth | JWT (python-jose, passlib/bcrypt). |
| Other libs | trafilatura (scrape), ddgs (search), youtube-transcript-api, pydantic. |
| Dev tools | Git/GitHub, Claude Code (AI pair-programming), Vite, pytest, 21st.dev component specs. |

---

## 6. Technology Pivoting Reflection  *(10 pts)*

| Considered pivot | Trigger | Decision | Rationale / tradeoffs |
|---|---|---|---|
| Lean on the ML classifier as the verdict | High in-domain accuracy (97–99%) | **Rejected** | OOD benchmark showed it learned publisher style, not truth. Kept it as a secondary signal only. |
| Ungrounded LLM "is this true?" call | Simplest to build | **Rejected** | Hallucinates citations; can't answer the midterm critique. Replaced with grounded loop. |
| Use a framework (LangGraph) for the agent | Agentic loop complexity | **Rejected** | Hand-rolled an explicit state machine instead — matches our no-framework stack, fully testable, no recursion-limit surprises. |
| DeepSeek-R1 reasoning model | Reasoning quality | **Taken (forced)** | Decommissioned on Groq → swapped to `gpt-oss-120b` (commit 454a77e). |
| Local MongoDB | Default | **Taken → Atlas** | Local mongod was a startup blocker; moved to Atlas M0 (weekly report 6). |
| Paid search (Brave/Google) as default | Better recall | **Deferred** | Kept free keyless Wikipedia + DDG as default; paid backends optional via env keys. |

**If we started over:** 〘FILL〙 — likely: build the grounded loop *first*, treat the classifier as
an experiment from day one, and add a publisher-held-out eval before trusting any accuracy number.

---

## 7. UI / UX & Landing Page  *(10 pts)*

- **Landing page:** React/Vite marketing site (`landing-src/`). 〘FILL: screenshot + live URL〙
- **Core screens (caption each):** (1) Ingestion hub — paste/URL/upload/mic; (2) Neural scan
  results — manipulation index gauge, persuasion map; (3) **Verdict + citations** — verdicts with
  clickable verbatim source spans; (4) **Narrative forensics timeline**; (5) AI Assistant chat.
  〘FILL: screenshots〙
- **Before/after since midterm:** the analyzer was re-skinned to match the landing palette (Inter,
  `#050505`, brand violet/cyan/rose), the ingestion-hub buttons were wired to real handlers, and a
  polished prompt-input replaced the old chat input (weekly report 6). **The biggest UX change is
  conceptual:** verdicts now show *evidence*, not just a score. 〘FILL: side-by-side screenshots〙

---

## 8. Cost Analysis  *(5 pts)*

| Item | Projected ($) | Actual ($) | Variance | Notes |
|---|--:|--:|--:|---|
| LLM API (Groq) | 〘FILL〙 | 〘FILL〙 | | Groq is low-cost; most dev usage on free tier |
| Hosting | 〘FILL〙 | 〘FILL〙 | | 〘FILL〙 |
| MongoDB Atlas | $0 | $0 | $0 | M0 free tier |
| Search APIs | $0 | 〘FILL〙 | | Wikipedia/DDG free; Brave/Google only if enabled |
| Domain / tools | 〘FILL〙 | 〘FILL〙 | | |
| **TOTAL** | 〘FILL〙 | 〘FILL〙 | | |

**12-month projection at ~1k MAU + assumptions:** 〘FILL〙 — e.g., *avg N claims/user/session,
Groq token cost per verify, Atlas tier upgrade at X users, hosting tier.*

---

## 9. Team Contribution Summary  *(5 pts)*

> Drafted from git history (`git shortlog -sne`). **Confirm/correct roles and standout work.**

| Member | Primary role | Key contributions (full term) | Standout |
|---|---|---|---|
| Adithya Asokan | 〘FILL: e.g. Backend/AI〙 | Audio/video + screenshot analysis pipeline (Whisper, Vision OCR); 〘FILL〙 | 〘FILL〙 |
| Nghiem Pham | 〘FILL〙 | URL ingestion (`/fetch-url`, trafilatura); 〘FILL〙 | 〘FILL〙 |
| Ronak Jha | 〘FILL〙 | 〘FILL: most commits in shortlog — fill specifics〙 | 〘FILL〙 |
| 〘FILL: 4th member?〙 | ML / training | DistilBERT training on remote GPU box; 〘FILL〙 | 〘FILL〙 |

**Collaboration reflection:** 〘FILL〙 — weekly reports, branch-per-feature workflow (branches:
`adithya`, `nghiem`, `ronak`, `dev`, `agentic-factcheck-loop`).

---

## 10. Lessons Learned & Future Roadmap  *(10 pts)*

**Top lessons:**
1. **High accuracy can be a lie.** 97–99% on WELFake was publisher-style attribution; OOD benchmark
   exposed it. *Always test out-of-distribution before trusting a number.*
2. **For a truth tool, auditability beats cleverness.** Making grounding a structural invariant
   (un-constructible ungrounded verdict) answered the midterm critique better than any prompt could.
3. **Counting sources ≠ verifying truth.** Credibility weighting + abstention is what defeats
   manufactured consensus.
4. 〘FILL: a team/process lesson〙
5. 〘FILL: a customer lesson〙

**If we had one more month:** publisher-held-out evaluation; run the full GKIN-vs-competitors
benchmark with real keys; expand + make the trusted-source registry transparent/contestable;
deploy publicly.

**Roadmap:** Next 1 mo — finish competitor benchmark, deploy. Next 3 mo — multilingual sources,
browser-extension GA, user-reportable source registry. Next 12 mo — 〘FILL: monetization /
institutional partners〙.

---

## 11. Promo + Explainer Video  *(5 pts)*

Outline in [PRESENTATION_KIT.md](PRESENTATION_KIT.md#promo--explainer-video-outline-5-min).
〘FILL: video link — must be public/playable〙

---

### Submission checklist
- [ ] Cover info · [ ] Tagline + repo · [ ] Architecture diagram (export ASCII → image)
- [ ] Tech stack table · [ ] Customer discovery quotes · [ ] ≥2 pivots
- [ ] Cost projected vs actual + 12-mo · [ ] Contribution table matches weekly reports
- [ ] Video linked + playable · [ ] Lessons include what didn't work (the classifier story)
