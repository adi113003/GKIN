import { motion } from "framer-motion";
import { Check, Minus, X, GitCompareArrows } from "lucide-react";

/**
 * GKIN vs ChatGPT / Gemini / Perplexity — capability matrix.
 * Directly answers the midterm ask to "compare GKIN against ChatGPT, Gemini, or
 * Perplexity." Values are provable from features today (see
 * docs/COMPETITIVE_COMPARISON.md), not benchmarked accuracy claims.
 */

type Level = "yes" | "partial" | "no";

const COLS = ["GKIN", "ChatGPT", "Gemini", "Perplexity"] as const;

const ROWS: { label: string; cells: Level[] }[] = [
  { label: "Verdict bolted to a verbatim source sentence", cells: ["yes", "no", "no", "partial"] },
  { label: "Citations re-verified against page text", cells: ["yes", "no", "no", "no"] },
  { label: "Source credibility weighting (trusted-source tiers)", cells: ["yes", "no", "no", "partial"] },
  { label: "Resists manufactured consensus (junk → no verdict)", cells: ["yes", "no", "no", "no"] },
  { label: "Explicit “insufficient evidence” abstention", cells: ["yes", "partial", "partial", "partial"] },
  { label: "Narrative timeline of an event", cells: ["yes", "no", "no", "no"] },
  { label: "Manipulation / persuasion-tactic analysis", cells: ["yes", "partial", "partial", "no"] },
  { label: "Open, inspectable verification logic", cells: ["yes", "no", "no", "no"] },
];

function Cell({ level, highlight }: { level: Level; highlight: boolean }) {
  const map = {
    yes: { Icon: Check, color: highlight ? "#34d399" : "#a1a1aa" },
    partial: { Icon: Minus, color: "#fbbf24" },
    no: { Icon: X, color: "#52525b" },
  } as const;
  const { Icon, color } = map[level];
  return (
    <div className="flex items-center justify-center py-3.5">
      <span
        className="w-6 h-6 rounded-full flex items-center justify-center"
        style={{
          background: level === "no" ? "transparent" : `${color}1a`,
          border: level === "no" ? "1px solid rgba(255,255,255,0.06)" : `1px solid ${color}40`,
        }}
      >
        <Icon className="w-3.5 h-3.5" style={{ color }} strokeWidth={2.6} />
      </span>
    </div>
  );
}

export function Comparison() {
  return (
    <section id="compare" className="relative z-10 py-32 px-7 max-w-[1100px] mx-auto scroll-mt-24">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.7 }}
        className="text-center mb-12"
      >
        <div className="inline-flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-brand-cyan mb-4">
          <GitCompareArrows className="w-3.5 h-3.5" />
          GKIN vs. the general assistants
        </div>
        <h2
          className="grad-feature-h font-semibold leading-[1.02] tracking-[-0.028em] mb-4 max-w-[20ch] mx-auto"
          style={{ fontSize: "clamp(30px, 4.6vw, 52px)" }}
        >
          They answer everything.{" "}
          <em className="not-italic grad-feature-em">GKIN proves it.</em>
        </h2>
        <p className="text-ink-3 text-[16.5px] leading-relaxed max-w-[58ch] mx-auto">
          ChatGPT, Gemini, and Perplexity are broader and more fluent. For the one job that
          matters here — <span className="text-ink-2">is this claim true, and can you prove it?</span> —
          GKIN’s design makes guarantees they don’t.
        </p>

        {/* Measured benchmark result (benchmark/run_competitor_benchmark.py, neutral rubric) */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-8 inline-flex flex-col sm:flex-row items-center gap-x-6 gap-y-2 rounded-xl border border-white/[0.1] bg-white/[0.03] px-6 py-3.5"
        >
          <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-brand-cyan">
            Measured · automated benchmark
          </span>
          <span className="text-[14px] text-ink-2">
            <strong className="text-white font-semibold">GKIN 7.8</strong> vs.{" "}
            <span className="text-ink-3">ChatGPT 7.0</span>{" "}
            <span className="text-ink-4 text-[12.5px]">/ 14 on a neutral rubric</span>
          </span>
          <span className="hidden sm:block w-px h-4 bg-white/[0.12]" />
          <span className="text-[13px] text-ink-3">
            ChatGPT scores <strong className="text-brand-rose font-semibold">0</strong> on
            live-verification prompts; GKIN answers them with cited evidence.
          </span>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.8, ease: [0.2, 0.7, 0.3, 1] }}
        className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.025] to-transparent overflow-hidden"
      >
        {/* Header row */}
        <div className="grid grid-cols-[1.6fr_repeat(4,1fr)] items-end border-b border-white/[0.08]">
          <div className="px-5 py-4 font-mono text-[10.5px] tracking-[0.14em] uppercase text-ink-4">
            Capability
          </div>
          {COLS.map((c) => {
            const isGkin = c === "GKIN";
            return (
              <div
                key={c}
                className={`text-center px-2 py-4 text-[13px] font-semibold ${
                  isGkin ? "text-white" : "text-ink-3"
                }`}
                style={
                  isGkin
                    ? { background: "linear-gradient(180deg, rgba(129,140,248,0.16), rgba(129,140,248,0.04))" }
                    : undefined
                }
              >
                {c}
                {isGkin && (
                  <div className="font-mono text-[8.5px] tracking-[0.14em] uppercase text-brand-blue mt-0.5">
                    ours
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Rows */}
        {ROWS.map((row, ri) => (
          <div
            key={row.label}
            className={`grid grid-cols-[1.6fr_repeat(4,1fr)] items-center ${
              ri !== ROWS.length - 1 ? "border-b border-white/[0.05]" : ""
            }`}
          >
            <div className="px-5 py-3.5 text-[13.5px] text-ink-2 leading-snug">{row.label}</div>
            {row.cells.map((lvl, ci) => {
              const isGkin = ci === 0;
              return (
                <div
                  key={ci}
                  style={
                    isGkin
                      ? { background: "linear-gradient(180deg, rgba(129,140,248,0.08), rgba(129,140,248,0.02))" }
                      : undefined
                  }
                >
                  <Cell level={lvl} highlight={isGkin} />
                </div>
              );
            })}
          </div>
        ))}
      </motion.div>

      {/* Legend + honest caveat */}
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-6 font-mono text-[11px] text-ink-4">
        <span className="inline-flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5 text-brand-green" strokeWidth={2.6} /> built-in
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Minus className="w-3.5 h-3.5 text-brand-amber" strokeWidth={2.6} /> partial / not guaranteed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <X className="w-3.5 h-3.5 text-ink-5" strokeWidth={2.6} /> not available
        </span>
      </div>
      <p className="text-center text-[13px] text-ink-4 max-w-[64ch] mx-auto mt-5 leading-relaxed">
        We’re not claiming GKIN is a better chatbot. We optimise for{" "}
        <span className="text-ink-3">trust per verdict</span> — committing less often, but being
        auditable every time we do.
      </p>
    </section>
  );
}
