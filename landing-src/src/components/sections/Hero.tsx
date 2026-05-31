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
    <header className="relative z-10 pt-32 pb-20 px-7 max-w-[1400px] mx-auto">
      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-8 items-center">
        {/* Left Column: Text & CTA */}
        <div className="text-left">
          <motion.a
            {...fadeUp}
            transition={{ duration: 0.7, ease: [0.2, 0.7, 0.3, 1] }}
            href="#since-midterm"
            className="inline-flex items-center gap-2 pl-1.5 pr-3 py-1 mb-8 border border-white/[0.14] bg-white/[0.03] rounded-full text-[12.5px] text-ink-2 hover:border-white/[0.24] hover:bg-white/[0.05] transition-all"
          >
            <span className="font-mono text-[10px] font-semibold tracking-wider px-1.5 py-[3px] rounded-full bg-gradient-to-r from-brand-blue to-brand-violet text-white">
              NEW
            </span>
            <span>Every verdict now cites its source — see what changed.</span>
            <span className="text-ink-3">→</span>
          </motion.a>

          <motion.h1
            {...fadeUp}
            transition={{ duration: 0.8, delay: 0.08, ease: [0.2, 0.7, 0.3, 1] }}
            className="font-semibold leading-[1.05] tracking-[-0.03em] mb-6 text-balance"
            style={{ fontSize: "clamp(40px, 6vw, 76px)" }}
          >
            <span className="text-ink">Cut through the noise.</span>
            <br />
            <span className="grad-accent">Detect the lie.</span>
          </motion.h1>

          <motion.p
            {...fadeUp}
            transition={{ duration: 0.8, delay: 0.16, ease: [0.2, 0.7, 0.3, 1] }}
            className="text-ink-3 mb-10 max-w-[50ch] leading-relaxed"
            style={{ fontSize: "clamp(16px, 1.5vw, 18px)" }}
          >
            Paste an article, URL, screenshot, or podcast. GKIN scores manipulation, names
            every persuasion technique, and ties{" "}
            <strong className="text-ink-2 font-medium">every verdict to the exact source
            sentence</strong>{" "}
            that backs it — or says it can’t verify it. Auditable, not a black box.
          </motion.p>

          <motion.div
            {...fadeUp}
            transition={{ duration: 0.8, delay: 0.24, ease: [0.2, 0.7, 0.3, 1] }}
            className="flex flex-wrap gap-4 items-center mb-16"
          >
            <Button variant="primary" size="lg" href="/login">
              Launch GKIN
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.4} />
            </Button>
            <Button variant="secondary" size="lg" href="#how">
              See it work
              <ArrowDown className="w-3.5 h-3.5" strokeWidth={2.4} />
            </Button>
          </motion.div>

          {/* Model strip */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            <div className="font-mono text-[10.5px] tracking-[0.22em] text-ink-4 uppercase mb-4">
              Reasoning stack
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-2">
              {MODELS.map((m, i) => (
                <div
                  key={m.name}
                  className="inline-flex items-center gap-2 px-2.5 py-1.5 border border-white/[0.07] rounded-lg bg-white/[0.025] text-[12px] text-ink-2"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: m.dot, boxShadow: `0 0 8px ${m.dot}` }}
                  />
                  {m.name}
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Right Column: Product Mockup */}
        <div className="relative w-full max-w-[700px] mx-auto lg:ml-auto perspective-[2000px]">
          <ProductMockup />
        </div>
      </div>
    </header>
  );
}
