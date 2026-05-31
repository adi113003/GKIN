# How GKIN Improved Since Midterm

> *This document is the heart of our final submission. It maps the exact feedback we
> received at midterm to the exact things we changed — with commit-level and file-level
> evidence. Every claim here is verifiable in the codebase.*

---

## The one-paragraph version

**At midterm, GKIN could already generate rich analysis of an article — but we had one
serious, correctly-identified weakness: we couldn't prove our output was true.** Our
reviewer asked *"how do you verify the information GKIN generates is actually true?"* and
pointed out — sharply — that *"using multiple sources isn't enough, because bad actors can
seed or position multiple sources to manufacture a false consensus."* Since then we
rebuilt the truth layer of the product from the ground up around **traceability, trusted
sources, evidence-grounded verdicts, and honest abstention.** GKIN no longer asks you to
trust its verdict — it shows you the source sentence behind every verdict, scores how
trustworthy that source is, and says *"insufficient evidence"* rather than bluffing.

---

## The midterm feedback (verbatim intent)

The reviewer's core concern was **validation and truthfulness**:

1. *"How does GKIN verify that the information it generates is true?"*
2. *"Multiple sources is not enough — bad actors can seed or position multiple sources to
   create the appearance of consensus."*

Concrete suggestions:

- ✅ Make information **traceable with citations**.
- ✅ Add a **timeline of events**.
- ✅ **Whitelist trusted sources**.
- ✅ Build a **benchmark** showing GKIN performs better than alternatives.
- ✅ **Compare GKIN against ChatGPT / Gemini / Perplexity.**

---

## Why it mattered

The feedback exposed a category error in how the midterm product worked. At midterm, GKIN's
fact "verification" was an **ungrounded LLM call** — we asked a language model "is this
claim true?" and trusted its answer. That has two fatal problems for a *media-literacy* tool:

1. **It can hallucinate.** An LLM will confidently assert a citation that doesn't exist or
   paraphrase a source into saying something it never said.
2. **It launders consensus.** Counting sources without weighting their credibility is
   exactly the attack surface the reviewer named — 10 coordinated junk blogs would
   "out-vote" one primary government document.

A tool that tells people what's true has a higher bar than a chatbot: **it must be auditable.**
That insight reframed the back half of our term.

---

## What we changed — feedback → implementation

Each row links the feedback to the code that answers it. All of this landed **after** midterm
(see the commit trail at the bottom).

### 1. Traceable citations — claims tied to the exact evidence sentence

**Before (midterm):** a single LLM verdict with, at best, a generic list of source links at
the bottom of the page. No way to know *which* sentence in *which* source backed the claim.

**Now:** every grounded verdict carries one or more `EvidenceSpan`s — a source URL **plus the
verbatim sentence** that justifies it. This is enforced *by construction*:

- [`gkin/agentic/verdict.py`](../gkin/agentic/verdict.py) — the `Verdict` model has a Pydantic
  `model_validator` that **rejects** any `SUPPORTED`/`CONTRADICTED` verdict with zero evidence
  spans. *"An ungrounded verdict is a `ValidationError`, not a code-review note."*
- [`gkin/agentic/nodes.py`](../gkin/agentic/nodes.py) `validated_spans()` — the
  **anti-hallucination gate**. The LLM is required to copy each citation sentence verbatim from
  the supplied evidence; we then re-check that the sentence is genuinely an (≈exact) substring
  of the scraped page text. If it isn't, the citation is dropped. If nothing survives, the
  verdict degrades to **INSUFFICIENT**.

> **This directly answers "how do you verify truth?":** GKIN doesn't ask you to trust the
> model. It shows you the sentence, on the page, that the verdict stands on — and it
> mechanically refuses to show you one that isn't really there.

### 2. Trusted-source whitelist — not all sources count equally

**Before:** all sources treated equally — the exact failure the reviewer warned about.

**Now:** a hand-curated **trusted-source allowlist** with credibility tiers
(`TRUSTED_SOURCES` in [`server.py`](../server.py), ~60 domains):

| Tier | Meaning | Examples |
|---|---|---|
| **1** | Primary / official / academic | `.gov`, `.edu`, WHO, UN, PubMed, arXiv, Nature, NEJM, The Lancet |
| **2** | Established journalism | Reuters, AP, BBC, NPR, NYT, WaPo, The Guardian, Bloomberg |
| **3** | Dedicated fact-checkers / reference | PolitiFact, Snopes, FactCheck.org, Full Fact, Wikipedia, Britannica |
| **0** | Unverified (anything not on the list) | random blogs, content farms, social media |

Retrieval **tier-sorts** trusted sources to the front and **drops social/forum/UGC noise**
([`nodes.retrieve_evidence`](../gkin/agentic/nodes.py)).

### 3. Source-reliability scoring — defeating manufactured consensus

This is our **direct answer to "multiple sources isn't enough."** Counting sources is not how
GKIN decides — *the quality of the backing decides.* [`apply_tier_policy`](../gkin/agentic/verdict.py):

