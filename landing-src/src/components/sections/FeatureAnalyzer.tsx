import { motion } from "framer-motion";
import { Check } from "lucide-react";

const SPARK = [18, 32, 24, 52, 40, 68, 58, 84, 76, 96];

const TECHS = [
  { label: "Loaded language", tone: "v" },
  { label: "Anon source", tone: "b" },
  { label: "Appeal to fear", tone: "r" },
  { label: "Consensus", tone: "v" },
  { label: "Catastrophising", tone: "r" },
  { label: "Motive imputation", tone: "b" },
  { label: "False echo", tone: "v" },
] as const;

const TONE = {
  v: "bg-[rgba(155,123,255,0.08)] border-[rgba(155,123,255,0.18)] text-[#c2afff]",
  r: "bg-[rgba(255,93,99,0.08)] border-[rgba(255,93,99,0.22)] text-[#ff8d92]",
  b: "bg-[rgba(75,139,255,0.08)] border-[rgba(75,139,255,0.22)] text-[#8bb5ff]",
};

export function FeatureAnalyzer() {
  return (
    <section id="analyze" className="relative z-10 py-32 px-7 max-w-[1240px] mx-auto">
      <div className="grid md:grid-cols-[1fr_1.1fr] gap-12 md:gap-20 items-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8, ease: [0.2, 0.7, 0.3, 1] }}
        >
          <div className="inline-flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-brand-cyan mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan shadow-[0_0_8px_currentColor]" />
            The analyzer
          </div>
          <h2 className="grad-feature-h font-semibold leading-[1.02] tracking-[-0.028em] mb-4 max-w-[14ch]" style={{ fontSize: "clamp(30px, 4.6vw, 52px)" }}>
            A score, the <em className="not-italic grad-feature-em">techniques</em>, and the receipts.
          </h2>
          <p className="text-ink-3 text-[16.5px] leading-relaxed max-w-[50ch] mb-3.5">
            Every article gets a manipulation index from 0 to 100. Then GKIN names exactly which
            persuasion techniques it found — and points at the line that triggered each one.
          </p>
          <p className="text-ink-3 text-[16.5px] leading-relaxed max-w-[50ch]">
            Loaded verbs. Anonymous attribution. False consensus. Catastrophising. Fourteen
            classes, all located in-text.
          </p>
          <ul className="mt-6 border-t border-white/[0.07]">
            {[
              "DeepSeek R1 chain-of-thought, visible.",
              "Llama 3.3 structures the verdict as JSON.",
              "Every claim hits live web search in parallel.",
            ].map((item) => (
              <li
                key={item}
                className="py-3 border-b border-white/[0.07] grid grid-cols-[18px_1fr] gap-2.5 text-sm text-ink-2"
              >
                <Check className="w-3.5 h-3.5 text-brand-cyan mt-1" strokeWidth={2.4} />
                {item}
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.9, delay: 0.15, ease: [0.2, 0.7, 0.3, 1] }}
        >
          <div
            className="relative rounded-xl p-[1px] shadow-[0_20px_50px_-15px_rgba(0,0,0,0.7),0_30px_80px_-30px_rgba(75,139,255,0.18)]"
            style={{
              background:
                "linear-gradient(160deg, rgba(255,255,255,0.14), rgba(75,139,255,0.18) 100%)",
            }}
          >
            <div className="rounded-[11px] bg-[#0c0c0f] px-6 py-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="grad-meter font-bold leading-none tracking-[-0.04em]" style={{ fontSize: "56px" }}>
                    82
                    <span className="text-lg font-medium text-ink-4">/100</span>
                  </div>
                  <div className="font-mono text-[10.5px] tracking-[0.12em] text-ink-4 uppercase mt-1">
                    manipulation index · severe
                  </div>
                </div>
                <div className="flex items-end gap-[3px] h-[50px]">
                  {SPARK.map((h, i) => (
                    <motion.span
                      key={i}
                      initial={{ height: 0 }}
                      whileInView={{ height: `${h}%` }}
                      viewport={{ once: true, amount: 0.5 }}
                      transition={{ delay: i * 0.04, duration: 0.6 }}
                      className="w-1.5 rounded-sm bg-gradient-to-b from-brand-blue to-brand-violet opacity-85"
                    />
                  ))}
                </div>
              </div>

              <div className="border-t border-white/[0.07] pt-3.5 mb-4">
                <span className="block font-mono text-[10px] tracking-[0.14em] text-ink-4 uppercase mb-2">
                  Techniques · 7
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {TECHS.map((t, i) => (
                    <motion.span
                      key={t.label}
                      initial={{ opacity: 0, scale: 0.9 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true, amount: 0.5 }}
                      transition={{ delay: 0.3 + i * 0.06, duration: 0.35 }}
                      className={`text-[11px] px-2 py-0.5 rounded border ${TONE[t.tone]}`}
                    >
                      {t.label}
                    </motion.span>
                  ))}
                </div>
              </div>

              <div className="border-t border-white/[0.07] pt-3.5">
                <span className="block font-mono text-[10px] tracking-[0.14em] text-ink-4 uppercase mb-2">
                  Claims · 3
                </span>
                <ClaimRow
                  verdict="f"
                  claim={`"the numbers prove it" — contradicted by 3 of 4 sources`}
                  cite="↗ reuters · bls.gov · oecd"
                  first
                />
                <ClaimRow
                  verdict="t"
                  claim="Policy was introduced this quarter"
                  cite="↗ gov.gazette · ap"
                />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function ClaimRow({
  verdict,
  claim,
  cite,
  first,
}: {
  verdict: "t" | "f";
  claim: string;
  cite: string;
  first?: boolean;
}) {
  const tones = {
    t: "bg-[rgba(74,222,128,0.1)] text-brand-green border-[rgba(74,222,128,0.22)]",
    f: "bg-[rgba(255,93,99,0.1)] text-brand-red border-[rgba(255,93,99,0.22)]",
  };
  const text = { t: "TRUE", f: "FALSE" }[verdict];
  return (
    <div
      className={`grid grid-cols-[44px_1fr] gap-2 items-start py-2 text-[12px] text-ink-2 leading-snug ${
        first ? "" : "border-t border-white/[0.07]"
      }`}
    >
      <span className={`font-mono text-[9.5px] font-bold px-1.5 py-0.5 rounded text-center tracking-wider border ${tones[verdict]}`}>
        {text}
      </span>
      <span>
        {claim}
        <br />
        <span className="font-mono text-[9.5px] text-ink-4 mt-0.5 inline-block">{cite}</span>
      </span>
    </div>
  );
}
