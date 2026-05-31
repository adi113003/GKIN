# GKIN — Final Presentation Kit

> Built to score the final presentation rubric (100 pts), which grades **progress since
> midterm**. Every section here leans on the "where we were → where we are now" arc.

## The narrative spine (memorize this)

> *"At midterm, GKIN could already generate rich analysis of an article — but our reviewer
> caught a real weakness: we couldn't prove our output was true, and they pointed out that just
> citing multiple sources doesn't help, because bad actors can manufacture consensus. We took
> that seriously. We spent the back half of the term rebuilding GKIN's truth layer around four
> things: **traceable citations, a trusted-source whitelist, evidence-grounded verdicts that are
> impossible to fake, and honest abstention.** Today GKIN doesn't ask you to trust its verdict —
> it shows you the source sentence behind it, weights how credible that source is, and says 'I
> don't know' instead of guessing."*

---

## 1-minute pitch

> Every day people see a headline, a clip, or a screenshot and have no fast way to know if it's
> real. Existing AI assistants will confidently answer — and sometimes confidently make things
> up, citing sources that don't say what they claim. GKIN is a media-literacy tool that does the
> opposite of bluffing. Paste any article, URL, image, or audio, and GKIN breaks it into checkable
> claims and gives each one a verdict — SUPPORTED, CONTRADICTED, or INSUFFICIENT — **bolted to the
> exact source sentence that justifies it**, on a source we've credibility-ranked. If the only
> sources are junk blogs, GKIN refuses to render a verdict — so you can't manufacture a fake
> consensus to fool it. It's the fact-checker that shows its work, and abstains when it should.

---

## 3-minute demo script

**[0:00–0:25] Hook + the midterm callback.**
> "Last time, our reviewer asked the killer question: *how do you know what GKIN generates is
> true?* Here's our answer." *(Open analyzer.)*

**[0:25–1:10] Run a real article.** Paste a known article/URL → **Analyze**.
> "GKIN runs two systems in parallel — an LLM reasoning pipeline and an ML classifier — and
> surfaces manipulation tactics with exact quotes, an emotional-framing breakdown, and a
> manipulation index." *(Scroll the scan results.)*

**[1:10–2:05] The since-midterm centerpiece — grounded verdicts.** Trigger claim verification.
> "Here's what's new. Each claim gets a verdict — and look: every SUPPORTED or CONTRADICTED
> verdict links to the **verbatim sentence** from the source that backs it. We re-verify that
> sentence is actually on the page, so the model literally cannot cite something that isn't there.
> And notice this one says **INSUFFICIENT** — GKIN would rather abstain than guess." *(Click a
> citation; show the tier badge.)*

**[2:05–2:35] Defeating manufactured consensus.**
> "Sources are tiered — government and academic, established journalism, fact-checkers. If a
> verdict's only support is unverified blogs, our policy **downgrades it to INSUFFICIENT
> automatically.** So flooding the web with coordinated junk can't push GKIN to a false verdict.
> That's the exact attack our reviewer warned about — closed by design."

**[2:35–3:00] Timeline + benchmark close.**
> "GKIN also builds a narrative timeline of how a story evolved, with per-event verdicts. And
> we built a benchmark that scores GKIN as a fact-checker with an 'I don't know' option, head to
> head against a bare LLM and the major assistants — optimizing for the number that matters: how
> often it's *confidently wrong*. We'd rather commit less and be trustworthy when we do."

---

## Slide outline (10–12 slides)

1. **Title** — GKIN · Truth Navigator · tagline · team.
2. **The arc** — "Midterm → Now" one-liner (set expectations: this talk is about progress).
3. **Midterm recap** — what worked + the reviewer's critique (validation/truthfulness, fake consensus).
4. **What we heard** — the 5 suggestions, verbatim. *(Shows we listened.)*
5. **Response #1 — Traceable citations** — EvidenceSpan; grounding-by-construction; anti-hallucination gate.
6. **Response #2 — Trusted-source whitelist + tiers** — the table; junk-only → INSUFFICIENT.
7. **Response #3 — Verdict labels + abstention** — SUPPORTED/CONTRADICTED/INSUFFICIENT; misleading_rate.
8. **Response #4 — Timeline.**
9. **Response #5 — Benchmark + competitive comparison** — capability matrix; metrics that matter.
10. **Automated Benchmark: GKIN vs General AI Tools** — the rubric, the scoreboard, the honest caveat (see script below).
11. **Live demo** *(or embedded clip).*
12. **UI/UX before → after** — analyzer re-skin + "evidence, not just a score."
13. **Limitations (we say it) + roadmap + team.**

---

## Slide script — "Automated Benchmark: GKIN vs General AI Tools"

