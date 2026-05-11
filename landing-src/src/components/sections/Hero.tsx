import { motion } from "framer-motion";
import { ArrowRight, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ProductMockup } from "@/components/sections/ProductMockup";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

const MODELS = [
  { name: "DeepSeek R1", v: "70B", dot: "#5dd9ff" },
  { name: "Llama 3.3", v: "70B", dot: "#9b7bff" },
  { name: "Llama Vision", v: "90B", dot: "#ffb547" },
  { name: "Whisper", v: "large-v3", dot: "#4ade80" },
  { name: "DistilBERT", v: "99.4%", dot: "#ff6b8b" },
];

export function Hero() {
  return (
    <header className="relative z-10 pt-40 pb-20 px-7 max-w-[1240px] mx-auto text-center">
      <motion.a
        {...fadeUp}
        transition={{ duration: 0.7, ease: [0.2, 0.7, 0.3, 1] }}
        href="#proof"
        className="inline-flex items-center gap-2 pl-1.5 pr-3 py-1 mb-8 border border-white/[0.14] bg-white/[0.03] rounded-full text-[12.5px] text-ink-2 hover:border-white/[0.24] hover:bg-white/[0.05] transition-all"
      >
        <span className="font-mono text-[10px] font-semibold tracking-wider px-1.5 py-[3px] rounded-full bg-gradient-to-r from-brand-blue to-brand-violet text-white">
          NEW
        </span>
        <span>DistilBERT classifier hits 99.4% — and we proved it isn&apos;t a fluke.</span>
        <span className="text-ink-3">→</span>
      </motion.a>

      <motion.h1
        {...fadeUp}
        transition={{ duration: 0.8, delay: 0.08, ease: [0.2, 0.7, 0.3, 1] }}
        className="font-semibold leading-[0.98] tracking-[-0.038em] mx-auto mb-6 max-w-[14ch] text-balance"
        style={{ fontSize: "clamp(46px, 8vw, 96px)" }}
      >
        <span className="grad-title">See what&apos;s</span>
        <br />
        <span className="grad-accent">moving you.</span>
      </motion.h1>

      <motion.p
        {...fadeUp}
        transition={{ duration: 0.8, delay: 0.16, ease: [0.2, 0.7, 0.3, 1] }}
        className="text-ink-3 mx-auto mb-10 max-w-[58ch] leading-relaxed"
        style={{ fontSize: "clamp(16px, 1.7vw, 19px)" }}
      >
        Paste an article, URL, screenshot, or podcast. GKIN scores manipulation,
        names every persuasion technique, and verifies{" "}
        <strong className="text-ink-2 font-medium">every factual claim</strong>{" "}
        against the live web — in seconds.
      </motion.p>

      <motion.div
        {...fadeUp}
        transition={{ duration: 0.8, delay: 0.24, ease: [0.2, 0.7, 0.3, 1] }}
        className="flex flex-wrap gap-3 justify-center items-center mb-20"
      >
        <Button variant="primary" size="lg" href="/app">
          Launch GKIN
          <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.4} />
        </Button>
        <Button variant="secondary" size="lg" href="#analyze">
          See it work
          <ArrowDown className="w-3.5 h-3.5" strokeWidth={2.4} />
        </Button>
      </motion.div>

      <ProductMockup />

      {/* Model strip */}
      <div className="pt-16">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center font-mono text-[10.5px] tracking-[0.22em] text-ink-4 uppercase mb-6"
        >
          Reasoning stack
        </motion.div>
        <div className="flex flex-wrap justify-center gap-x-3.5 gap-y-2">
          {MODELS.map((m, i) => (
            <motion.div
              key={m.name}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ delay: i * 0.06, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-2.5 py-1.5 border border-white/[0.07] rounded-lg bg-white/[0.025] text-[13px] text-ink-2 hover:border-white/[0.14] hover:bg-white/[0.045] hover:-translate-y-px transition-all"
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: m.dot, boxShadow: `0 0 8px ${m.dot}` }}
              />
              {m.name}
              <span className="font-mono text-[10.5px] text-ink-4 border-l border-white/[0.14] pl-1.5 ml-1">
                {m.v}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </header>
  );
}
