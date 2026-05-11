import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Plus } from "lucide-react";

const FAQS = [
  {
    q: "99.4% accuracy sounds too good. Is it?",
    a: "Yes and no. On the held-out WELFake test set, DistilBERT-base hits 99.4% after we strip source fingerprints (Reuters datelines, Getty photo credits, partisan blog tells). But WELFake has structural leakage — same publishers in train and test — so the model is partly learning 'wire-service style vs amateur-blog style.' We documented it. Shuffle-ablation drops accuracy to 56%, which proves the model uses word order rather than keyword tells, but a lede-only ablation still hits 94%, meaning publisher style in the first 25 words carries real signal. Defensible framing: GKIN reads, but won't catch professional-style disinfo (RT, Sputnik) without more training.",
  },
  {
    q: "What's the difference between the classifier and the LLM pipeline?",
    a: "They run side-by-side and answer different questions. The DistilBERT classifier returns a single fake-vs-real label trained on WELFake. The LLM pipeline (DeepSeek R1 + Llama 3.3 + Llama 8B) returns a manipulation index, the persuasion techniques used, and the claim-level verifications. The classifier is fast and frozen; the LLM pipeline is reasoning, citing, and inspectable.",
  },
  {
    q: "How do you verify claims against the live web?",
    a: "Llama 8B drafts a search query for each factual claim, those queries run in parallel (semaphore-limited to 4 at a time), and the results get fed back to the model with the original claim to judge TRUE / FALSE / UNVERIFIED. Citations are surfaced inline. If sources contradict each other, the verdict reflects the majority and surfaces the conflict.",
  },
  {
    q: "Will this work on a tweet screenshot?",
    a: "Yes — Llama-3.2-Vision-90B reads the image, extracts the text, and the rest of the pipeline runs as if you pasted that text directly. Same techniques, same claim checks, same manipulation index.",
  },
  {
    q: "What about bias? Will GKIN flag one side more than the other?",
    a: "The training corpus skews toward US English-language outlets and the WELFake split correlates 'fake' with a small set of partisan blogs, so the classifier inherits that distribution. The LLM pipeline is more politically neutral because it judges techniques (loaded language, false consensus) rather than positions — but it's still using a frontier model with its own biases. The comparison view exists specifically to make framing differences visible across outlets.",
  },
  {
    q: "Is this open source? Can I run it myself?",
    a: "The frontend, the FastAPI server, and the training pipeline are all in the repo. The Groq API key is the one thing you'd need to provide. The DistilBERT classifier is trained on the GPU box (96GB VRAM) and the checkpoint loads on first request.",
  },
];

function FAQItem({
  item,
  open,
  onClick,
}: {
  item: (typeof FAQS)[number];
  open: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={`rounded-xl border bg-gradient-to-b transition-colors ${
        open
          ? "border-white/[0.14] from-white/[0.03] to-transparent"
          : "border-white/[0.07] from-white/[0.015] to-transparent hover:border-white/[0.12]"
      }`}
    >
      <button
        onClick={onClick}
        className="w-full flex items-start justify-between gap-4 text-left px-5 py-4 group"
      >
        <span className="text-[15.5px] font-semibold tracking-tight text-ink group-hover:text-white">
          {item.q}
        </span>
        <span
          className={`mt-1 shrink-0 w-7 h-7 rounded-full border border-white/[0.14] bg-white/[0.04] inline-flex items-center justify-center transition-transform ${
            open ? "rotate-45" : "rotate-0"
          }`}
        >
          <Plus className="w-3.5 h-3.5 text-ink-2" strokeWidth={2.2} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.2, 0.7, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-1 text-ink-3 text-[14.5px] leading-relaxed max-w-[62ch]">
              {item.a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="relative z-10 py-28 px-7 max-w-[920px] mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.7 }}
        className="text-center mb-12"
      >
        <div className="inline-flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-brand-amber mb-4">
          <span
            className="w-1.5 h-1.5 rounded-full bg-brand-amber"
            style={{ boxShadow: "0 0 8px currentColor" }}
          />
          Honest answers
        </div>
        <h2 className="grad-feature-h font-semibold leading-[1.02] tracking-[-0.028em]" style={{ fontSize: "clamp(30px, 4.6vw, 52px)" }}>
          Questions you should <em className="not-italic grad-feature-em">actually</em> ask.
        </h2>
      </motion.div>
      <div className="space-y-3">
        {FAQS.map((item, i) => (
          <FAQItem
            key={i}
            item={item}
            open={open === i}
            onClick={() => setOpen(open === i ? null : i)}
          />
        ))}
      </div>
    </section>
  );
}
