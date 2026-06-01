type Level = "yes" | "partial" | "no";

const principles: { term: string; body: string }[] = [
  {
    term: "Grounded citations",
    body: "Every confident verdict is bolted to a verbatim source sentence, re-verified against the live page. The model cannot cite something that isn't really there.",
  },
  {
    term: "Tiered sources",
    body: "A trusted-source tier policy weights credibility. A verdict backed only by unverified sources is downgraded to insufficient — no matter how many agree.",
  },
  {
    term: "Auditable, not a black box",
    body: "Three honest states — supported, contradicted, insufficient — each with clickable, tiered citations. Insufficient is the default when the record is thin.",
  },
];

const cols = ["GKIN", "ChatGPT", "Gemini", "Perplexity"] as const;

const rows: { label: string; cells: Level[] }[] = [
  { label: "Verdict tied to a verbatim source sentence", cells: ["yes", "no", "no", "partial"] },
  { label: "Citations re-verified against page text", cells: ["yes", "no", "no", "no"] },
  { label: "Source-credibility weighting (tiers)", cells: ["yes", "no", "no", "partial"] },
  { label: "Explicit “insufficient evidence” abstention", cells: ["yes", "partial", "partial", "partial"] },
  { label: "Open, inspectable verification logic", cells: ["yes", "no", "no", "no"] },
];

function mark(level: Level) {
  if (level === "yes")
    return (
      <span className="inline-block h-[9px] w-[9px] border-[1.5px] border-supported bg-supported" />
    );
  if (level === "partial")
    return (
      <span className="inline-block h-[9px] w-[9px] border-[1.5px] border-insufficient bg-transparent" />
    );
  return <span className="font-mono text-[12px] text-ink-soft">—</span>;
}

export function Method() {
  return (
    <section id="method" className="border-b-[1.5px] border-ink px-4 pt-[26px] sm:px-[26px]">
      <div className="mb-[18px] flex items-baseline gap-[14px] border-b-[1.5px] border-ink pb-2">
        <span className="font-mono text-[14px] font-semibold tracking-[0.04em] text-navy">
          3.0
        </span>
        <span className="font-slab text-[21px] font-semibold leading-[1.1] tracking-[0.01em] text-ink">
          Method — why it's different
        </span>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft">
          They answer · GKIN proves
        </span>
      </div>

      <p className="mb-[22px] max-w-[64ch] text-[16px] leading-[1.55] text-ink">
        General assistants are broader and more fluent. For the one job that
        matters here — is this claim true, and can you prove it? — GKIN's design
        makes guarantees they don't.
      </p>

      {/* three principles — ruled grid, no floating cards */}
      <div className="grid grid-cols-1 border-l border-t border-rule-soft md:grid-cols-3">
        {principles.map((p) => (
          <div
            key={p.term}
            className="border-b border-r border-rule-soft px-4 py-[14px]"
          >
            <div className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-navy">
              {p.term}
            </div>
            <p className="text-[14px] leading-[1.5] text-ink-soft">{p.body}</p>
          </div>
        ))}
      </div>

      {/* midterm critique — quoted, then rebuilt */}
      <div className="mt-6 border-[1.5px] border-ink">
        <div className="border-b border-rule-soft bg-paper-2 px-4 py-3">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-navy">
            From midterm review
          </div>
          <blockquote className="border-l-[3px] border-navy pl-3 text-[15px] italic leading-[1.5] text-ink-soft">
            “How do you verify the information is true? Using multiple sources
            isn't enough — bad actors can seed or position multiple sources to
            manufacture a consensus.”
          </blockquote>
        </div>
        <div className="px-4 py-3">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-navy">
            What we rebuilt
          </div>
          <p className="text-[14.5px] leading-[1.55] text-ink">
            Grounding is now enforced by construction, not by prompt: an
            ungrounded verdict is impossible to build. Manufactured consensus
            can't clear the bar, because tier weighting downgrades unverified
            agreement to <b className="font-semibold">insufficient</b>. And when
            the record is silent, GKIN says so instead of bluffing — abstention
            is a feature.
          </p>
        </div>
      </div>

      {/* capability comparison — ruled table */}
      <div className="mb-2 mt-6 border-[1.5px] border-ink">
        <div
          className="grid grid-cols-[1.6fr_repeat(4,1fr)] bg-navy text-paper"
          aria-hidden="false"
        >
          <div className="border-r border-paper/25 px-[14px] py-[9px] font-mono text-[10px] uppercase tracking-[0.14em]">
            Capability
          </div>
          {cols.map((c, i) => (
            <div
              key={c}
              className={[
                "px-2 py-[9px] text-center font-mono text-[11px] uppercase tracking-[0.1em]",
                i < cols.length - 1 ? "border-r border-paper/25" : "",
              ].join(" ")}
            >
              {c}
            </div>
          ))}
        </div>
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-[1.6fr_repeat(4,1fr)] border-t border-rule-soft"
          >
            <div className="border-r border-rule-soft px-[14px] py-[11px] text-[13.5px] leading-snug text-ink">
              {row.label}
            </div>
            {row.cells.map((lvl, ci) => (
              <div
                key={ci}
                className={[
                  "flex items-center justify-center py-[11px]",
                  ci < row.cells.length - 1 ? "border-r border-rule-soft" : "",
                  ci === 0 ? "bg-paper-2" : "",
                ].join(" ")}
              >
                {mark(lvl)}
              </div>
            ))}
          </div>
        ))}
      </div>

      <p className="pb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft">
        Filled square · built-in &nbsp; Hollow square · partial &nbsp; Dash · not
        available
      </p>
    </section>
  );
}
