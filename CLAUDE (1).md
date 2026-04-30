# GKIN — Week 3 Operating Doc (for Codex / coding agents)

> This doc is the source of truth for Week 3 work. If anything here conflicts with older notes in the repo, this file wins. Update it as decisions change.

## What this week is about

We are building **Block 5: an agentic per-claim fact-checking loop** and the **eval set** that lets us measure whether it works. Everything else — new UI features, new auth flows, new redesigns — is paused until the loop is shipped and measured.

Two parallel tracks run in the same week:

1. **Eval track** (Days 1–2, all 3 team members): build a stratified, hand-labeled article set so we can measure pipeline accuracy. Owner during labeling: shared. Owner of the schema and rubric: Adithya.
2. **Block 5 track** (Days 3–7, Adithya leads ML, Nghiem pairs on backend, Ronak owns UI surfacing): build `verify_claim()`, wire it into `/analyze`, and surface verdicts in the web UI and Chrome extension.

End-of-week deliverable: a demo where pasting an article triggers per-claim fact-checking with citations, the verdict badges render in both the web UI and the Chrome extension, and we can report a precision/recall number broken out by article category.

---

## Hard constraints (read before writing code)

- **No new UI features outside the Block 5 verdict surfacing.** Save/export, library, conspiracy mode, etc. are frozen for the week. If a PR touches those, push back.
- **The eval labels are the source of truth for accuracy claims.** Do not report any accuracy number that wasn't measured against the labeled set.
- **`verify_claim` must refuse when evidence is insufficient.** A confidently-cited hallucination is worse than no fact-check. Build the "insufficient" path before the "supported/contradicted" paths.
- **Cache every external API call by claim hash.** Re-running an analysis on the same article must not re-hit Brave/Google. SHA256 of the normalized claim string is the cache key.
- **Cost ceiling: $20 of API spend for the week.** If you're approaching this, stop and tell Adithya before continuing.

---

## Track 1 — Eval set (Days 1–2)

### Goal

Produce ~75 hand-labeled articles across 6 categories, with claim-level judgments, in 2 days. If we finish 50, ship 50 — the stratification matters more than the count.

### Article mix (target counts; adjust if a bucket runs short)

| Category | Target | Sourcing |
|---|---|---|
| Mainstream news | 21 | Already ingested in repo. Reuters, AP, NPR, etc. |
| State-affiliated / professional disinfo | 15 | Paste-in from rt.com, sputnikglobe.com, presstv.ir. Bypass scraper. |
| Partisan blogs / clickbait | 15 | Mix of left and right (e.g., Breitbart, Daily Wire, Occupy Democrats, Palmer Report). Equal split — 7-8 each side. |
| Op-eds and analysis | 10 | NYT Opinion, WSJ Opinion, The Atlantic, Guardian Opinion. |
| AI-generated articles | 10 | Generate via Groq with: "Write a 600-word news article about [topic] in the style of Reuters/AP. Include quotes from named officials." Topics drawn from real recent events. |
| Borderline (satire, press releases, sponsored) | 4 | The Onion, Babylon Bee, 1-2 PR Newswire releases, 1-2 sponsored-content pieces. |

**AI-generated bucket protocol:** Generate all 10 in one batch into a separate file. Mix them into the labeling pile *without flagging which are synthetic*. Label them blind. Reveal the source only after labeling is complete. This is the only way to get a clean answer to "does our pipeline detect AI text it wasn't told is AI."

### Storage

Single Google Sheet (or Airtable base — Sheet is simpler). Two tabs:

**Tab 1: `articles`** — one row per article.

| Column | Type | Notes |
|---|---|---|
| `article_id` | string | `art_001`, `art_002`, ... |
| `source` | string | Domain, e.g. `reuters.com` |
| `category` | enum | One of: `mainstream`, `state_disinfo`, `partisan_blog`, `op_ed`, `ai_generated`, `borderline` |
| `published_date` | date | YYYY-MM-DD; for AI-generated, leave blank |
| `url` | string | Original URL; blank for AI-generated |
| `title` | string | |
| `text_path` | string | Path in repo, e.g. `eval_set/articles/art_001.txt` |
| `overall_truthfulness` | enum | `broadly_truthful` / `broadly_misleading` / `mixed` / `opinion_not_applicable` |
| `manipulation_score_human` | int 0–100 | Your gut judgment. We will compare against the Groq gauge. |
| `labeler` | string | `adithya` / `ronak` / `nghiem` |
| `labeled_at` | timestamp | |
| `notes` | string | Anything weird about the article |

