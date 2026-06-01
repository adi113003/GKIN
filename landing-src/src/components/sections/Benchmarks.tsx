const stats = [
  {
    value: "100%",
    label: "Confident verdicts cite a source",
    detail: "grounding enforced by construction",
  },
  {
    value: "60+",
    label: "Trusted sources, tiered",
    detail: "gov · academic · press · fact-check",
  },
  {
    value: "3",
    label: "Verdict states",
    detail: "supported · contradicted · insufficient",
  },
  {
    value: "5",
    label: "Input modalities",
    detail: "text · url · image · audio · video",
  },
];

export function Benchmarks() {
  return (
    <section id="bench" className="border-b-[1.5px] border-ink px-4 pt-[26px] sm:px-[26px]">
      <div className="mb-[18px] flex items-baseline gap-[14px] border-b-[1.5px] border-ink pb-2">
        <span className="font-mono text-[14px] font-semibold tracking-[0.04em] text-navy">
          4.0
        </span>
        <span className="font-slab text-[21px] font-semibold leading-[1.1] tracking-[0.01em] text-ink">
          Benchmarks
        </span>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft">
          Measured · neutral rubric
        </span>
      </div>

      <div className="grid grid-cols-2 border-l border-t border-rule-soft md:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="border-b border-r border-rule-soft px-4 py-[18px]"
          >
            <div className="mb-2 font-slab text-[36px] font-bold leading-none text-ink">
              {s.value}
            </div>
            <div className="mb-1 text-[13.5px] font-semibold leading-snug text-ink">
              {s.label}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-soft">
              {s.detail}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-2 mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-rule-soft pt-3 font-mono text-[11px] text-ink-soft">
        <span className="uppercase tracking-[0.14em] text-navy">
          Automated benchmark
        </span>
        <span>
          GKIN <b className="font-semibold text-ink">7.8</b> vs. ChatGPT 7.0 / 14
          on a neutral rubric. ChatGPT scores{" "}
          <b className="font-semibold text-contradicted">0</b> on
          live-verification prompts; GKIN answers them with cited evidence.
        </span>
      </div>
    </section>
  );
}
