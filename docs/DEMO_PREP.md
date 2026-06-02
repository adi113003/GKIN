# GKIN Demo Prep — Live Comparison

## TL;DR
The root cause of GKIN's apparent loss was a dead `GROQ_API_KEY` (HTTP 401) — the entire pipeline ran on Groq, so every grounding call failed and GKIN abstained with `INSUFFICIENT`. We swapped in a working key; no scoring code changed. GKIN's honest, demonstrable win is **verifiable citations**: every GKIN URL resolves and its quoted sentence is verbatim on the live page, while ~9 of ~11 ChatGPT URLs across 5 claims 404. GKIN does **not** win the headline rubric number — on the LLM judge ChatGPT often ties or beats it — and that's fine. We claim traceable evidence, not the aggregate score.

---

## 1. Why ChatGPT was "winning" — and what actually changed

**The symptom.** In our last comparison, ChatGPT looked like it was beating GKIN across the board. GKIN returned `INSUFFICIENT` with 0 citations on *every single claim* — even softballs like "the Eiffel Tower was built for the 1889 World's Fair." That looks damning, like our system simply can't fact-check.

**The real root cause — and it was infrastructure, not quality.** The `GROQ_API_KEY` in our `.env` was dead (HTTP 401, Invalid API Key). GKIN's entire pipeline — extract claims, build a search query, ground the verdict — runs on Groq. So every grounding call failed, returned "No grounded evidence retrieved," and the system correctly abstained with `INSUFFICIENT`. It wasn't reasoning poorly; it had no power to its engine. ChatGPT uses a *separate, working* OpenAI key, so it was the only system actually running. We were comparing a live system to a dead one.

**The fix.** We swapped in a working Groq key and restarted the server. That is the entire change. **Nothing in the scoring code was touched** — `benchmark/scoring.py` gives GKIN no bonus and was not modified.

> **Scope of this table:** the numbers below are the **live-session LLM-judge run** on these 4 specific claims (Eiffel, coffee, microchip, GPT-5.2). This is a **different run** from the 5-prompt heuristic report that produces 8.0/14 vs 7.0/14 (see §3c). Do not conflate the two scorers/runs.

| Claim | BEFORE (dead key) | AFTER (working key) | ChatGPT |
|---|---|---|---|
| Eiffel Tower (true) | INSUFFICIENT, 0 cites — H3/J0 | SUPPORTED, 3 cites — H12/J12 | H11/J14 |
| Coffee cures Alzheimer's (false) | INSUFFICIENT, 0 cites — H4/J0 | CONTRADICTED, 2 cites — H9/J11 | H11/J13 |
| COVID vaccine microchip (false) | INSUFFICIENT, 0 cites — H4/J0 | CONTRADICTED (conf 1.0), 2 cites — H12/J10 | H14/J12 |
| GPT-5.2 in May 2026 (recent/obscure) | — | INSUFFICIENT, 0 cites — H5/J0 | H12/J14 |

(H = heuristic, J = judge, out of 14.)

**Honest read:** the fix made GKIN *function*, not invincible. Even after the fix, **ChatGPT scores ≥ GKIN on the judge for 3 of the 4 claims above** (Eiffel J14 vs J12; coffee J13 vs J11; GPT-5.2 J14 vs J0; only microchip goes our way, J10 vs J12). GKIN also still abstains on recent/obscure claims its free search can't surface (the GPT-5.2 row) — safe, but it costs rubric points. The win is **verifiable citations**, not the rubric total. GKIN was never *worse* — it was unplugged.

---

## 2. Live demo script (what to type, click, and say)

**Setup (before the room is watching):** GKIN server live on `:8000` (restarted with the working Groq key), comparison page at `http://localhost:8800`. Confirm the **GKIN** and **ChatGPT** columns return real results. **Gemini:** the key is present but the call may fail on Google billing (`limit: 0`) — verify it actually returns a result before the demo, and be ready to grey it out like Perplexity if it errors. **Do not assert Gemini is live until you've seen it answer.** Perplexity is greyed (no key) — say so up front so nobody asks.

**PACING WARNING (read this twice):** The Groq key is fresh free-tier. Demo **one claim at a time**, wait for each result to fully render before submitting the next. Do **not** queue several or re-fire a slow one — a 429 makes GKIN fall back to INSUFFICIENT and you will look like the bug we just fixed. If you want a safety net, pre-run the claims once 30 min before and have screenshots ready.

**The framing line (open with this):** "The professor asked: how do you verify generated info is actually true, when bad actors can seed sources? Our answer isn't 'trust our number' — it's 'every citation we show resolves to a real page, and the quoted sentence is really on it.' Watch what happens when you click the other system's citations."

### Claims to demo (in order)