> "The midterm asked us to *prove* GKIN is better, not just claim it. So we built an automated
> benchmark — `benchmark/run_competitor_benchmark.py` — that sends the **same** verification
> prompts to GKIN, ChatGPT, Gemini, and Perplexity, then scores every answer on a 7-point
> rubric: factual correctness, citations, source quality, traceability, timeline clarity,
> uncertainty handling, and misinformation resistance. It's reproducible: missing API keys are
> skipped, nothing is hardcoded, and we can run it live. We score two ways — deterministic rules,
> and an optional LLM-as-judge that's explicitly told to give GKIN no special treatment. GKIN
> wins on the dimensions the feedback flagged — traceability, source quality, uncertainty — because
> those are *structural* in our pipeline, not prompt-dependent. The full report regenerates into
> `benchmark/results/latest_report.md`."

**To present:** run `python benchmark/run_competitor_benchmark.py` (add competitor keys for the
full board), then screenshot the "Overall" and "Per-prompt" tables from `latest_report.md`.

---

## Key talking points for the "Response to Midterm Feedback" slide (worth 12 pts)

- Name the feedback **verbatim** first — graders reward "clearly heard."
- For each point, say *feedback → why it mattered → what we built → file/commit*.
- Land the headline: **"An ungrounded verdict is now un-constructible — it's a `ValidationError`,
  not a promise."**
- End with a limitation, unprompted (the classifier-learned-publisher-style story). Honesty scores.

---

## Q&A preparation (likely instructor questions)

**Q: How do you actually verify a claim is true?**
> We don't claim truth — we make it auditable. Every confident verdict is bolted to a real source
> sentence we re-verify against the page; sources are credibility-tiered so junk can't win; and
> when evidence is thin we return INSUFFICIENT instead of guessing.

**Q: You said multiple sources isn't enough — so how is this different?**
> Right, that was your midterm point. We don't count sources — we *weight* them. A verdict backed
> only by unverified (Tier 0) sources is automatically downgraded to INSUFFICIENT, no matter how
> many agree. Manufactured consensus can't clear the bar.

**Q: What stops the LLM from hallucinating a citation?**
> `validated_spans()` — the model must copy the sentence verbatim, and we re-check it's an actual
> substring of the scraped page. If it's not, we drop it; if nothing survives, the verdict becomes
> INSUFFICIENT. The `Verdict` model itself refuses to be built without a valid span.

**Q: Your classifier was 99% accurate — isn't that already solving the problem?**
> No — and we're glad we tested it. On out-of-distribution data (LIAR) it drops to ~chance. It
> learned *publisher style*, not truth. That finding is why the final product centers on grounded
> retrieval, not the classifier. We kept the classifier as a secondary signal and a teaching example.

**Q: Why not use LangGraph / an agent framework?**
> We hand-rolled an explicit state machine — typed state, explicit edges, a hard iteration cap.
> It gives us the discipline a framework would (guaranteed termination, no skipped verify step)
> while staying fully unit-testable with fakes and matching our no-framework stack.

**Q: How does this compare to ChatGPT / Perplexity?**
> They're broader and more fluent. For *trustworthy verification* GKIN wins on traceability, source
> weighting, consensus-attack resistance, and abstention — none of which they guarantee. Our
> benchmark measures the dangerous metric: how often a system is *confidently wrong*.
> (See COMPETITIVE_COMPARISON.md.)

**Q: What's your biggest remaining weakness?**
> The trusted-source list is hand-curated and English-centric, and we abstain a lot, so coverage is
> conservative. Next step is a transparent, contestable source registry and a publisher-held-out eval.

**Q: What did each person do?** → see FINAL_REPORT §9 / weekly reports.

---

## Promo + explainer video outline (≤5 min)

- **Hook (0:15–0:30):** "AI will confidently tell you something false — and cite a source that
  never said it. We built the opposite."
- **Problem (0:30–1:00):** readers can't audit truth; fake consensus is cheap.
- **Solution (1:00–1:30):** GKIN — verdicts bolted to re-verified, credibility-tiered evidence;
  abstains instead of bluffing. Mention the midterm-feedback arc.
- **Live demo (1:30–3:30):** the 3-minute demo above (happy path, real article, click a citation,
  show an INSUFFICIENT, show the timeline).
- **Traction/outcome (3:30–4:15):** benchmark — low misleading_rate vs alternatives; 〘FILL: testers〙.
- **CTA (4:15–4:45):** repo URL, how to try it, contact. Closing slide: team + project + repo.
- **Production:** clear mic, ≥1080p screen capture, captions for key claims, every member on
  camera or credited. Test the link is public before submitting.
