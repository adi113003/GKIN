# CLAUDE.md — GKIN Final Presentation Builder

> **How to use this file:** rename it to `CLAUDE.md` and drop it into a folder you open
> with Claude. It is fully self-contained — every fact below is verified from the real
> GKIN project and a live production run. Ask Claude things like *"build my 12-slide deck,"*
> *"write speaker notes for slide 5,"* *"make a 3-minute demo script,"* *"draft the Q&A."*

## Your role
You are helping a CS343 student build the **final presentation** for **GKIN — Truth Navigator**.
Be a presentation coach + slide writer. Produce slide copy, speaker notes, a demo script,
and Q&A prep. **Be honest — never invent metrics or overclaim.** Use only the facts here.

---

## 1. What GKIN is (the elevator pitch)
GKIN — *Truth Navigator* — is a **media-literacy tool that makes AI verification auditable.**
Paste an article, URL, screenshot, or audio clip; GKIN scores manipulation, names persuasion
techniques, and turns each checkable claim into a verdict — **SUPPORTED / CONTRADICTED /
INSUFFICIENT** — **bolted to the exact source sentence that backs it**, on a credibility-ranked
source. If the evidence isn't there, it says "insufficient" instead of guessing.

- **Tagline:** *Don't trust the verdict — trust the evidence behind it.*
- **Live:** https://gkin.app (analyzer at `/app`) · **Repo:** https://github.com/adi113003/GKIN
- **Course:** CS343 Neural AI · **Team:** Adithya Asokan, Nghiem Pham, Ronak Jha *(confirm roster)*

---

## 2. THE central story — "Midterm → Final" (this is what you're graded on)
At **midterm**, GKIN could analyze an article, but the reviewer caught a real weakness and asked:
> *"How do you verify the information is true? Using multiple sources isn't enough — bad actors
> can seed or position multiple sources to manufacture a consensus."*

**We rebuilt the truth layer around four answers (all shipped + live):**

| Midterm concern | What we built |
|---|---|
| "How do you know it's true?" | **Grounding by construction** — a SUPPORTED/CONTRADICTED verdict is *impossible to create* without ≥1 evidence span (real URL + verbatim sentence). Every cited sentence is re-checked against the scraped page; hallucinated citations are dropped. |
| "Multiple sources isn't enough" | **Trusted-source tier policy** — sources are weighted (Tier 1 gov/academic, Tier 2 journalism, Tier 3 fact-checkers, Tier 0 unverified). A verdict backed only by unverified sources is **auto-downgraded to INSUFFICIENT** — so a pile of junk blogs can't manufacture a verdict. |
| "Make it traceable" | Three auditable labels + **clickable, tier-badged citations** in the UI. |
| "Know what you can't verify" | **INSUFFICIENT is the honest default** — GKIN abstains instead of bluffing. |

**One-line answer to memorize:** *"We don't claim our output is true — we make it auditable.
Every confident verdict is bolted to a real source sentence we re-verify; sources are weighted
so junk can't win; and when evidence is thin, GKIN says INSUFFICIENT instead of guessing."*

---

## 3. Technical architecture (for the architecture slide)
- **Frontend:** React + Vite + Tailwind (marketing landing) + a vanilla/React analyzer workspace.
- **Backend:** Python + FastAPI, served same-origin (so the UI and API share one URL).
- **AI:** Groq-hosted models — `gpt-oss-120b` (reasoning), `llama-3.3-70b` (JSON structuring +
  grounding), `llama-3.1-8b-instant` (fast + **fallback**), Llama-Vision (images), Whisper (audio).
- **Agentic verification loop** (`gkin/agentic/`): an explicit, framework-free state machine —
  `extract → build query → retrieve (search + scrape, tier-tagged) → ground → emit`, with one
  guarded retry, a hard 12-iteration cap, and grounding enforced by a Pydantic validator.
- **Classical ML:** TF-IDF + Logistic Regression / DistilBERT on WELFake (72k articles).
- **Data/Auth:** MongoDB Atlas + JWT. **Deploy:** DigitalOcean + pm2, auto-deploy on push to main.
- **Resilience (built this term):** every core LLM step (analyze, verify-claims, timeline) falls
  back from the 70B model to the 8B model if the 70B daily quota is hit — so the demo never
  hard-fails on rate limits.