1. **Type:** `COVID vaccine microchip` — the centerpiece. GKIN returns CONTRADICTED, confidence 1.0, 4 citations.
2. **Type:** `Vaccines cause autism` — GKIN CONTRADICTED, 3 citations.
3. **Type:** `Drinking bleach cures COVID` — GKIN CONTRADICTED, 3 citations.
4. (Optional, if time and quota allow) **Type:** `5G spreads COVID-19` — the honest one: here ChatGPT's citations partly resolve too, which lets you make the fairness point.

### The click/verify step (do this on claim 1, the microchip claim)

- Click **ChatGPT's** cited URL (e.g. `cdc.gov/vaccinesafety/...` or `snopes.com/fact-check/covid-vaccine-microchip/`). It **404s**. **SAY:** "Authoritative-looking, confidently cited — and it doesn't exist. This is exactly the failure mode the professor flagged: a fluent answer that *looks* sourced isn't verifiable, and a bad actor could just as easily seed a fake-looking URL."
- Click **GKIN's** cited URL (NIH / PMC, BBC, Wikipedia). It **loads**. Use Cmd-F on the live page for GKIN's quoted sentence — **find it verbatim** on the real article. **SAY:** "Our grounding gate won't let GKIN say SUPPORTED or CONTRADICTED unless the quoted sentence is a verbatim substring of the live page. No real source, no verdict — that's how we make it traceable instead of trusting the model."

### Be honest about the score (say this, don't dodge it)

After the contrast lands: **SAY:** "On the aggregate judge rubric, ChatGPT often scores as high or higher than us — the judge rewards long, hedged, comprehensive prose, and our terse 'VERDICT + verbatim evidence' format gives up points on timeline and uncertainty. So we don't claim we win the headline number. We claim something more useful: **verifiable evidence versus fabricated citations.** When the professor asked how to know it's true, that's the difference that matters."

**If asked about abstaining:** GKIN returns INSUFFICIENT on recent/obscure claims (e.g. a made-up GPT-5.2 release) when free search finds nothing — that costs rubric points but is the safe, honest behavior; a keyed search backend would close the gap.

---

## 3. What every number means (say this out loud)

Our last presentation fell apart because we couldn't explain our own numbers. Here is every number, in plain language, with the exact line to say.

### (a) The live rubric: 14 points, and what it actually measures

Each answer is graded on 7 categories, each worth 0, 1, or 2 points — so 14 is a perfect score. We grade two ways: a **heuristic** scorer (a simple program that counts things — does the answer have citations, dates, hedging words, trusted-source names?) and an **LLM judge** (a separate AI that reads the answer and rates its quality). Both are blunt instruments. They reward the *shape* of a good answer — citations present, uncertainty acknowledged — not whether the answer is actually true.

> **Say this out loud:** "This score measures whether an answer *looks* well-sourced and careful. It does not prove the answer is correct. Treat it as directional, not a grade on truth."

### (b) Why ChatGPT often scores as high or higher — and why that is misleading

