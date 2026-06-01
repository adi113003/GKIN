const steps = [
  {
    n: "01",
    title: "Paste anything",
    body: "Article text, a URL, a screenshot, or a podcast. The intake doesn't care about format.",
  },
  {
    n: "02",
    title: "It checks the record",
    body: "Each claim is isolated and matched against primary sources, ranked by tier.",
  },
  {
    n: "03",
    title: "You see the receipts",
    body: "Every verdict cites the sentence behind it — or admits the record is silent.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="border-b-[1.5px] border-ink px-4 pt-[26px] sm:px-[26px]">
      <div className="mb-[18px] flex items-baseline gap-[14px] border-b-[1.5px] border-ink pb-2">
        <span className="font-mono text-[14px] font-semibold tracking-[0.04em] text-navy">
          2.0
        </span>
        <span className="font-slab text-[21px] font-semibold leading-[1.1] tracking-[0.01em] text-ink">
          How it works
        </span>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft">
          Three steps · one source
        </span>
      </div>

      <div className="grid grid-cols-1 border-t-[1.5px] border-ink md:grid-cols-3">
        {steps.map((s, i) => (
          <div
            key={s.n}
            className={[
              "px-[22px] py-[18px] pb-5",
              i < steps.length - 1
                ? "border-b border-rule-soft md:border-b-0 md:border-r"
                : "",
            ].join(" ")}
          >
            <span className="mb-2 block font-mono text-[13px] font-semibold tracking-[0.05em] text-navy">
              {s.n}
            </span>
            <h4 className="mb-[5px] font-slab text-[17px] font-semibold tracking-[0.01em]">
              {s.title}
            </h4>
            <p className="text-[14px] leading-[1.5] text-ink-soft">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