- Verdict backed by ≥1 **Tier 1/2** source → trusted as-is.
- Verdict backed **only by Tier 3** fact-checkers → kept but flagged `low_confidence` and
  confidence-capped at 0.6.
- Verdict backed **only by Tier 0** unverified sources → **automatically downgraded to
  INSUFFICIENT**, with the flag `downgraded_unverified_sources_only`.

> **So a coordinated swarm of junk blogs cannot manufacture a SUPPORTED verdict.** No matter
> how many of them agree, Tier-0-only backing can never clear the bar. That is the seeded-
> consensus attack, closed by policy.

### 4. Verification labels based on evidence quality, not source count

Every claim resolves to one of three auditable labels (`VerdictLabel`):

- **SUPPORTED** — confident, grounded in ≥1 validated trusted span.
- **CONTRADICTED** — confident, grounded in ≥1 validated trusted span that refutes the claim.
- **INSUFFICIENT** — the honest default. *The only label allowed to stand on no evidence.*

Plus a `low_confidence` flag and `flags[]` audit trail (`only_tier3_factchecker_sources`,
`downgraded_unverified_sources_only`) so a reader sees *why* a verdict is weak. The strict
verdict mapping is **abstention-first**: GKIN would rather say "I don't know" than be
confidently wrong, and the benchmark explicitly measures the "confidently wrong" rate
(`misleading_rate`) as the dangerous case.

### 5. Timeline of events

**Now:** `POST /timeline` ([`_build_timeline`](../server.py)) builds a narrative forensics
timeline — where a story started, how it evolved, who corroborated or contradicted it — and
the analyzer renders it as a dedicated timeline UI (`.ntl-timeline`) with per-event verdict
badges (CORROBORATED / CONTRADICTED / DISPUTED / MIXED / UNVERIFIED) and source citations.

### 6. Benchmark + competitive comparison

**Now:** a runnable [`benchmark/`](../benchmark/) suite:

- `run_benchmark.py` — out-of-distribution accuracy of the ML classifier (the **honest**
  headline: ~chance on truly-OOD LIAR data — we report this openly).
- `run_verification_benchmark.py` — scores the **agentic loop** as a fact-checker with an
  "I don't know" option (coverage / decided-accuracy / misleading-rate) and is built to run
  **GKIN vs a bare LLM vs ChatGPT / Gemini / Perplexity** head-to-head.

See [COMPETITIVE_COMPARISON.md](COMPETITIVE_COMPARISON.md) for the capability matrix and the
exact commands to produce the head-to-head numbers.

---

## How GKIN now handles truthfulness — the one-sentence answer for the Q&A

> *"We don't claim our output is true — we make it **auditable**. Every confident verdict is
> bolted to a real source sentence we re-verify against the page; sources are weighted by a
> trusted-source tier policy so a pile of junk blogs can't manufacture a verdict; and when the
> evidence isn't there, GKIN says INSUFFICIENT instead of guessing."*

---

## What limitations still remain (we say this out loud)

Honesty scores higher than a clean story:

1. **The ML classifier still learned publisher style, not truth.** It is near-chance on
   out-of-distribution data (50.9% on LIAR). We kept it because it's a useful *second signal*
   and a teaching example of dataset leakage — but the **agentic loop is the part that
   generalizes**, because it grounds in live evidence rather than learned style.
2. **The trusted-source allowlist is hand-curated and English-centric.** It's a defensible
   starting point, not a complete or neutral map of credibility. A real deployment needs a
   maintained, transparent, contestable source registry.
3. **Coverage vs. caution trade-off.** Because we abstain aggressively, GKIN returns
   INSUFFICIENT on many recent or thinly-sourced claims. That's the safe failure mode, but it
   does mean GKIN sometimes declines to help when a user wants an answer.
4. **Retrieval quality is a ceiling.** GKIN can only be as good as what keyless web search
   surfaces; paywalled primary sources are often invisible to it.

---

## Commit-level evidence (the receipts)

The since-midterm work is legible straight from `git log` — feedback → commit:

| Feedback point | Commits |
|---|---|
| Grounding / traceable citations | `fbdd90c` Add Verdict model: grounding enforced by construction + tier policy · `d7a3f41` Add citations + claim timeline to analyzer · `c488ea4` Add @trace decorator for observability |
| Agentic verification loop | `38836a1` Add agentic loop: state-machine nodes + controller · `d4b688b` Wire agentic loop: claim-hash cache, /verify-claims endpoint |
| Trusted-source whitelist | `6b2d408` Whitelist the credible sources · `43ca352` Tier Wikipedia + Britannica as reference sources (Tier 3) |
| Better retrieval (reach CONTRADICTED on false claims) | `50c5e38` Improve retrieval so false claims can reach CONTRADICTED · `28a3448` Fix web retrieval (ddgs) |
| Search backends for evidence | `fe12321` Free keyless Wikipedia backend · `c92e5fa` Optional Brave + Google backends |
| Benchmark vs alternatives | `4a9cca5` Add verification benchmark suite |
| Timeline UI | `8899b39` Narrative modal shows claim timeline nodes · `6af06f5` Interactive narrative source map modal |

*Run `git log --oneline` to confirm.*