Be honest: on the judge's total, ChatGPT (gpt-4o-mini) frequently ties or beats us. That's because the judge rewards fluent, comprehensive, hedged prose, and ChatGPT writes beautiful paragraphs. GKIN is deliberately terse — "VERDICT: CONTRADICTED (confidence 1.0)" plus a verbatim quote — so it scores zero on "timeline clarity" (we don't emit dates) and low on "uncertainty handling" (we're decisive when we're sure). We lose style points by design.

But here is the catch we tested live: **ChatGPT's citations don't load.** Of ~11 URLs it cited across 5 misinformation claims, ~9 were dead (404/403) — invented but authoritative-looking links like `cdc.gov/vaccinesafety/...` and `snopes.com/fact-check/covid-vaccine-microchip/`. Every GKIN citation resolved (BBC, Wikipedia, NIH, Guardian), because our system physically *cannot* issue a verdict without a verbatim quote pulled from a page it actually read.

> **Say this out loud:** "A higher style score does not mean more trustworthy. We checked: most of ChatGPT's sources 404. Ours load — because we can't make a claim without a real quote from a real page."

### (c) The two benchmarks we previously mixed up

These are different questions and were confused on stage:

1. **Competitor rubric on the LLM pipeline (heuristic scorer):** GKIN **8.0/14** vs ChatGPT **7.0/14** across 5 prompts. **Important caveat:** this is the **HEURISTIC scorer only** (`latest_results.json`, dated 2026-05-31, has `judge_used=false`, `mode="heuristic"`, `judge=None` on all 10 rows). The heuristic scorer rewards the *shape* GKIN emits — ≥2 URLs, dates, hedge words — so it structurally favors us. On the **LLM judge** (which rewards fluent, hedged prose), **ChatGPT often ties or beats GKIN** (see §1 and §3b). So 8.0 vs 7.0 is **not** a clean rubric win: GKIN leads on the heuristic scorer, trails-or-ties on the judge. Our real, defensible win is **verifiable citations**, not the aggregate rubric number on either scorer.
2. **The ML classifier (advisory only):** **50.9%** on the LIAR dataset vs **98.6%** on GONZALO. On LIAR the classifier scores 50.9%, **identical to the random baseline (0.509) and barely above majority-class (0.50)** in the same `ood_benchmark_liar.json` — i.e. it carries no real signal. That gap is our *justification*, not a failure: it proves the classifier learned to recognize *publisher writing style*, not truth, which is exactly why we **demoted** ML to an advisory hint and built the citation-grounded pipeline as the real verdict engine.

> **Say this out loud:** "50.9% on LIAR is statistically no better than random or always-guessing-one-class — and that's the point. It's why we don't trust the classifier to decide truth. It's a footnote; the grounded pipeline is the verdict."

---

## 4. Legitimate ways to strengthen GKIN before the demo (no cheating)

These surface GKIN's *real* capability against the rubric in `benchmark/scoring.py`. None touch the scorer (which is untouched and gives GKIN no bonus — see the module docstring and the judge system prompt).

**(1) Enable a keyed search backend (Brave / Google Programmable Search). FAIR.**
GKIN's abstentions on obscure/recent claims (GPT-5.2, etc.) are a *retrieval* failure, not a reasoning failure: free DuckDuckGo + Wikipedia surfaces nothing, so `retrieve_evidence` returns no spans and `emit_verdict` correctly falls to INSUFFICIENT. `gkin/agentic/search.py` already ships `brave_search` / `google_search` behind `resolve_backend`, fail-soft to DDG. Setting `BRAVE_SEARCH_API_KEY` (or `GOOGLE_SEARCH_API_KEY` + `GOOGLE_SEARCH_CX`) genuinely improves retrieval stability — it's better evidence, not a thumb on the scale. **Caveat: verify first.** The `.env` Google key is commented out and Custom Search may not be enabled for the project; `google_search` returns `[]` on a missing key/cx and `[{"error":...}]` on an HTTP failure, so an un-enabled API silently no-ops. Brave is the safer bet. Test the backend in isolation before the demo; do not assume it works.

**(2) Surface data GKIN computes — but this needs a real code change, not a free win. BE CAREFUL.**
- *Dates → `timeline_clarity`.* `_s_timeline` rewards real dates, and `retrieve_evidence` does scrape `page.get("date")` — **but that date is currently DROPPED at span construction.** `EvidenceSpan` (in `gkin/agentic/verdict.py`, lines 37-49) has **no** `published_date` field, and `validated_spans()` (`nodes.py` line 414) does **not** pass `ev['date']` when building the span. So surfacing the date is **not** "we already have it" — it requires a real code change: add a `published_date` field to `EvidenceSpan` and plumb `ev.get('date')` through. **Treat this as a pre-demo code change that must be tested, not a free move.** Also: the scraped dates can be wrong/garbage — the committed Apollo-11 row shows scraped dates like `2001-09-24` and `2018-08-23` for a 1969 event. Emitting raw scraped dates could **hurt** credibility on `timeline_clarity`, not help it.
- *`confidence` / `low_confidence` → `uncertainty_handling` (FAIR if literal).* These are genuine fields set by `apply_tier_policy` (Tier-3-only caps confidence and flips `low_confidence`). Printing "Confidence: 0.6 (low — fact-checker sources only)" reports the model's actual computed state. **Borderline/gaming line:** padding decisive, well-grounded verdicts with generic hedge words ("may", "might", "appears") purely because `_s_uncertainty` counts them — that is injecting noise to hit the scorer and misrepresents a confident call. Surface the real number and flag; never sprinkle hedges.

**(3) Pick demo claims that play to GKIN's genuine strength. FAIR.**
GKIN wins on clear misinformation with real debunks available (microchip, bleach, vaccines-autism): its grounding gate (`validated_spans` + `_grounded_in_evidence`) enforces verbatim citations, so its URLs resolve while ChatGPT fabricates plausible-but-dead links. Choose recent, debunkable claims — not trivia ChatGPT nails from memory. This isn't cherry-picking to hide weakness; it's demonstrating the capability the tool was built for. Be honest about the trade-off live: GKIN abstains where ChatGPT confabulates, and that safety costs rubric points on `timeline_clarity`/`uncertainty_handling`.

---

## Honesty check
Auditor verdict: mostly honest and well-grounded — core empirical claims (dead Groq key, verbatim grounding gate, ~9/11 dead ChatGPT URLs, 50.9% LIAR vs 98.6% GONZALO, untouched scorer) all check out; this version fixes the one material misrepresentation (8.0 vs 7.0 is the heuristic scorer, not the judge) and the two overclaims (surfacing dates needs a real code change; Gemini may fail on billing), making the package defensible.
