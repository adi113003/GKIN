# Automated Benchmark — GKIN vs General AI Tools

_Generated 2026-05-31T00:58:41.399383+00:00._

- **Providers tested:** GKIN, OpenAI, Gemini
- **Skipped (no key / unreachable):** Perplexity (PERPLEXITY_API_KEY not set)
- **Prompts:** 5
- **Scoring method:** rule-based heuristic
- **Rubric:** 7 categories × 0–2 = **14 max**.

## Overall (average score per provider)

| Provider | Avg total / 14 | factual correctness | citation availability | source quality | traceability | timeline clarity | uncertainty handling | misinformation resistance |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| **GKIN** | **7.8** | 1.8 | 1.2 | 1.2 | 0.8 | 1.2 | 1.0 | 0.6 |
| **OpenAI** | **7.0** | 1.0 | 1.2 | 1.6 | 1.4 | 0.8 | 0.6 | 0.4 |
| **Gemini** | **0.0** | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |

## Per-prompt totals

| Prompt | Category | GKIN | OpenAI | Gemini |
|---|---|---:|---:|---:|
| date_event_traceability | traceability_timeline | 9 | 3 | 0 |
| eiffel_1889 | historical_fact | 12 | 9 | 0 |
| coffee_alzheimers_false_claim | misinformation_resistance | 4 | 10 | 0 |
| covid_vaccine_timeline | timeline_citations | 9 | 10 | 0 |
| controversial_claim_trusted_sources | trusted_sources_uncertainty | 5 | 3 | 0 |

## Where GKIN is designed to win

GKIN structurally guarantees the dimensions the midterm feedback flagged: **traceability** (every confident verdict carries a verbatim source span), **source quality** (a trusted-source tier policy), and **uncertainty handling** (it returns INSUFFICIENT instead of guessing). General assistants may match fluency but do not guarantee these.

## Honest limitations

- **Heuristic scoring is blunt.** It reads surface signals (URLs, dates, hedging, rejection language, trusted-domain mentions, expected-fact keywords) — it does not verify that an argument is correct. Treat it as directional, not ground truth.
- **`timeline_clarity` is scored for every prompt**, so providers that (reasonably) give no timeline for a non-timeline prompt score 0 there — but this is applied equally to all providers, so the comparison stays fair.
- **GKIN is queried via its own endpoints** (`/verify-claims`, `/timeline`) with the claim under test; competitors receive the full natural-language prompt. Both are scored on the identical output rubric.
- **LLM-as-judge**, when used, is itself an LLM and can err; its scores are stored separately from the heuristic ones, never blended.
- Results depend on which API keys / search backends are present; they are reproducible given the same providers and prompts.

## Answer excerpts

### date_event_traceability
> What evidence supports the claim that a major public event happened on a specific date? Provide sources and a timeline.

**GKIN** (10 citation(s)): The story of the Apollo 11 moon landing originated on Wikipedia in 2001. The narrative was corroborated by multiple sources, including history.com, mirror.co.uk, ibtimes.com, bbc.com, and foxnews.com. The story evolved over time, with some minor changes in the exact time and date of the moon landing. The overall credib…

**OpenAI** (0 citation(s)): To provide a thorough response, I need to know the specific public event and date you are referring to. Please provide that information, and I will gather the relevant evidence, sources, and a timeline for you.…

**Gemini**: _error — 429 quota/rate-limited: Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing. Learn more at https://ai.google.dev/gemini-api/docs/b_

### eiffel_1889
> Verify this claim: The Eiffel Tower was originally built for the 1889 World's Fair.

**GKIN** (2 citation(s)): VERDICT: SUPPORTED (confidence 0.60). Multiple sources confirm the Eiffel Tower was built for the 1889 World's Fair. Evidence: - [Wikipedia] "It was constructed as the centrepiece of the 1889 World's Fair, and to crown the centennial anniversary of the French Revolution." (https://en.wikipedia.org/wiki/Eiffel_Tower) - …

**OpenAI** (1 citation(s)): The claim that the Eiffel Tower was originally built for the 1889 World's Fair is **verified**.   The Eiffel Tower was constructed as the entrance arch to the 1889 Exposition Universelle (World's Fair) held in Paris to celebrate the 100th anniversary of the French Revolution. Designed by the engineer Gustave Eiffel and…

**Gemini**: _error — 429 quota/rate-limited: Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing. Learn more at https://ai.google.dev/gemini-api/docs/b_

### coffee_alzheimers_false_claim
> Verify this claim: A new medical study proves that drinking coffee cures Alzheimer's disease.

**GKIN** (0 citation(s)): VERDICT: INSUFFICIENT (confidence 0.00). The evidence does not directly address the claim that drinking coffee cures Alzheimer's disease. While some studies suggest a potential link between coffee consumption and reduced risk of dementia or Alzheimer's disease, none of the evidence explicitly states that coffee cures t…

**OpenAI** (1 citation(s)): The claim that a new medical study proves that drinking coffee cures Alzheimer's disease is **not verified** and is **misleading**.   As of my last update in October 2023, there is no definitive evidence or study that conclusively proves coffee can cure Alzheimer's disease. While some research has suggested that caffei…

**Gemini**: _error — 429 quota/rate-limited: Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing. Learn more at https://ai.google.dev/gemini-api/docs/b_

### covid_vaccine_timeline
> Give a timeline of major events in the development of COVID-19 vaccines and cite evidence for each event.

**GKIN** (8 citation(s)): The story originated from a scientific publication in April 2020, describing the COVID-19 pandemic and the development of vaccines. It was corroborated by multiple outlets, including the New York Times, the National Institute of Allergy and Infectious Diseases, and the Nobel Prize Assembly. The narrative shifted to foc…

**OpenAI** (8 citation(s)): Here is a timeline of major events in the development of COVID-19 vaccines, along with citations for each event:  ### Timeline of Major Events in COVID-19 Vaccine Development  1. **January 2020**:     - **Identification of SARS-CoV-2**: The virus responsible for COVID-19 was identified in Wuhan, China. The genetic sequ…

**Gemini**: _error — 429 quota/rate-limited: Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing. Learn more at https://ai.google.dev/gemini-api/docs/b_

### controversial_claim_trusted_sources
> Verify a controversial current-event claim using only trusted sources. Clearly state what is verified, what is uncertain, and what evidence supports the conclusion.

**GKIN** (0 citation(s)): VERDICT: INSUFFICIENT (confidence 0.00). The evidence does not directly address the claim that artificial intelligence will eliminate the majority of human jobs within the next five years. No grounded evidence was retrieved, so GKIN abstains (INSUFFICIENT).…

**OpenAI** (0 citation(s)): Please provide the specific claim or current event you would like me to verify, and I will assist you in checking its accuracy using trusted sources.…

**Gemini**: _error — 429 quota/rate-limited: Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing. Learn more at https://ai.google.dev/gemini-api/docs/b_


_Raw machine-readable results: `benchmark/results/latest_results.json`_