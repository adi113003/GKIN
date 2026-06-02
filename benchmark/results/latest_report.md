# Automated Benchmark — GKIN vs General AI Tools

_Generated 2026-05-31T16:01:59.960999+00:00._

- **Providers tested:** GKIN, OpenAI
- **Skipped (no key / unreachable):** Perplexity (PERPLEXITY_API_KEY not set)
- **Prompts:** 5
- **Scoring method:** rule-based heuristic
- **Rubric:** 7 categories × 0–2 = **14 max**.

## Overall (average score per provider)

| Provider | Avg total / 14 | factual correctness | citation availability | source quality | traceability | timeline clarity | uncertainty handling | misinformation resistance |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| **GKIN** | **8.0** | 1.8 | 1.0 | 1.4 | 1.0 | 1.2 | 1.0 | 0.6 |
| **OpenAI** | **7.0** | 1.0 | 1.4 | 1.6 | 1.2 | 0.8 | 0.6 | 0.4 |

## Per-prompt totals

| Prompt | Category | GKIN | OpenAI |
|---|---|---:|---:|
| date_event_traceability | traceability_timeline | 9 | 3 |
| eiffel_1889 | historical_fact | 11 | 9 |
| coffee_alzheimers_false_claim | misinformation_resistance | 6 | 10 |
| covid_vaccine_timeline | timeline_citations | 9 | 10 |
| controversial_claim_trusted_sources | trusted_sources_uncertainty | 5 | 3 |

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

**GKIN** (10 citation(s)): The story of the Apollo 11 Moon landing originated from official NASA sources and historical records, with early reports found on Wikipedia. The narrative was corroborated by multiple sources, including history.com and nasa.gov, with some independent reports providing additional context. The story evolved to include mo…

**OpenAI** (0 citation(s)): To assist you effectively, I need to know which specific event and date you are referring to. Please provide the details of the event you want to verify, and I can then gather evidence and sources to support or refute the claim.…

### eiffel_1889
> Verify this claim: The Eiffel Tower was originally built for the 1889 World's Fair.

**GKIN** (1 citation(s)): VERDICT: SUPPORTED (confidence 0.60). The evidence from Wikipedia directly states that the Eiffel Tower was designed by Gustave Eiffel's company and built for the 1889 Universal Exposition in Paris. Evidence: - [Wikipedia] "He is best known for the Eiffel Tower, designed by his company and built for the 1889 Universal …

**OpenAI** (1 citation(s)): The claim that the Eiffel Tower was originally built for the 1889 World's Fair is **verified**.   The Eiffel Tower was constructed as the entrance arch for the 1889 Exposition Universelle (World's Fair) held in Paris, which celebrated the 100th anniversary of the French Revolution. The tower was designed by the enginee…

### coffee_alzheimers_false_claim
> Verify this claim: A new medical study proves that drinking coffee cures Alzheimer's disease.

**GKIN** (0 citation(s)): VERDICT: INSUFFICIENT (confidence 0.00). The evidence does not directly address the claim that a new medical study proves drinking coffee cures Alzheimer's disease. While some studies suggest a potential link between coffee consumption and reduced risk of cognitive decline or dementia, none of the provided evidence exp…

**OpenAI** (2 citation(s)): The claim that a new medical study proves that drinking coffee cures Alzheimer's disease is **not verified** and is **misleading**.   As of my last update in October 2023, there is no definitive evidence or study that conclusively proves coffee can cure Alzheimer's disease. While some research has suggested that caffei…

### covid_vaccine_timeline
> Give a timeline of major events in the development of COVID-19 vaccines and cite evidence for each event.

**GKIN** (9 citation(s)): The story started with a Coronavirus Vaccine Tracker on nytimes.com in 2020, and evolved to include updates on vaccine development and distribution. The narrative was corroborated by multiple sources, including wikipedia.org and ajmc.com, but also had some mixed and unrelated reports. The overall credibility assessment…

**OpenAI** (9 citation(s)): Here is a timeline of major events in the development of COVID-19 vaccines, along with citations for each event:  ### Timeline of Major Events in COVID-19 Vaccine Development  1. **January 2020**:     - **Identification of the Virus**: The novel coronavirus (SARS-CoV-2) was identified in Wuhan, China. The genetic seque…

### controversial_claim_trusted_sources
> Verify a controversial current-event claim using only trusted sources. Clearly state what is verified, what is uncertain, and what evidence supports the conclusion.

**GKIN** (0 citation(s)): VERDICT: INSUFFICIENT (confidence 0.00). The provided evidence does not directly address the claim that artificial intelligence will eliminate the majority of human jobs within the next five years. No grounded evidence was retrieved, so GKIN abstains (INSUFFICIENT).…

**OpenAI** (0 citation(s)): Please provide the specific claim or current event you would like me to verify, and I will assist you in checking its accuracy using trusted sources.…


_Raw machine-readable results: `benchmark/results/latest_results.json`_