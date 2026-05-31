# GKIN vs ChatGPT / Gemini / Perplexity

> Midterm feedback asked us to *"compare GKIN against ChatGPT, Gemini, or Perplexity"* and to
> *"build a benchmark showing GKIN performs better than alternatives."* This document does
> both: a **capability matrix** (provable today from our features) and a **runnable
> head-to-head benchmark** (methodology + exact commands; fill in numbers when API keys are
> available — we do not publish fabricated numbers).

---

## 1. Why this comparison is fair — and why it isn't apples-to-apples

ChatGPT, Gemini, and Perplexity are general assistants. GKIN is a **narrow, auditable
media-literacy verifier**. We are *not* claiming GKIN is a better chatbot. We're claiming that
for the specific job *"is this claim true, and can you prove it?"* GKIN's design makes
guarantees the general tools don't:

- it **cannot** emit a confident verdict without a re-verified source sentence;
- it **weights** sources by a trusted-source tier policy;
- it **abstains** ("INSUFFICIENT") instead of bluffing.

Those are architectural properties, not prompt instructions — which is the whole point.

---

## 2. Capability matrix

✅ = built-in / guaranteed · ⚠️ = possible but not guaranteed / inconsistent · ❌ = not available

| Capability | **GKIN** | ChatGPT (GPT-4-class) | Gemini | Perplexity |
|---|:--:|:--:|:--:|:--:|
| **Verdict bolted to a verbatim source sentence** | ✅ enforced by construction | ❌ | ❌ | ⚠️ cites pages, not sentences |
| **Citations re-verified against page text (anti-hallucination)** | ✅ `validated_spans()` | ❌ | ❌ | ❌ |
| **Source credibility weighting (trusted-source tiers)** | ✅ Tier 1/2/3/0 policy | ❌ | ❌ | ⚠️ ranks, doesn't tier by trust |
| **Manufactured-consensus resistance (junk-only → no verdict)** | ✅ Tier-0-only → INSUFFICIENT | ❌ | ❌ | ❌ |
| **Explicit abstention when evidence is thin** | ✅ INSUFFICIENT label | ⚠️ sometimes hedges | ⚠️ | ⚠️ |
| **Calibrated confidence + low-confidence flag** | ✅ + audit flags | ❌ | ❌ | ❌ |
| **Narrative timeline of an event** | ✅ `/timeline` | ❌ | ❌ | ❌ |
| **Manipulation / persuasion-tactic analysis** | ✅ with exact quotes | ⚠️ if asked | ⚠️ | ❌ |
| **AI-vs-human authorship signal** | ✅ | ❌ | ❌ | ❌ |
| **Reproducible verdicts (cached, seeded)** | ✅ claim-hash cache | ❌ | ❌ | ❌ |
| **Open, inspectable verification logic** | ✅ open source | ❌ | ❌ | ❌ |
| Live web retrieval | ✅ | ⚠️ (browsing) | ✅ | ✅ |
| General conversational ability | ⚠️ narrow | ✅ | ✅ | ✅ |
| Breadth of world knowledge | ⚠️ | ✅ | ✅ | ✅ |

**Reading:** the general tools win on breadth and fluency. GKIN wins on every axis that
matters for *trustworthy verification* — traceability, source weighting, consensus-attack
resistance, and honest abstention. That is exactly the gap the midterm feedback identified.

---

## 3. The runnable head-to-head benchmark

[`benchmark/run_verification_benchmark.py`](../benchmark/run_verification_benchmark.py) scores
each system as **a fact-checker with an "I don't know" option** over a labeled claim set
([`benchmark/verification_claims.json`](../benchmark/verification_claims.json) — true / false /
unverifiable claims, including post-training-cutoff facts that catch a no-retrieval model
guessing).

### Systems it compares

| System | What it is | Requires |
|---|---|---|
| `gkin` | the agentic loop via `/verify-claims` (grounded + cited) | always |
| `bare_llm` | same Groq model, **no retrieval** (≈ a vanilla chatbot) | `--baseline` |
| `openai` | OpenAI chat model, no tools | `OPENAI_API_KEY` |
| `gemini` | Google Gemini, no tools | `GEMINI_API_KEY` |
| `perplexity` | Perplexity (does its own retrieval) | `PERPLEXITY_API_KEY` |

### Metrics (and why each one matters)

| Metric | Definition | Why it matters |
|---|---|---|
| **coverage** | decided / total | how often the system commits to a verdict |
| **decided_accuracy** | correct / decided | when it commits, is it right? |
| **misleading_rate** | wrong / decided | **the dangerous number** — confidently wrong |
| **correct_abstention** | INSUFFICIENT / total on unverifiable claims | does it know what it can't know? |

> The headline isn't raw accuracy — it's **misleading_rate**. A media-literacy tool that is
> confidently wrong is *worse* than useless. GKIN is engineered to minimize this by abstaining;
> a bare LLM cannot abstain by design, so it is structurally forced to guess on
> post-cutoff/false claims.

