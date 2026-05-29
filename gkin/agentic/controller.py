"""The controller: an explicit, framework-free state machine.

``route`` is a pure function that looks at the state dict and names the next
node — this is the only place that decides control flow. ``run_claim`` drives
the loop, bounded by a hard iteration cap so it can never spin forever, and the
routing guarantees the verify step (``ground``) is never skipped before a hard
verdict is emitted. Reformulation is allowed at most ``MAX_RETRIES`` times.

This is the discipline LangGraph would impose (typed state, explicit edges,
recursion limit) done by hand to match the project's no-framework stack.
"""

from __future__ import annotations

from . import nodes
from .nodes import Deps, new_state
from .verdict import Verdict, insufficient

# Pipeline is ~5 nodes; one retry adds ~4. Cap leaves headroom but bounds spin.
MAX_ITERATIONS = 12
MAX_RETRIES = 1  # reformulate + re-query at most once, per spec

DONE = "__done__"

NODE_FUNCS = {
    "extract": nodes.extract_assertions,
    "build_query": nodes.build_query,
    "retrieve": nodes.retrieve_evidence,
    "ground": nodes.ground_verdict,
    "reformulate": nodes.reformulate,
    "emit": nodes.emit_verdict,
}


def _retry_or_emit(state: dict) -> str:
    """Evidence is thin or grounding is weak/conflicting: reformulate once if we
    still have a retry left, otherwise emit (which will fall back to INSUFFICIENT)."""
    return "reformulate" if state["retries"] < MAX_RETRIES else "emit"


def route(state: dict) -> str:
    """Pure router. Returns the next node name, or DONE.

    The ordering enforces the invariant that grounding ('ground') runs before
    any hard verdict can be emitted: 'emit' is only reachable either after a
    grounding result exists, or after evidence came back empty (nothing to
    ground) — and in the empty case emit can only produce INSUFFICIENT.
    """
    if state["verdict"] is not None:
        return DONE
    if state["assertions"] is None:
        return "extract"
    if state["query"] is None:
        return "build_query"
    if state["evidence"] is None:
        return "retrieve"

    # Evidence retrieved. Nothing to ground -> thin; retry or give up.
    if len(state["evidence"]) == 0 and state["grounding"] is None:
        return _retry_or_emit(state)

    if state["grounding"] is None:
        return "ground"

    # Grounding done — accept it or retry/emit.
    if nodes.grounding_acceptable(state):
        return "emit"
    return _retry_or_emit(state)


async def run_claim(claim_text: str, deps: Deps) -> Verdict:
    """Run the full loop for one claim and return an auditable Verdict.

    Guaranteed to terminate: every node execution increments the iteration
    counter and the loop stops at MAX_ITERATIONS. If the cap is somehow hit
    before 'emit' set a verdict, we return a safe INSUFFICIENT fallback.
    """
    claim_text = (claim_text or "").strip()
    if not claim_text:
        raise ValueError("claim_text is required")

    state = new_state(claim_text)
    while state["iterations"] < MAX_ITERATIONS:
        nxt = route(state)
        state["route_log"].append(nxt)
        if nxt == DONE:
            break
        state = await NODE_FUNCS[nxt](state, deps)
        state["iterations"] += 1

    if state["verdict"] is None:
        return insufficient(
            claim_text,
            "Verification loop reached its iteration cap without a verdict.",
            iterations=state["iterations"],
            retries=state["retries"],
        )
    # Carry the final loop bookkeeping (counters advance after emit ran).
    return state["verdict"].model_copy(update={
        "iterations": state["iterations"],
        "retries": state["retries"],
    })
