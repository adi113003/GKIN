import { motion } from "framer-motion";

const DIFFS = [
  { key: "verb_choice", value: '"targets" vs. "reform"' },
  { key: "omitted_fact", value: "4.2% revenue increase" },
  { key: "shared_claim", value: "policy passed with 76% support" },
  { key: "frame", value: "conflict vs. consensus" },
];

export function FeatureCompare() {
  return (
    <section id="compare" className="relative z-10 py-32 px-7 max-w-[1240px] mx-auto">
      <div className="grid md:grid-cols-[1fr_1.1fr] gap-12 md:gap-20 items-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8, ease: [0.2, 0.7, 0.3, 1] }}
        >
          <div className="inline-flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-brand-amber mb-4">
            <span
              className="w-1.5 h-1.5 rounded-full bg-brand-amber"
              style={{ boxShadow: "0 0 8px currentColor" }}
            />
            Side-by-side
          </div>
          <h2 className="grad-feature-h font-semibold leading-[1.02] tracking-[-0.028em] mb-4 max-w-[14ch]" style={{ fontSize: "clamp(30px, 4.6vw, 52px)" }}>
            Diff the <em className="not-italic grad-feature-em">framing</em>, not just the facts.
          </h2>
          <p className="text-ink-3 text-[16.5px] leading-relaxed max-w-[50ch] mb-3.5">
            Two outlets can report the same story and tell very different stories. Drop up to
            four pieces into GKIN and it diffs them — which facts each one omitted, how each one
            chose its verbs, where the emphasis went.
          </p>
          <p className="text-ink-3 text-[16.5px] leading-relaxed max-w-[50ch]">
            You&apos;ll see exactly which outlet leaned which way, and on what.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.9, delay: 0.15, ease: [0.2, 0.7, 0.3, 1] }}
        >
          <div
            className="relative rounded-xl p-[1px] shadow-[0_20px_50px_-15px_rgba(0,0,0,0.7),0_30px_80px_-30px_rgba(255,181,71,0.16)]"
            style={{
              background:
                "linear-gradient(160deg, rgba(255,255,255,0.14), rgba(255,181,71,0.16) 100%)",
            }}
          >
            <div className="rounded-[11px] bg-[#0c0c0f] px-6 py-6">
              <div className="grid grid-cols-2 gap-2.5 mb-3.5">
                <OutletCol
                  src="Outlet A · LEFT"
                  headline='"Policy targets small businesses, critics warn"'
                  mi={68}
                />
                <OutletCol
                  src="Outlet B · RIGHT"
                  headline='"New economic reform passes overwhelming vote"'
                  mi={41}
                />
              </div>
              {DIFFS.map((d, i) => (
                <motion.div
                  key={d.key}
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.5 }}
                  transition={{ delay: 0.2 + i * 0.07, duration: 0.4 }}
                  className="font-mono text-[10.5px] px-3 py-2 mt-1 border border-white/[0.07] rounded-lg bg-[rgba(155,123,255,0.04)] text-ink-3"
                >
                  <span className="text-brand-violet">{d.key}:</span> {d.value}
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function OutletCol({
  src,
  headline,
  mi,
}: {
  src: string;
  headline: string;
  mi: number;
}) {
  return (
    <div className="px-3.5 py-3 bg-white/[0.025] border border-white/[0.07] rounded-lg">
      <div className="font-mono text-[9.5px] tracking-[0.12em] text-ink-4 uppercase mb-1.5">
        {src}
      </div>
      <div className="text-[12px] font-semibold leading-snug tracking-tight mb-2.5 min-h-[32px]">
        {headline}
      </div>
      <div className="flex items-center gap-2 font-mono text-[11px] text-ink-3">
        <span>MI</span>
        <span className="flex-1 h-[3px] rounded-sm bg-white/[0.06] relative overflow-hidden">
          <motion.i
            initial={{ width: 0 }}
            whileInView={{ width: `${mi}%` }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 1.2, ease: [0.2, 0.7, 0.3, 1] }}
            className="absolute left-0 top-0 bottom-0 block"
            style={{
              background:
                "linear-gradient(90deg, #4ade80, #ffb547, #ff5d63)",
            }}
          />
        </span>
        <span className="font-bold text-[13px] text-white">{mi}</span>
      </div>
    </div>
  );
}
