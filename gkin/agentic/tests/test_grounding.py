"""Stdlib tests for the grounding gate (nodes._grounded_in_evidence).

Pins the anti-hallucination behaviour, in particular the negation / inversion
guard: a paraphrased citation that flips polarity (inserts or drops a 'not') or
reorders subject and object must be REJECTED, even though it shares most of its
tokens with the source. Only verbatim citations (exact substring after folding
case/punctuation/whitespace) are accepted; everything else -> INSUFFICIENT.

Run: python -m gkin.agentic.tests.test_grounding
"""

from __future__ import annotations

from gkin.agentic.nodes import _grounded_in_evidence


def test_exact_substring_is_grounded():
    ev = "NASA confirmed the presence of water on the sunlit surface of the Moon in 2020."
    assert _grounded_in_evidence(ev, ev) is True


def test_substring_within_longer_evidence_is_grounded():
    ev = ("In a statement, the agency said the committee approved the new budget "
          "after a long debate, and adjourned for the week.")
    cited = "the committee approved the new budget after a long debate"
    assert _grounded_in_evidence(cited, ev) is True


def test_punctuation_and_quote_munging_still_grounded():
    # Trivial quote/comma/case differences must still match (the only thing the
    # old fuzzy fallback was actually needed for).
    ev = 'The court ruled the law is "unconstitutional," officials said.'
    cited = "the court ruled the law is unconstitutional officials said"
    assert _grounded_in_evidence(cited, ev) is True


def test_verbatim_negated_sentence_is_grounded():
    # A negation is fine when the citation is copied verbatim.
    ev = "The study found that the vaccine does not cause the illness."
    assert _grounded_in_evidence(ev, ev) is True


def test_inserted_negation_paraphrase_is_rejected():
    # THE BUG: evidence is positive; the citation inserts 'not' -> opposite
    # meaning, yet shares almost all tokens. The old >=80%-overlap path accepted
    # this; it must now be rejected.
    ev = "The committee approved the new budget after a long and detailed debate."
    inverted = "The committee did not approve the new budget after a detailed debate."
    assert _grounded_in_evidence(inverted, ev) is False


def test_dropped_negation_paraphrase_is_rejected():
    # Evidence is negative; the citation drops the negation -> opposite meaning.
    ev = "Investigators concluded the fire was not caused by the faulty wiring."
    flipped = "Investigators concluded the fire was caused by the faulty wiring."
    assert _grounded_in_evidence(flipped, ev) is False


def test_contraction_negation_requires_verbatim():
    ev = "Officials said the bridge is safe for heavy traffic this winter."
    inverted = "Officials said the bridge isn't safe for heavy traffic this winter."
    assert _grounded_in_evidence(inverted, ev) is False


def test_reordered_subject_object_is_rejected():
    # Bag-of-words overlap is identical; word order changes the meaning.
    ev = "The home team defeated the visitors in the final."
    reordered = "The visitors defeated the home team in the final."
    assert _grounded_in_evidence(reordered, ev) is False


def test_unrelated_sentence_is_rejected():
    ev = "NASA confirmed the presence of water on the Moon in 2020."
    assert _grounded_in_evidence("Aliens built a base on the Moon in 1962.", ev) is False


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