**Tab 2: `claims`** — one row per extracted claim.

| Column | Type | Notes |
|---|---|---|
| `claim_id` | string | `art_001_c01`, `art_001_c02`, ... |
| `article_id` | string | FK to articles |
| `claim_text` | string | Verbatim from Groq pipeline output |
| `is_verifiable` | bool | False for opinions, predictions, value judgments. If False, leave the next 4 fields blank. |
| `verdict` | enum | `true` / `false` / `unverifiable` / `partially_true` |
| `evidence_url` | string | One URL supporting your judgment. Wikipedia OK for established facts; primary source or fact-checker for contested claims. |
| `rationale` | string | One sentence. |
| `persuasion_tag_correct` | enum | `yes` / `no` / `no_tag_applied` — was Groq's persuasion-technique label for this claim accurate? |
| `labeler` | string | |
| `labeled_at` | timestamp | |

### The rubric — decision rules that must be consistent across labelers

These are the rules calibrated in the Day 1 reconciliation meeting. Update them there if disagreements surface; do not change them mid-labeling.

**`is_verifiable = False` if:**
- The claim is a prediction about the future ("X will happen")
- The claim is an opinion or value judgment ("X is bad")
- The claim is about an internal mental state with no public evidence ("X believes Y")
- The claim is so vague it has no truth value ("things are getting worse")

**`verdict = true`:** Multiple credible sources directly support the claim, or it's a well-established fact.

**`verdict = false`:** Credible sources directly contradict the claim, or it's a well-known false claim.

**`verdict = partially_true`:** The core claim is correct but key details are wrong, exaggerated, or stripped of context that changes meaning.

**`verdict = unverifiable`:** You searched in good faith for ~3 minutes and could not find credible sources either way. This is a valid verdict — do not force a true/false call.

**`overall_truthfulness`:**
- `broadly_truthful`: ≥80% of verifiable claims are true; no major false claims.
- `broadly_misleading`: any major false claim, OR pattern of misleading framing even if individual claims are technically true.
- `mixed`: significant true and false claims both present.
- `opinion_not_applicable`: op-ed where most "claims" are opinions.

**`manipulation_score_human` (0–100):** your gut. Use the same scale as the Groq gauge. Don't overthink it; your prior is the calibration target.

### Day 1 schedule

| Time | Activity | Who |
|---|---|---|
| Hour 1 | Set up Sheet + paste in 21 existing articles + scrape/paste 30+ new ones | Adithya |
| Hour 2 | All 3 label the same first 5 articles independently. No talking, no Slack. | All |
| Hour 3 | **Reconciliation meeting (60 min).** Walk through every disagreement. Update the rubric in this doc with any new tiebreaker rules. | All |
| Hours 4–8 | Heads-down labeling. Use Slack/Discord for edge cases — if the rubric doesn't cover something, post it, decide together. | All |

### Day 2 schedule

| Time | Activity | Who |
|---|---|---|
| Hours 1–6 | Continue labeling. Target: each person finishes ~25 articles total by mid-afternoon. | All |
| Hour 7 | **Spot-check**: Adithya pulls 5 random articles from each of the other two labelers, checks for consistency. | Adithya |
| Hour 8 | Export Sheet to CSV, commit to repo at `eval_set/labels.csv`. Generate summary stats: count per category, distribution of verdicts. | Adithya |

### Output of the eval track

A directory in the repo:

```
eval_set/
  articles/
    art_001.txt
    art_002.txt
    ...
  labels.csv          # exported from the Sheet
  rubric.md           # this rubric, version-locked
  README.md           # how to use the eval set
```

---

## Track 2 — Block 5 fact-checking loop (Days 3–7)

### Day 3 — Scoping spike (2-hour meeting, all 3)

This is a meeting, not homework. Block calendar time. Output is a single file `docs/block5_spec.md` committed to the repo before anyone writes code.

The four decisions that must be made:

1. **Search API choice.** Options: Brave Search API ($3/1k queries, generic web search), Google Fact Check Tools API (free, returns existing fact-check articles), or both in sequence. Recommended default: **Google Fact Check Tools first** (free, often returns the verdict directly), **Brave as fallback** when Fact Check returns nothing. Decide and lock it.
2. **Cache key format.** Recommended: `sha256(claim_text.strip().lower())`. Cache hits return the full prior verdict object. Cache TTL: 30 days (facts can change; news especially).
3. **Insufficient-evidence behavior.** When retrieval returns < 2 relevant results, or when the grounding model says it can't verify: return `verdict: "insufficient"` with `evidence: []` and `confidence: 0`. Do NOT fall back to the model's training-data knowledge. This is the most important rule in the whole loop.
4. **Return JSON shape.** Lock this so the frontend can be built in parallel:

```json
{
  "claim_id": "art_001_c03",
  "claim_text": "...",
  "verdict": "supported" | "contradicted" | "insufficient",
  "confidence": 0.0-1.0,
  "evidence": [
    {
      "url": "https://...",
      "title": "...",
      "snippet": "...",
      "source_type": "fact_check" | "news" | "primary" | "wiki",
      "relevance": 0.0-1.0
    }
  ],
  "reasoning": "One paragraph explaining the verdict, citing the evidence by URL.",
  "verified_at": "2026-04-29T14:32:00Z"
}
```

### Day 4–5 — Build `verify_claim()` (Adithya + Nghiem)

Standalone module: `gkin/verification/verify_claim.py`. No UI integration yet. The module exposes one function:

```python
async def verify_claim(claim_text: str, *, force_refresh: bool = False) -> dict:
    """
    Returns the verdict object spec'd in block5_spec.md.
    Raises VerificationError on hard failures (API down, malformed input).
    Returns 'insufficient' on soft failures (no evidence found).
    """
```

**Internal pipeline:**

1. **Cache check.** Hash the claim. If hit and not force_refresh, return cached verdict.
2. **Query rewrite.** Use `MODEL_FAST` (`llama-3.1-8b-instant`) to rewrite the claim as a search query. Prompt: "Rewrite this factual claim as a concise web search query (max 10 words). Return only the query, no quotes or punctuation." This step is cheap and improves retrieval.
3. **Retrieve.** Hit Google Fact Check Tools API first. If 0 results, hit Brave Search. Take top 5 results. If still 0, return `insufficient`.
4. **Ground.** Pass the claim + retrieved snippets (with URLs) to `MODEL_REASON` (`deepseek-r1-distill-llama-70b`). System prompt: "You are a fact-checker. Given a claim and retrieved evidence, return a JSON object with verdict ∈ {supported, contradicted, insufficient}, confidence ∈ [0,1], and reasoning. Cite evidence by URL. If the evidence does not directly address the claim, return 'insufficient' — do not use your training knowledge." Force JSON mode.
5. **Validate.** Reject any verdict where the reasoning doesn't cite at least one of the retrieved URLs. Fall back to `insufficient` if validation fails.
6. **Cache and return.**

**Test harness on Day 5 afternoon:** run `verify_claim` on 20 claims pulled from the labeled eval set. Compute precision/recall by hand. Iterate on the grounding prompt if precision is < 70%.

**Expected blockers:**
- Grounding prompt produces JSON that's slightly off-spec. Mitigation: use Pydantic to validate, retry once with the validation error in the prompt.
- Fact Check Tools API returns results in a quirky schema. Mitigation: write a small adapter, don't try to handle it inline.
- Brave returns SEO spam for political queries. Mitigation: filter results by source_type, prefer fact-checkers (snopes, factcheck.org, politifact) and Wikipedia.

### Day 6 — Wire into `/analyze` (Adithya)

The existing `/analyze` endpoint extracts claims as part of its output. Add a post-processing step:

```python
# After existing analysis runs and produces `result['claims']`:
verifiable_claims = [c for c in result['claims'] if c.get('is_verifiable', True)]
verifications = await asyncio.gather(*[
    verify_claim(c['text']) for c in verifiable_claims
])
result['verifications'] = verifications
```

Limit concurrency with `asyncio.Semaphore(5)` to avoid hammering the search APIs. Add a 30-second timeout per claim — if `verify_claim` hangs, return `insufficient` for that claim and continue.

Also: add a `/verify` endpoint that takes a single claim string and returns the verdict object. Useful for manual testing and for the Chrome extension.

