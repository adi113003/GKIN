# Block 5 Fact-Checking Spec

## Retrieval Order

1. Query Google Fact Check Tools first when `GOOGLE_FACT_CHECK_API_KEY` is set.
2. If Google returns no usable evidence, query Brave Search when `BRAVE_SEARCH_API_KEY` is set.
3. If neither search provider returns at least two usable results, return `insufficient`.

## Cache

- Key: `sha256(claim_text.strip().lower())`.
- Location: `.gkin_cache/verification_cache.json`.
- TTL: 30 days.
- Cached entries return the full verdict object unless `force_refresh=true`.

## Insufficient Evidence

Return `verdict: "insufficient"`, `confidence: 0`, and `evidence: []` when:

- Fewer than two relevant search results are available.
- Search providers are not configured.
- The grounding model cannot directly verify the claim from retrieved snippets.
- The grounding response fails validation or does not cite retrieved URLs.

The verifier must not use model training knowledge as a fallback.

## Return Shape

```json
{
  "claim_id": "claim_...",
  "claim_text": "...",
  "verdict": "supported | contradicted | insufficient",
  "confidence": 0.0,
  "evidence": [
    {
      "url": "https://...",
      "title": "...",
      "snippet": "...",
      "source_type": "fact_check | news | primary | wiki",
      "relevance": 0.0
    }
  ],
  "reasoning": "One paragraph explaining the verdict, citing the evidence by URL.",
  "verified_at": "2026-04-29T14:32:00Z"
}
```