### Exact commands

```bash
# 1. Start GKIN with a live search backend + Groq key
export GROQ_API_KEY=...           # required
python server.py                  # serves on :8000

# 2. Get a JWT for the benchmark client
export GKIN_JWT="$(curl -s -XPOST localhost:8000/login \
  -H content-type:application/json \
  -d '{"username":"tester","password":"testpass123"}' \
  | python -c 'import sys,json;print(json.load(sys.stdin)["token"])')"

# 3. (Optional) add competitor keys to compare head-to-head
export OPENAI_API_KEY=...
export GEMINI_API_KEY=...
export PERPLEXITY_API_KEY=...

# 4. Run. --baseline adds the no-retrieval bare-LLM control.
python benchmark/run_verification_benchmark.py --baseline

# → writes benchmark/results/verification_benchmark.json
```

### Results table (to be filled from a live run)

Run the command above and paste the metrics here. **Do not estimate these numbers** — the
whole credibility of the comparison depends on them being real and reproducible (seed=42).

| System | Coverage | Decided accuracy | **Misleading rate** ↓ | Correct abstention |
|---|--:|--:|--:|--:|
| **GKIN** (grounded) | _run_ | _run_ | _run_ | _run_ |
| Bare LLM (no retrieval) | _run_ | _run_ | _run_ | _run_ |
| ChatGPT | _run_ | _run_ | _run_ | _run_ |
| Gemini | _run_ | _run_ | _run_ | _run_ |
| Perplexity | _run_ | _run_ | _run_ | _run_ |

> **Expected story (state as hypothesis until measured):** the bare LLM and general assistants
> will show higher coverage but a non-zero misleading_rate (they guess on false/post-cutoff
> claims); GKIN will show lower coverage but a misleading_rate at or near zero, because it
> abstains rather than bluffs and every committed verdict is grounded. *That trade — committing
> less but being trustworthy when it does — is the product thesis.*

---

## 3b. Automated rubric benchmark (`run_competitor_benchmark.py`)

This is the **fully automated** version of the comparison and the one to show in the
final presentation. It sends the same verification prompts to every provider, scores each
answer on a consistent rubric, and writes a JSON + CSV + Markdown report. It **never
fabricates numbers** — providers with no API key are skipped with a warning, and whatever
is present still runs.

**The 7 scoring categories (each 0–2, total 14):**

| Category | What it measures |
|---|---|
| `factual_correctness` | Does the answer reach the right conclusion (vs. expected facts/stance)? |
| `citation_availability` | Are sources / URLs actually provided? |
| `source_quality` | Are the sources trusted / primary / official / academic? |
| `traceability` | Are claims *linked* to the evidence (not just a bare list)? |
| `timeline_clarity` | Are dated, chronological events present when asked? |
| `uncertainty_handling` | Does it state limits / confidence rather than overclaim? |
| `misinformation_resistance` | Does it push back on false / overstated claims? |

**Two scoring modes:**
- `--mode heuristic` (default): deterministic rule-based scoring (URLs, dates, hedging,
  rejection language, trusted-domain mentions, expected-fact keywords). Reports are labelled
  *heuristic* — it's directional, not ground truth.
- `--mode judge`: adds an **LLM-as-judge** (needs `OPENAI_API_KEY`) on the same rubric, told
  explicitly not to reward confident-but-uncited answers and to give GKIN no special
  treatment. Judge scores are stored **separately** from heuristic ones, never blended.

**Run it:**
```bash
# GKIN must be up (python server.py). Competitor keys are optional.
export OPENAI_API_KEY=...        # optional → adds ChatGPT + enables --mode judge
export GEMINI_API_KEY=...        # optional → adds Gemini
export PERPLEXITY_API_KEY=...    # optional → adds Perplexity
python benchmark/run_competitor_benchmark.py                 # all available, heuristic
python benchmark/run_competitor_benchmark.py --mode judge    # LLM-as-judge
python benchmark/run_competitor_benchmark.py --providers gkin openai perplexity gemini
```

**Output:** `benchmark/results/latest_report.md` (the slide), plus `latest_results.json`
and `latest_results.csv`. See the latest run here:
[`benchmark/results/latest_report.md`](../benchmark/results/latest_report.md).

> GKIN is queried through its own endpoints (`/verify-claims`, `/timeline`); competitors get
> the full natural-language prompt. Both are scored on the identical output rubric, and GKIN
> gets no scoring bonus.

---

## 4. The honest caveat (have this ready for Q&A)

If a competitor's `decided_accuracy` comes out higher than GKIN's, **that is not a loss** —
read it together with coverage and misleading_rate. A system that answers everything and is
right 85% of the time is *more dangerous* for media literacy than one that answers 60% of the
time and is right 98% of the time with a citation you can click. We optimize for **trust per
verdict**, not verdicts per claim.
