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
    body: "Every verdict cites the sentence behind it, or admits the record is silent.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="bg-canvas px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 max-w-2xl">
          <h2 className="text-[28px] font-semibold leading-tight tracking-tight text-ink sm:text-[32px]">
            How it works
          </h2>
          <p className="mt-2 text-[16px] text-ink-soft">Three steps · one source</p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <div
              key={s.n}
              className="rounded-card border border-hairline-soft bg-white p-8"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-rausch/10 text-[16px] font-semibold text-rausch">
                {s.n}
              </span>
              <h4 className="mt-5 text-[18px] font-semibold text-ink">
                {s.title}
              </h4>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
