"""Verdict data model — grounding made impossible to skip *by construction*.

The whole point of this module is that you cannot build a SUPPORTED or
CONTRADICTED verdict without attaching at least one ``EvidenceSpan`` (a real
URL + the exact sentence that justifies the call). Pydantic validators enforce
this at construction time, so an ungrounded verdict is a ``ValidationError``,
not a code-review note. INSUFFICIENT is the only label allowed to stand on no
evidence.

It also implements the source-tier policy: a SUPPORTED/CONTRADICTED verdict
backed only by weak sources is automatically weakened — only fact-checker
(Tier 3) backing flips on a low-confidence flag and caps confidence; backing
from unverified sources alone (Tier 0) is downgraded to INSUFFICIENT, because
you cannot audit a hard verdict against sources the allowlist doesn't trust.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from .util import claim_id, iso_now


class VerdictLabel(str, Enum):
    SUPPORTED = "SUPPORTED"
    CONTRADICTED = "CONTRADICTED"
    INSUFFICIENT = "INSUFFICIENT"


# Confidence ceiling applied when a hard verdict rests only on Tier 3 sources.
TIER3_ONLY_CONFIDENCE_CAP = 0.6


class EvidenceSpan(BaseModel):
    """One justifying piece of evidence: a source URL and the exact sentence(s)
    from that source that bear on the claim. Both are required and non-empty —
    an evidence span with no sentence justifies nothing."""

    url: str
    sentence: str
    title: str = ""
    # Mirrors server._source_tier output so the policy below can reason about trust.
    tier: int = 0
    tier_name: str = "Unverified"
    trusted: bool = False
    relevance: float = Field(default=0.0, ge=0.0, le=1.0)

    @field_validator("url", "sentence")
    @classmethod
    def _non_empty(cls, value: str, info) -> str:
        if not value or not value.strip():
            raise ValueError(f"EvidenceSpan.{info.field_name} must be a non-empty string")
        return value.strip()


class Verdict(BaseModel):
    """An auditable per-claim verdict.

    Invariant (enforced at construction): a SUPPORTED or CONTRADICTED label must
    carry >= 1 EvidenceSpan. There is no way to build a grounded verdict without
    its grounding.
    """

    claim_id: str
    claim_text: str
    label: VerdictLabel
    confidence: float = Field(ge=0.0, le=1.0)
    evidence: list[EvidenceSpan] = Field(default_factory=list)
    reasoning: str = ""
    # True when the verdict survived but rests on weak (Tier 3-only) sourcing.
    low_confidence: bool = False
    flags: list[str] = Field(default_factory=list)
    # Loop bookkeeping, surfaced for the audit trail.
    iterations: int = 0
    retries: int = 0
    query: str = ""
    verified_at: str = Field(default_factory=iso_now)

    @model_validator(mode="after")
    def _grounding_required(self) -> "Verdict":
        if self.label in (VerdictLabel.SUPPORTED, VerdictLabel.CONTRADICTED) and not self.evidence:
            raise ValueError(
                f"A {self.label.value} verdict requires at least one EvidenceSpan; "
                "ungrounded verdicts are not constructible."
            )
        return self


def insufficient(
    claim_text: str,
    reasoning: str = "Insufficient retrieved evidence to verify this claim.",
    *,
    evidence: Optional[list[EvidenceSpan]] = None,
    flags: Optional[list[str]] = None,
    iterations: int = 0,
    retries: int = 0,
    query: str = "",
) -> Verdict:
    """Build an INSUFFICIENT verdict. This is the only label allowed with no
    evidence, and the safe fallback whenever grounding can't be trusted."""
    return Verdict(
        claim_id=claim_id(claim_text),
        claim_text=claim_text,
        label=VerdictLabel.INSUFFICIENT,
        confidence=0.0,
        evidence=evidence or [],
        reasoning=reasoning,
        flags=flags or [],
        iterations=iterations,
        retries=retries,
        query=query,
    )


def apply_tier_policy(verdict: Verdict) -> Verdict:
    """Weaken or downgrade a hard verdict that rests on weak sourcing.

    Uses the tier field already attached to each EvidenceSpan (populated from
    server._source_tier). Tiers: 1 primary/official, 2 established journalism,
    3 fact-checkers, 0 unverified.

    - Backing includes a Tier 1 or Tier 2 source  -> unchanged.
    - Backing is fact-checkers (Tier 3) only       -> keep label, set
      low_confidence, cap confidence, add a flag.
    - Backing is unverified (Tier 0) only          -> downgrade to INSUFFICIENT.

    INSUFFICIENT verdicts pass through untouched.
    """
    if verdict.label == VerdictLabel.INSUFFICIENT:
        return verdict

    trusted_tiers = {e.tier for e in verdict.evidence if e.trusted}

    # Has at least one strong (primary or journalism) source — trust as-is.
    if trusted_tiers & {1, 2}:
        return verdict

    # Only fact-checker corroboration: usable but explicitly low-confidence.
    if 3 in trusted_tiers:
        capped = min(verdict.confidence, TIER3_ONLY_CONFIDENCE_CAP)
        return verdict.model_copy(
            update={
                "confidence": capped,
                "low_confidence": True,
                "flags": verdict.flags + ["only_tier3_factchecker_sources"],
            }
        )

    # No trusted sources at all — cannot stand as a hard verdict.
    return insufficient(
        verdict.claim_text,
        reasoning=(
            "Downgraded to INSUFFICIENT: the only supporting sources are "
            "unverified (not on the trusted-source allowlist). Original reasoning: "
            + verdict.reasoning
        ),
        evidence=verdict.evidence,
        flags=verdict.flags + ["downgraded_unverified_sources_only"],
        iterations=verdict.iterations,
        retries=verdict.retries,
        query=verdict.query,
    )
