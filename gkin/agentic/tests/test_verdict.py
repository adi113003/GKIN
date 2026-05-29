"""Stdlib tests for the verdict model + tier policy.

Run: python -m gkin.agentic.tests.test_verdict
"""

from __future__ import annotations

from pydantic import ValidationError

from gkin.agentic.verdict import (
    TIER3_ONLY_CONFIDENCE_CAP,
    EvidenceSpan,
    Verdict,
    VerdictLabel,
    apply_tier_policy,
    insufficient,
)
from gkin.agentic.util import claim_id


def _span(tier=2, trusted=True, name="Reuters"):
    return EvidenceSpan(
        url="https://reuters.com/x",
        sentence="The agency confirmed the figure on Tuesday.",
        title="Report",
        tier=tier,
        tier_name=name,
        trusted=trusted,
        relevance=0.8,
    )


def test_supported_without_evidence_is_unconstructible():
    raised = False
    try:
        Verdict(
            claim_id="claim_x",
            claim_text="X happened",
            label=VerdictLabel.SUPPORTED,
            confidence=0.9,
            evidence=[],
        )
    except ValidationError:
        raised = True
    assert raised, "SUPPORTED with no evidence must raise ValidationError"


def test_contradicted_without_evidence_is_unconstructible():
    raised = False
    try:
        Verdict(
            claim_id="claim_x",
            claim_text="X happened",
            label=VerdictLabel.CONTRADICTED,
            confidence=0.9,
            evidence=[],
        )
    except ValidationError:
        raised = True
    assert raised


def test_supported_with_evidence_is_valid():
    v = Verdict(
        claim_id=claim_id("X happened"),
        claim_text="X happened",
        label=VerdictLabel.SUPPORTED,
        confidence=0.9,
        evidence=[_span()],
    )
    assert v.label == VerdictLabel.SUPPORTED
    assert len(v.evidence) == 1


def test_insufficient_allowed_with_no_evidence():
    v = insufficient("Murky claim")
    assert v.label == VerdictLabel.INSUFFICIENT
    assert v.evidence == []
    assert v.confidence == 0.0


def test_evidence_span_requires_sentence():
    raised = False
    try:
        EvidenceSpan(url="https://x.com", sentence="   ")
    except ValidationError:
        raised = True
    assert raised, "blank sentence must raise"


def test_evidence_span_requires_url():
    raised = False
    try:
        EvidenceSpan(url="", sentence="A real sentence.")
    except ValidationError:
        raised = True
    assert raised


def test_tier_policy_keeps_tier2_verdict():
    v = Verdict(
        claim_id="c", claim_text="c", label=VerdictLabel.SUPPORTED,
        confidence=0.9, evidence=[_span(tier=2)],
    )
    out = apply_tier_policy(v)
    assert out.label == VerdictLabel.SUPPORTED
    assert out.confidence == 0.9
    assert out.low_confidence is False


def test_tier_policy_flags_tier3_only():
    v = Verdict(
        claim_id="c", claim_text="c", label=VerdictLabel.SUPPORTED,
        confidence=0.95,
        evidence=[_span(tier=3, name="Snopes")],
    )
    out = apply_tier_policy(v)
    assert out.label == VerdictLabel.SUPPORTED
    assert out.low_confidence is True
    assert out.confidence <= TIER3_ONLY_CONFIDENCE_CAP
    assert "only_tier3_factchecker_sources" in out.flags


def test_tier_policy_downgrades_unverified_only():
    v = Verdict(
        claim_id="c", claim_text="c", label=VerdictLabel.CONTRADICTED,
        confidence=0.8,
        evidence=[_span(tier=0, trusted=False, name="randomblog.com")],
    )
    out = apply_tier_policy(v)
    assert out.label == VerdictLabel.INSUFFICIENT
    assert "downgraded_unverified_sources_only" in out.flags
    # Evidence is preserved on the downgraded verdict for the audit trail.
    assert len(out.evidence) == 1


def test_tier_policy_mixed_tier3_and_tier1_keeps_strong():
    v = Verdict(
        claim_id="c", claim_text="c", label=VerdictLabel.SUPPORTED,
        confidence=0.9,
        evidence=[_span(tier=3, name="PolitiFact"), _span(tier=1, name="CDC")],
    )
    out = apply_tier_policy(v)
    assert out.confidence == 0.9
    assert out.low_confidence is False


def test_tier_policy_noop_on_insufficient():
    v = insufficient("c")
    assert apply_tier_policy(v) is v


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