### Day 7 — Surface in UI (Ronak)

**Web frontend (`static/index.html`):**

For each claim in the analysis dashboard, add a verdict badge next to the claim text:
- ✓ green badge for `supported`
- ✗ red badge for `contradicted`
- ? gray badge for `insufficient`

On click/hover, show a popover with:
- Verdict + confidence as a percentage
- The reasoning paragraph
- A list of evidence URLs (clickable, open in new tab)
- "Verified at" timestamp

**Chrome extension (`chrome-extension/`):**

Below the existing manipulation score badge, add a "Claims verified" section:
- Counts: "5 supported · 2 contradicted · 3 insufficient"
- Click to expand into a scrollable list of all verdicts with the same popover content as the web UI.

**Do not** add new UI for things outside this. No new tabs, no new settings, no redesigns.

### End-of-week measurement

By Friday EOD, Adithya runs `verify_claim` over every claim in the labeled eval set and produces a markdown report at `docs/block5_results.md` containing:

- Overall precision and recall (where the human label is the ground truth and `verify_claim`'s `supported`/`contradicted` is the prediction)
- Same metrics broken out by article category
- A confusion matrix
- 5 example failure cases with explanation
- Estimated API cost for the full eval run

**This report is the answer to the professor's "standard API calls" critique.** It is the deliverable that matters most for grading.

---

## File / module layout (target end-of-week)

```
gkin/
  verification/
    __init__.py
    verify_claim.py       # the core function
    cache.py              # SHA256 keyed JSON cache (file-backed for now)
    retrievers.py         # FactCheckToolsClient, BraveSearchClient
    grounding.py          # the grounding prompt + JSON validation
    schema.py             # Pydantic models for the verdict object

eval_set/
  articles/
  labels.csv
  rubric.md
  README.md

docs/
  block5_spec.md          # locked Day 3
  block5_results.md       # written end of week

server.py                 # adds /verify endpoint and /analyze post-processing

static/
  index.html              # adds verdict badges + popover

chrome-extension/
  popup.html              # adds claims-verified section
  popup.js
```

---

## Environment variables (add to `.env`)

```
GROQ_API_KEY=...                    # already exists
GOOGLE_FACT_CHECK_API_KEY=...       # new — get from Google Cloud Console, enable "Fact Check Tools API"
BRAVE_SEARCH_API_KEY=...            # new — get from api.search.brave.com, $3/1k queries
GKIN_VERIFICATION_CACHE_DIR=./cache/verifications   # new
```

---

## Things explicitly out of scope this week

- Fine-tuning a custom persuasion classifier (Block 4)
- Cross-dataset evaluation against LIAR/FakeNewsNet
- Server-side library persistence (was deferred from Week 2)
- Chrome Web Store submission
- New UI redesigns or theme changes
- Adding new auth/account features
- Improving the WELFake baseline

If a teammate wants to pick one of these up after Block 5 ships and the eval is done, that's a Week 4 conversation.

---

## Definition of done (end of Friday)

A reviewer can:

1. Pull the repo, set env vars, run `python server.py`.
2. Open the web UI, paste an article, see the analysis populate **with verdict badges on each claim**.
3. Click a badge, see the evidence popover with working links.
4. Open the Chrome extension on a news article URL, see the manipulation score AND the claims-verified summary.
5. Read `docs/block5_results.md` and find a precision/recall number with category breakdown, computed against `eval_set/labels.csv`.
6. Read `eval_set/rubric.md` and `docs/block5_spec.md` and understand exactly how the system was evaluated and how `verify_claim` works.

If any of these don't work, we are not done. Ship what works honestly; report what doesn't.

---

## Notes for Codex / coding agents working from this doc

- When in doubt about scope, re-read the "Hard constraints" section.
- The eval set is the spine of the project. Do not write code that depends on labeled data before Day 3 — the labels won't exist yet.
- The grounding prompt in `verify_claim` is the highest-risk piece of code. Write it carefully, test it against adversarial cases (claims about events the LLM "knows" but where retrieval found nothing), and prefer false negatives (`insufficient`) over false positives (confident wrong verdicts).
- Cache aggressively. Re-running the eval should be free after the first run.
- Don't add features. If a feature seems necessary, push back to Adithya before writing code.
- Commit in small, reviewable PRs. One PR per day per person is the target.
