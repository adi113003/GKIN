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
    <section id="bench" className="bg-canvas px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10">
          <h2 className="text-[28px] font-semibold leading-tight tracking-tight text-ink sm:text-[32px]">
            Benchmarks
          </h2>
          <p className="mt-2 text-[15px] text-ink-soft">
            Measured against a neutral rubric.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-card border border-hairline-soft bg-white p-6"
            >
              <div className="mb-3 text-[36px] font-bold leading-none text-ink">
                {s.value}
              </div>
              <div className="mb-1 text-[15px] font-semibold leading-snug text-ink">
                {s.label}
              </div>
              <div className="text-[13px] leading-snug text-ink-soft">
                {s.detail}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
