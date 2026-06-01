# GDELT integration (timeline + coverage)

Added a **keyless GDELT DOC 2.0** backend that grounds GKIN's timeline in real,
dated, cross-outlet coverage — directly answering the midterm feedback
("make information traceable: citations + a timeline of events").

## What was added

| File | Change |
|---|---|
| `gkin/agentic/search.py` | `gdelt_search()` (SearchFn backend), `gdelt_timeline()` (dated anchors), `_gdelt_doc/_gdelt_throttle/_gdelt_date_to_iso/_gdelt_query` helpers. Registered in `available()` (`gdelt: True`) and `resolve_backend("gdelt")`. |
| `gkin/agentic/__init__.py` | Exports `gdelt_search`, `gdelt_timeline`. |
| `server.py` `_build_timeline()` | One GDELT call per `/timeline`: prioritizes GDELT's reliably-dated URLs for scraping, **backfills missing dates/hostnames** from GDELT, adds a `gdelt_coverage` summary, and falls back to real GDELT anchors when scraping yields nothing. |

## How it works

- **API:** `https://api.gdeltproject.org/api/v2/doc/doc`, `mode=artlist`, `format=json`. No API key.
- **Why it's good here:** GDELT monitors global news in ~100 languages in near-real-time, and every article comes **with a date (`seendate`) and outlet (`domain`)** — exactly the anchors a claim timeline needs. trafilatura's date extraction is spotty; GDELT's is reliable, so we backfill from it.
- **`gdelt_coverage`** (new field on `/timeline` responses): `{article_count, distinct_outlets, first_seen, last_seen, outlets[], articles[]}` — a real spread/corroboration signal (how broadly and over what window a claim was covered).

## Operational constraints (designed around)

- **Rate limit:** GDELT allows ~**1 request / 5 seconds** (HTTP 429 otherwise). Handled by a module-level throttle + **429 fail-soft to `[]`**. So GDELT is **opt-in** as a search backend and is **deliberately excluded from `auto`** (which fires several searches per analysis and would get throttled). Its main use is the single-call timeline.
- **Fail-soft everywhere:** every GDELT path is wrapped; on rate-limit/network/parse error it returns empty and `/timeline` behaves exactly as before (DDG-only). Nothing GDELT can do breaks the endpoint.

## Honest caveat (state this in the writeup)

GDELT indexes **coverage, not truth** — it tells you *what is being said and by whom*, not whether it's correct (a coordinated campaign can still have high volume). So it lives in the **retrieval + timeline + corroboration** layer. Truth adjudication stays with the grounded-citation verdict (`/verify-claims`) and the source-tier policy. GDELT gives *breadth*; the tier allowlist gives *trust*.

## How to test

GDELT is reachable from the server host (not from some sandboxes). One-shot:

```python
python3 -c "from gkin.agentic.search import gdelt_search; \
import json; print(json.dumps(gdelt_search('Eiffel Tower', 4), indent=2))"
```

Or use it as the agentic search backend: `POST /verify-claims {"claims":[...], "search_backend":"gdelt"}`.
The timeline uses it automatically: `POST /timeline {"article":"..."}` → response now carries `gdelt_coverage`.