---

## 4. The benchmark — REAL, VERIFIED numbers (do not change these)
We built an **automated** benchmark (`benchmark/run_competitor_benchmark.py`) that sends the same
5 verification prompts to GKIN, ChatGPT, Gemini, and Perplexity and scores each answer on a
7-category rubric (0–14): factual correctness, citations, source quality, traceability, timeline,
uncertainty handling, misinformation resistance. Missing API keys are skipped; **nothing is hardcoded.**

**Two scorers were run (report BOTH — they disagree, and that's honest):**

| Scorer | GKIN | ChatGPT | Gemini |
|---|--:|--:|--:|
| **Neutral rule-based** (unbiased, deterministic) | **7.8** | 7.0 | 0.0 |
| **LLM-as-judge** (gpt-4o-mini) | 7.2 | **8.4** | 0.0 |

**Per-prompt (neutral scorer):** GKIN wins *specific-date* (9 vs 3), *Eiffel 1889* (12 vs 9),
*controversial current-event* (5 vs 3); ChatGPT wins *coffee debunk* (10 vs 4) and ties *COVID
timeline* (9 vs 10).

**The robust, defensible takeaway (consistent across both scorers):**
> ChatGPT is brilliant at reciting **facts it memorized** (it scored a perfect 14 on the
> well-known-fact prompts under the judge). But on prompts needing **live, specific
> verification**, ChatGPT **refuses and asks for clarification — scoring 0** — while GKIN
> answers with cited, credibility-ranked evidence. That gap is GKIN's entire reason to exist.

**Honest caveats to state out loud (graders reward this):**
- The two scorers disagree because **each leans toward its own lineage** (a rule-based scorer
  rewards GKIN's structure; an OpenAI model rewards OpenAI's prose). We show both, not the better one.
- Heuristic scoring reads surface signals, not deep correctness — it's directional.
- **Gemini = 0** is real: the key works but needs Google billing enabled (not a manufactured win).

---

## 5. Honest framing — DO NOT overclaim
- ✅ Say: *"On a neutral rubric GKIN edges ChatGPT 7.8–7.0, and wins decisively where claims need
  live verification."* ❌ Don't say: *"GKIN beats ChatGPT."*
- ✅ Say the classifier hit **99.4% on WELFake but that's publisher-style overfitting** (~chance
  out-of-distribution) — we tested it and report it honestly. ❌ Don't present 99.4% as
  "fake-news detection accuracy" or as deepfake accuracy.
- ✅ Frame verdicts as **auditable**, not "true."
- ✅ Lead with *progress since midterm* — that's the grading emphasis.

---

## 6. Suggested slide outline (12–13 slides)
1. **Title** — GKIN · Truth Navigator · tagline · team · gkin.app
2. **The arc** — "Where we were at midterm → where we are now"
3. **Midterm recap + the critique** (truthfulness; "multiple sources isn't enough")
4. **What we heard** — the feedback verbatim (shows you listened)
5. **Response #1 — Grounding by construction** (verdict bolted to a re-verified source sentence)
6. **Response #2 — Trusted-source tiers** (junk-only → INSUFFICIENT; defeats fake consensus)
7. **Response #3 — Verdict labels + abstention** (SUPPORTED/CONTRADICTED/INSUFFICIENT)
8. **Response #4 — Timeline** of how a story evolved
9. **Automated benchmark: GKIN vs ChatGPT/Gemini/Perplexity** (the two-scorer table + the
   "ChatGPT scores 0 on live verification" insight)
10. **Live demo** (or embedded clip) — see §7
11. **UI/UX before → after** ("evidence, not just a score")
12. **Limitations (we say it) + roadmap + team contributions**
13. *(optional)* **Cost analysis** — near-zero marginal cost; only platform minimums

---

