// The models actually called by server.py (MODEL_* constants). No DistilBERT —
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
    <section className="border-b-[1.5px] border-ink px-4 py-[34px] sm:px-[26px]">
      <div className="grid grid-cols-1 md:grid-cols-[1.45fr_1fr]">
        {/* main column */}
        <div className="border-b-[1.5px] border-ink pb-[22px] md:border-b-0 md:pb-0 md:pr-[34px]">
          <div className="mb-[14px] border-b border-rule-soft pb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-navy">
            1.0 — On reading the record before repeating it
          </div>

          <h1
            className="mb-[18px] max-w-[18ch] font-slab font-bold leading-[1.04] tracking-[-0.005em] text-ink"
            style={{ fontSize: "clamp(32px, 5vw, 42px)" }}
          >
            Don't trust the take.{" "}
            <em className="not-italic text-navy underline decoration-2 underline-offset-[4px]">
              Check the record
            </em>
            , sentence by sentence.
          </h1>

          <p className="mb-[22px] max-w-[54ch] text-[18px] leading-[1.6] text-ink">
            Paste an article, a URL, a screenshot, or a podcast. GKIN scores
            manipulation, names every persuasion technique, and ties every
            verdict to the exact source sentence that backs it —{" "}
            <b className="font-semibold">or tells you it can't</b>. Auditable,
            not a black box.
          </p>

          {/* action buttons — joined, ruled, square */}
          <div className="mb-6 flex w-fit flex-wrap border-[1.5px] border-ink">
            <a
              href="/login"
              className="inline-flex cursor-pointer items-center gap-[10px] bg-navy px-[22px] py-[13px] font-mono text-[12px] font-semibold uppercase tracking-[0.1em] text-paper no-underline hover:bg-ink"
            >
              Analyze an article <span aria-hidden="true">→</span>
            </a>
            <a
              href="#how"
              className="inline-flex cursor-pointer items-center border-l-[1.5px] border-ink bg-paper px-[22px] py-[13px] font-mono text-[12px] uppercase tracking-[0.1em] text-ink no-underline hover:bg-paper-2"
            >
              See how it works
            </a>
          </div>

          {/* reasoning stack line */}
          <div className="max-w-[58ch] border-t border-rule-soft pt-[14px] font-mono text-[11px] leading-[1.9] text-ink-soft">
            <span className="mb-[6px] block text-[10px] uppercase tracking-[0.14em] text-navy">
              Reasoning stack on file
            </span>
            {stack.map((s, i) => (
              <span key={s}>
                <span className="whitespace-nowrap border-b border-rule-soft">
                  {s}
                </span>
                {i < stack.length - 1 && (
                  <span className="px-1 text-rule-soft">/</span>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* aside — Exhibit A verdict preview */}
        <aside className="md:border-l-[1.5px] md:border-ink md:pl-[26px]">
          <div className="mb-[10px] mt-[22px] font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft md:mt-0">
            Exhibit A — verdict preview
          </div>
          <div className="border-[1.5px] border-ink bg-paper">
            <div className="flex items-center justify-between border-b-[1.5px] border-ink bg-paper-2 px-3 py-[9px]">
              <span className="inline-flex items-center gap-[7px] font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-contradicted">
                <span
                  aria-hidden="true"
                  className="inline-block h-[9px] w-[9px] border-[1.5px] border-contradicted bg-contradicted"
                />
                Contradicted
              </span>
              <span className="font-mono text-[11px] tracking-[0.06em] text-ink-soft">
                CONF 0.88
              </span>
            </div>
            <div className="p-3">
              <p className="mb-3 font-slab text-[16px] font-medium leading-[1.3]">
                "Sanctions caused the energy crisis across Europe."
              </p>
              <blockquote className="border-l-[3px] border-navy py-[7px] pl-3 text-[14.5px] leading-[1.5] text-ink-soft">
                Analysts attribute the price spike primarily to a
                colder-than-average winter and reduced pipeline flows, not to the
                sanctions package.
                <span className="mt-[7px] block font-mono text-[10.5px] uppercase tracking-[0.05em] text-navy">
                  Reuters · 12 Mar 2024 · tier-2 journalism
                </span>
              </blockquote>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
