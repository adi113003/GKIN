"""Stdlib tests for the controller state machine, using fake injected deps.

No network, no Groq: a FakeClient replays scripted JSON completions and
fake search/scrape callables stand in for DuckDuckGo + trafilatura.

Run: python -m gkin.agentic.tests.test_controller
"""

from __future__ import annotations

import asyncio

from gkin.agentic import controller
from gkin.agentic.controller import MAX_ITERATIONS, route, run_claim
from gkin.agentic.nodes import Deps, new_state
from gkin.agentic.verdict import VerdictLabel


# ── Fakes ─────────────────────────────────────────────────────────────────────


class FakeUsage:
    prompt_tokens = 10
    completion_tokens = 5
    total_tokens = 15


class _Msg:
    def __init__(self, content):
        self.message = type("M", (), {"content": content})


class _Resp:
    def __init__(self, content):
        self.choices = [_Msg(content)]
        self.usage = FakeUsage()


class FakeCompletions:
    def __init__(self, client):
        self._client = client

    async def create(self, *, model, messages, **kwargs):
        return _Resp(self._client._next(model, messages))


class FakeClient:
    """Replays canned responses keyed by a simple router over the prompt."""

    def __init__(self, *, extract='{"assertions": ["NASA confirmed water on the Moon in 2020"]}',
                 query="moon water nasa 2020", grounding=None, grounding_seq=None):
        self.chat = type("C", (), {"completions": FakeCompletions(self)})()
        self._extract = extract
        self._query = query
        self._grounding_seq = grounding_seq or ([grounding] if grounding else [])
        self._ground_i = 0
        self.calls = []

    def _next(self, model, messages):
        prompt = messages[-1]["content"]
        self.calls.append((model, prompt[:40]))
        if "atomic factual assertions" in prompt:
            return self._extract
        if "web search query" in prompt:
            return self._query
        if "fact-checker" in prompt or "EVIDENCE:" in prompt:
            g = self._grounding_seq[min(self._ground_i, len(self._grounding_seq) - 1)]
            self._ground_i += 1
            return g
        return "{}"


def make_deps(client, *, search=None, scrape=None, tier=None, **kw):
    def default_search(q, n):
        return [{"title": "NASA", "snippet": "x", "url": "https://nasa.gov/moon"}]

    async def default_scrape(urls):
        return [{"url": u, "title": "NASA report", "text":
                 "NASA confirmed the presence of water on the sunlit surface of the Moon in 2020."}
                for u in urls]

    def default_tier(url):
        if "nasa.gov" in url:
            return {"tier": 1, "name": "NASA (.gov)", "trusted": True}
        if "snopes.com" in url:
            return {"tier": 3, "name": "Snopes", "trusted": True}
        return {"tier": 0, "name": "Unverified", "trusted": False}

    return Deps(
        client=client,
        ddg_search=search or default_search,
        scrape_pages=scrape or default_scrape,
        source_tier=tier or default_tier,
        **kw,
    )


# ── Router (pure) tests ─────────────────────────────────────────────────────


def test_route_order():
    s = new_state("c")
    assert route(s) == "extract"
    s["assertions"] = ["a"]
    assert route(s) == "build_query"
    s["query"] = "q"
    assert route(s) == "retrieve"
    s["evidence"] = [{"url": "u"}]
    assert route(s) == "ground"


def test_route_empty_evidence_retries_then_emits():
    s = new_state("c")
    s["assertions"] = ["a"]; s["query"] = "q"; s["evidence"] = []
    assert route(s) == "reformulate"   # retries=0 < MAX_RETRIES
    s["retries"] = 1
    assert route(s) == "emit"          # retries exhausted


def test_route_done_when_verdict_set():
    s = new_state("c")
    from gkin.agentic.verdict import insufficient
    s["verdict"] = insufficient("c")
    assert route(s) == controller.DONE


# ── Full-loop tests ─────────────────────────────────────────────────────────


def test_supported_happy_path():
    sentence = "NASA confirmed the presence of water on the sunlit surface of the Moon in 2020."
    client = FakeClient(grounding=(
        '{"verdict":"supported","confidence":0.92,'
        '"reasoning":"Evidence directly states it.",'
        f'"citations":[{{"url":"https://nasa.gov/moon","sentence":"{sentence}"}}]}}'
    ))
    deps = make_deps(client)
    v = asyncio.run(run_claim("Water exists on the Moon", deps))
    assert v.label == VerdictLabel.SUPPORTED, v
    assert len(v.evidence) == 1
    assert v.evidence[0].tier == 1
    assert v.low_confidence is False
    assert v.retries == 0