## 7. 3-minute demo script (rehearse this)
1. **[0:00–0:25] Hook + callback:** "Last time, the killer question was *how do you know it's
   true?* Here's our answer." *(Open gkin.app/app — hard-refresh first.)*
2. **[0:25–1:10] Run a scan:** paste a short article about a well-known fact (Eiffel Tower / Moon
   landing). Show manipulation index, persuasion tactics, emotional framing.
3. **[1:10–2:05] The centerpiece:** open **Source Trace → "Verify with sources."** Each claim gets
   a verdict tied to the **verbatim source sentence**, with a **trusted-source tier badge**. Point
   out one **INSUFFICIENT** — "GKIN abstains rather than guess."
4. **[2:05–2:35] Defeat fake consensus:** explain a verdict backed only by unverified sources is
   auto-downgraded to INSUFFICIENT — "the seeded-consensus attack, closed by policy."
5. **[2:35–3:00] Benchmark close:** show the table; land "we optimize for trust per verdict —
   committing less, but auditable every time."

**Safest demo queries (proven live):** an article on the Eiffel Tower / 1889 World's Fair →
SUPPORTED with citations; a false claim like *"The Eiffel Tower is located in Berlin"* →
CONTRADICTED; *"Drinking bleach cures COVID-19"* → CONTRADICTED. Avoid very recent/current-event
claims as the primary demo (they may correctly abstain).

**Demo DON'Ts:** don't run the benchmark live (slow); don't click the AI Assistant chat or
multi-article Compare (no rate-limit fallback); don't paste YouTube URLs; don't re-run the same
verify many times (burns quota). Hard-refresh the page before presenting.

---

## 8. Q&A prep (likely instructor questions + answers)
- **"How do you verify truth?"** → grounding-by-construction; re-verified citations; abstain when thin.
- **"Multiple sources isn't enough — how is this different?"** → we *weight*, not count; Tier-0-only → INSUFFICIENT.
- **"What stops hallucinated citations?"** → every cited sentence is re-checked against the scraped page; if it's not really there, it's dropped, and the verdict can't be SUPPORTED without one.
- **"Your classifier was 99% — isn't that solved?"** → no; ~chance out-of-distribution; it learned publisher style. That's *why* we built the grounded loop.
- **"How does it compare to ChatGPT?"** → neutral rubric: GKIN 7.8 vs 7.0; and ChatGPT scores 0 on live-verification prompts. We report both scorers honestly.
- **"Biggest weakness?"** → trusted-source list is hand-curated/English-centric; we abstain a lot (conservative coverage). Next: a transparent, contestable source registry.

---

## 9. Cost analysis (for that slide)
- **Marginal cost is near zero** — a full scan/verification is a fraction of a cent. The only real
  cost is each AI platform's **minimum prepay** (~$5 for OpenAI/Perplexity); Groq/Gemini are usage-billed.
- GKIN runs on **free/keyless** Wikipedia + DuckDuckGo search and a low-cost Groq tier.
- 12-month-at-scale projection: dominated by LLM tokens + a small Atlas/hosting tier — *fill in
  your assumptions (users/day, claims/user, tier).* 

---

## 10. Promo/explainer video outline (≤5 min)
Hook (AI confidently cites sources that don't say what it claims — we built the opposite) →
problem (readers can't audit truth; fake consensus is cheap) → solution (grounded, tiered,
abstaining verification) → **live demo** (the §7 happy path) → benchmark/traction → CTA (gkin.app).
Clear mic, ≥1080p capture, captions, closing slide with team + repo.

---

## Quick facts cheat-sheet
- Live: **gkin.app** · Repo: **github.com/adi113003/GKIN**
- Verdicts: **SUPPORTED / CONTRADICTED / INSUFFICIENT**
- Trusted tiers: **1 gov/academic · 2 journalism · 3 fact-checkers · 0 unverified**
- Benchmark: **GKIN 7.8 vs ChatGPT 7.0** (neutral) · ChatGPT **0** on live-verification prompts · Gemini 0 (billing)
- Classifier: 99.4% WELFake in-domain, ~chance OOD (honest framing)
- Resilience: 70B → 8B fallback on every core step (demo-proof against quota)
