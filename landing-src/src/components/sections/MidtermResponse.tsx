import { motion } from "framer-motion";
import { ShieldCheck, ArrowRight, Quote } from "lucide-react";

/**
 * "Midterm → Final" — the explicit response to the midterm reviewer's
 * truthfulness critique. This is the highest-value section for the final
 * presentation rubric (Response to Midterm Feedback). Each row: the concern we
 * heard, what we shipped, and why it matters.
 */

type Improvement = {
  concern: string;
  before: string;
  after: string;
  why: string;
  accent: string;
};

const IMPROVEMENTS: Improvement[] = [
  {
    concern: "“How do you verify what GKIN generates is actually true?”",
    before: "An LLM was asked “is this true?” and we trusted its answer — it could hallucinate a citation.",
    after: "Every confident verdict is bolted to a verbatim source sentence we re-verify against the live page. An ungrounded verdict is impossible to construct.",
    why: "The model can no longer cite something that isn’t really on the page.",
    accent: "#818cf8",
  },
  {
    concern: "“Multiple sources isn’t enough — bad actors can seed a fake consensus.”",
    before: "Every source counted equally, so coordinated junk blogs could out-vote a primary source.",
    after: "A trusted-source tier policy weights credibility. A verdict backed only by unverified sources is auto-downgraded to INSUFFICIENT — no matter how many agree.",
    why: "Manufactured consensus can’t clear the bar. Closed by policy, not by prompt.",
    accent: "#38bdf8",
  },
  {
    concern: "“Make information traceable, and know what you can’t verify.”",
    before: "A single verdict with, at best, a generic link list at the bottom of the page.",
    after: "Three auditable states — SUPPORTED · CONTRADICTED · INSUFFICIENT — with clickable, tiered citations. INSUFFICIENT is the honest default when evidence is thin.",
    why: "GKIN says “I don’t know” instead of bluffing — abstention is a feature.",
    accent: "#34d399",
  },
];

export function MidtermResponse() {
  return (
    <section
      id="since-midterm"
      className="relative z-10 py-32 px-7 max-w-[1240px] mx-auto scroll-mt-24"
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.7 }}
        className="text-center mb-14"
      >
        <div className="inline-flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-brand-blue mb-4">
          <ShieldCheck className="w-3.5 h-3.5" />
          Midterm → Final
        </div>
        <h2
          className="grad-feature-h font-semibold leading-[1.02] tracking-[-0.028em] mb-4 max-w-[20ch] mx-auto"
          style={{ fontSize: "clamp(30px, 4.6vw, 52px)" }}
        >
          We heard the hardest question.{" "}
          <em className="not-italic grad-feature-em">Then we rebuilt the answer.</em>
        </h2>
        <p className="text-ink-3 text-[16.5px] leading-relaxed max-w-[58ch] mx-auto">
          At midterm, GKIN could analyse an article — but our reviewer caught a real weakness:
          we couldn’t prove our output was true. Here’s exactly what we changed.
        </p>
      </motion.div>

      {/* The verbatim critique, framed as a quote */}
      <motion.blockquote
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.7 }}
        className="relative max-w-[760px] mx-auto mb-14 rounded-2xl border border-white/[0.09] bg-white/[0.025] px-7 py-6"
      >
        <Quote className="absolute -top-3 left-6 w-6 h-6 text-brand-blue/70" fill="currentColor" />
        <p className="text-ink-2 text-[16px] leading-relaxed italic">
          “How do you verify the information is true? Using multiple sources isn’t enough —
          bad actors can seed or position multiple sources to manufacture a consensus.”
        </p>
        <footer className="mt-3 font-mono text-[11px] tracking-wide text-ink-4 uppercase">
          — Midterm review feedback
        </footer>
      </motion.blockquote>

      {/* Improvement rows: before → after */}
      <div className="space-y-5">
        {IMPROVEMENTS.map((it, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.7, delay: i * 0.08, ease: [0.2, 0.7, 0.3, 1] }}
            className="rounded-2xl p-[1px]"
            style={{
              background: `linear-gradient(160deg, ${it.accent}40, rgba(255,255,255,0.05) 35%, rgba(255,255,255,0.03))`,
            }}
          >
            <div className="rounded-[15px] bg-[#0c0c0f] px-6 py-6 md:px-8 md:py-7">
              {/* concern */}
              <div className="flex items-start gap-3 mb-5">
                <span
                  className="shrink-0 mt-0.5 font-mono text-[10px] font-bold tracking-wider px-2 py-1 rounded-md"
                  style={{
                    color: it.accent,
                    background: `${it.accent}1a`,
                    border: `1px solid ${it.accent}40`,
                  }}
                >
                  CONCERN {String(i + 1).padStart(2, "0")}
                </span>
                <p className="text-ink-2 text-[15px] font-medium leading-snug">
                  {it.concern}
                </p>
              </div>

              {/* before → after */}
              <div className="grid md:grid-cols-[1fr_auto_1fr] gap-4 items-stretch">
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.015] px-4 py-3.5">
                  <div className="font-mono text-[9.5px] tracking-[0.16em] uppercase text-ink-4 mb-1.5">
                    At midterm
                  </div>
                  <p className="text-[13.5px] text-ink-3 leading-relaxed">{it.before}</p>
                </div>

                <div className="hidden md:flex items-center justify-center">
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: `${it.accent}1a`, border: `1px solid ${it.accent}55` }}
                  >
                    <ArrowRight className="w-4 h-4" style={{ color: it.accent }} strokeWidth={2.4} />
                  </span>
                </div>

                <div
                  className="rounded-xl border px-4 py-3.5"
                  style={{
                    borderColor: `${it.accent}33`,
                    background: `${it.accent}0d`,
                  }}
                >
                  <div
                    className="font-mono text-[9.5px] tracking-[0.16em] uppercase mb-1.5"
                    style={{ color: it.accent }}
                  >
                    Now
                  </div>
                  <p className="text-[13.5px] text-ink-2 leading-relaxed">{it.after}</p>
                </div>
              </div>

              {/* why it matters */}
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/[0.06]">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: it.accent, boxShadow: `0 0 8px ${it.accent}` }}
                />
                <p className="text-[13px] text-ink-3">
                  <span className="text-ink-2 font-medium">Why it matters:</span> {it.why}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