def test_hallucinated_citation_falls_back_to_insufficient():
    # Grounding claims supported but cites a sentence not present in evidence.
    client = FakeClient(grounding=(
        '{"verdict":"supported","confidence":0.95,'
        '"reasoning":"made up",'
        '"citations":[{"url":"https://nasa.gov/moon","sentence":"Aliens built a base on the Moon in 1962."}]}'
    ))
    deps = make_deps(client)
    v = asyncio.run(run_claim("Water exists on the Moon", deps))
    assert v.label == VerdictLabel.INSUFFICIENT, v
    assert v.evidence == []


def test_tier3_only_supported_is_low_confidence():
    sentence = "Snopes rated the claim true based on official records."

    def search(q, n):
        return [{"title": "Snopes", "snippet": "x", "url": "https://snopes.com/x"}]

    async def scrape(urls):
        return [{"url": u, "title": "Snopes", "text": sentence} for u in urls]

    client = FakeClient(grounding=(
        '{"verdict":"supported","confidence":0.9,"reasoning":"fact-check says so",'
        f'"citations":[{{"url":"https://snopes.com/x","sentence":"{sentence}"}}]}}'
    ))
    deps = make_deps(client, search=search, scrape=scrape)
    v = asyncio.run(run_claim("Some claim", deps))
    assert v.label == VerdictLabel.SUPPORTED, v
    assert v.low_confidence is True
    assert v.confidence <= 0.6
    assert "only_tier3_factchecker_sources" in v.flags


def test_unverified_only_downgrades_to_insufficient():
    sentence = "A random blog asserts the claim is true."

    def search(q, n):
        return [{"title": "blog", "snippet": "x", "url": "https://randomblog.example/x"}]

    async def scrape(urls):
        return [{"url": u, "title": "blog", "text": sentence} for u in urls]

    client = FakeClient(grounding=(
        '{"verdict":"supported","confidence":0.8,"reasoning":"blog says so",'
        f'"citations":[{{"url":"https://randomblog.example/x","sentence":"{sentence}"}}]}}'
    ))
    deps = make_deps(client, search=search, scrape=scrape)
    v = asyncio.run(run_claim("Some claim", deps))
    assert v.label == VerdictLabel.INSUFFICIENT, v
    assert "downgraded_unverified_sources_only" in v.flags


def test_retry_then_succeed():
    # First grounding insufficient, second (after reformulate) supported.
    sentence = "NASA confirmed the presence of water on the sunlit surface of the Moon in 2020."
    client = FakeClient(grounding_seq=[
        '{"verdict":"insufficient","confidence":0.2,"reasoning":"unclear","citations":[]}',
        '{"verdict":"supported","confidence":0.9,"reasoning":"clear",'
        f'"citations":[{{"url":"https://nasa.gov/moon","sentence":"{sentence}"}}]}}',
    ])
    deps = make_deps(client)
    v = asyncio.run(run_claim("Water on the Moon", deps))
    assert v.label == VerdictLabel.SUPPORTED, v
    assert v.retries == 1, v.retries
    # build_query ran twice (initial + reformulation).
    assert sum(1 for _, p in client.calls if "web search query" in p or "query" in p) >= 2


def test_retry_exhausted_emits_insufficient():
    client = FakeClient(grounding_seq=[
        '{"verdict":"insufficient","confidence":0.1,"reasoning":"no","citations":[]}',
        '{"verdict":"insufficient","confidence":0.1,"reasoning":"still no","citations":[]}',
    ])
    deps = make_deps(client)
    v = asyncio.run(run_claim("Murky claim", deps))
    assert v.label == VerdictLabel.INSUFFICIENT
    assert v.retries == 1  # retried exactly once


def test_loop_terminates_under_cap():
    client = FakeClient(grounding_seq=[
        '{"verdict":"insufficient","confidence":0.1,"reasoning":"no","citations":[]}',
        '{"verdict":"insufficient","confidence":0.1,"reasoning":"no","citations":[]}',
    ])
    deps = make_deps(client)
    v = asyncio.run(run_claim("c", deps))
    assert v.iterations < MAX_ITERATIONS


def main():
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    failed = 0
    for t in tests:
        try:
            t()
            print(f"  PASS {t.__name__}")
        except Exception as exc:  # noqa: BLE001
            failed += 1
            print(f"  FAIL {t.__name__}: {exc!r}")
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
