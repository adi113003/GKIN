"""Provider adapters for the automated competitor benchmark.

Each provider module exposes the same tiny interface so the runner can treat
them uniformly:

    NAME: str                       # display name, e.g. "GKIN"
    KEY: str                        # short id used on the CLI, e.g. "gkin"
    available() -> (bool, str)      # (ready?, reason-if-not)
    query(prompt_obj: dict) -> dict # common result structure (see base.result)

The common result structure returned by every query():

    {
      "provider":  "GKIN",
      "prompt_id": "eiffel_1889",
      "answer":    "<free-text answer the scorer reads>",
      "citations": [ {"url": "...", "tier": 1, "snippet": "..."}, ... ],
      "metadata":  { ... provider-specific ... },
      "error":     null | "message"
    }
"""

from . import gkin_provider, openai_provider, gemini_provider, perplexity_provider

# CLI key -> module. Order is the default run order.
PROVIDERS = {
    gkin_provider.KEY: gkin_provider,
    openai_provider.KEY: openai_provider,
    gemini_provider.KEY: gemini_provider,
    perplexity_provider.KEY: perplexity_provider,
}

__all__ = ["PROVIDERS"]
