// The models actually called by server.py (MODEL_* constants). No DistilBERT;
// it is not deployed; the WELFake classifier is advisory-only, not in the verdict.
const stack = [
  "GPT-OSS 120B",
  "Llama 3.3 70B",
  "Llama 3.1 8B",
  "Llama Vision 90B",
  "Whisper v3",
];

export function Hero() {
  return (
    <section className="bg-white px-4 py-16 sm:px-6">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 md:grid-cols-[1.4fr_1fr] md:gap-16">
        {/* main column */}
        <div>
          <h1
            className="mb-5 max-w-[20ch] font-semibold leading-[1.05] tracking-tight text-ink"
            style={{ fontSize: "clamp(36px, 5vw, 52px)" }}
          >
            Don't trust the take.{" "}
            <span className="text-rausch">Check the record</span>, sentence by
            sentence.
          </h1>

          <p className="mb-8 max-w-[54ch] text-[18px] leading-[1.6] text-ink-soft">
            Paste an article, a URL, a screenshot, or a podcast. GKIN scores
            manipulation, names every persuasion technique, and ties every
            verdict to the exact source sentence that backs it,{" "}
            <b className="font-semibold text-ink">or tells you it can't</b>.
            Auditable, not a black box.
          </p>

          {/* action buttons */}
          <div className="mb-10 flex flex-wrap items-center gap-3">
            <a
              href="/login"
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-rausch px-6 py-3 font-semibold text-white no-underline transition-colors hover:bg-rausch-active"
            >
              Analyze an article <span aria-hidden="true">→</span>
            </a>
            <a
              href="#how"
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-hairline px-6 py-3 font-medium text-ink no-underline transition-colors hover:bg-surface-soft"
            >
              See how it works <span aria-hidden="true">→</span>
            </a>
          </div>

          {/* reasoning stack line */}
          <div className="max-w-[58ch]">
            <div className="mb-3 text-sm font-medium text-muted">
              Reasoning stack
            </div>
            <div className="flex flex-wrap gap-2">
              {stack.map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-surface-soft px-3 py-1 text-sm text-ink-soft"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* aside: Exhibit A verdict preview */}
        <aside>
          <div className="mb-3 text-sm font-medium text-muted">
            Exhibit A · verdict preview
          </div>
          <div className="rounded-card border border-hairline-soft bg-white p-6 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <span className="inline-flex items-center gap-2 font-semibold text-contradicted">
                <span
                  aria-hidden="true"
                  className="inline-block h-2.5 w-2.5 rounded-full bg-contradicted"
                />
                Contradicted
              </span>
              <span className="text-sm text-ink-soft">Confidence 0.88</span>
            </div>

            <p className="mb-4 text-[16px] font-medium leading-snug text-ink">
              "Sanctions caused the energy crisis across Europe."
            </p>

            <blockquote className="rounded-r-lg border-l-[3px] border-rausch bg-surface-soft py-3 pl-4 pr-3 text-[14.5px] leading-[1.5] text-ink-soft">
              Analysts attribute the price spike primarily to a
              colder-than-average winter and reduced pipeline flows, not to the
              sanctions package.
              <span className="mt-2 block text-sm text-muted">
                Reuters · 12 Mar 2024 · tier-2 journalism
              </span>
            </blockquote>
          </div>
        </aside>
      </div>
    </section>
  );
}
