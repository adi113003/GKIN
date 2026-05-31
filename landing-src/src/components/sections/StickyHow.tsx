import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import {
  ClipboardPaste,
  Workflow,
  Tag,
  CheckCircle2,
  Gavel,
} from "lucide-react";

type Step = {
  kicker: string;
  title: string;
  body: string;
  icon: typeof ClipboardPaste;
  art: React.ReactNode;
  accent: string;
};

const STEPS: Step[] = [
  {
    kicker: "01 · Paste",
    title: "Drop in anything.",
    body: "Article body, URL, screenshot, podcast clip, YouTube link. GKIN normalises whatever you feed it into a single corpus of claims.",
    icon: ClipboardPaste,
    accent: "#5dd9ff",
    art: (
      <div className="space-y-2">
        {[
          { type: "URL", value: "nytimes.com/2026/05/policy-vote" },
          { type: "TEXT", value: '"The new policy will destroy small businesses…"' },
          { type: "IMG", value: "tweet_screenshot_4221.png" },
          { type: "AUDIO", value: "podcast_clip_14m_22s.mp3" },
        ].map((row, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: false, amount: 0.6 }}
            transition={{ delay: i * 0.06, duration: 0.4 }}
            className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.025] border border-white/[0.07] font-mono text-[11px]"
          >
            <span className="px-1.5 py-0.5 rounded bg-[rgba(93,217,255,0.12)] border border-[rgba(93,217,255,0.25)] text-brand-cyan tracking-wider">
              {row.type}
            </span>
            <span className="text-ink-2 truncate">{row.value}</span>
          </motion.div>
        ))}
      </div>
    ),
  },
  {
    kicker: "02 · Route",
    title: "Each modality finds its specialist.",
    body: "Vision goes to Llama-3.2-Vision-90B. Audio goes to Whisper Large v3. Text fans out across DeepSeek R1, Llama 3.3 and the Llama 8B claim runner — in parallel.",
    icon: Workflow,
    accent: "#9b7bff",
    art: (
      <div className="grid grid-cols-2 gap-2">
        {[
          ["TEXT", "DeepSeek R1", "#5dd9ff"],
          ["TEXT", "Llama 3.3", "#9b7bff"],
          ["IMG", "Vision 90B", "#ffb547"],
          ["AUDIO", "Whisper v3", "#4ade80"],
        ].map(([k, v, c], i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: false, amount: 0.6 }}
            transition={{ delay: i * 0.07, duration: 0.4 }}
            className="px-3 py-2.5 rounded-lg bg-white/[0.025] border border-white/[0.07]"
          >
            <div className="font-mono text-[9.5px] tracking-[0.14em] text-ink-4 mb-1">
              {k}
            </div>
            <div className="flex items-center gap-2">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: c, boxShadow: `0 0 6px ${c}` }}
              />
              <span className="text-[12.5px] font-semibold">{v}</span>
            </div>
          </motion.div>
        ))}
      </div>
    ),
  },
  {
    kicker: "03 · Tag",
    title: "Persuasion techniques get named.",
    body: "Loaded language. Anonymous attribution. False consensus. Catastrophising. Fourteen named classes — each one pinned to the exact line that triggered it.",
    icon: Tag,
    accent: "#ffb547",
    art: (
      <div className="flex flex-wrap gap-1.5">
        {[
          ["Loaded language", "v"],
          ["Anon source", "b"],
          ["Appeal to fear", "r"],
          ["Consensus", "v"],
          ["Catastrophising", "r"],
          ["False echo", "b"],
          ["Motive imputation", "v"],
        ].map(([label, tone], i) => {
          const colors: Record<string, string> = {
            v: "bg-[rgba(155,123,255,0.08)] border-[rgba(155,123,255,0.18)] text-[#c2afff]",
            r: "bg-[rgba(255,93,99,0.08)] border-[rgba(255,93,99,0.22)] text-[#ff8d92]",
            b: "bg-[rgba(75,139,255,0.08)] border-[rgba(75,139,255,0.22)] text-[#8bb5ff]",
          };
          return (
            <motion.span
              key={label}
              initial={{ opacity: 0, y: 6 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.6 }}
              transition={{ delay: i * 0.05, duration: 0.35 }}
              className={`text-[12px] px-2.5 py-1 rounded-md border ${colors[tone as string]}`}
            >
              {label}
            </motion.span>
          );
        })}
      </div>
    ),
  },
  {
    kicker: "04 · Verify",
    title: "Every factual claim hits the live web.",
    body: "Llama 8B drafts claim queries. They fan out in parallel to a search index, get cross-checked, and come back with citations — or with a flag that the claim can't be verified.",
    icon: CheckCircle2,
    accent: "#4ade80",
    art: (
      <div className="space-y-2 font-mono text-[11px]">
        {[
          ["TRUE", "Policy was introduced this quarter", "↗ gov.gazette · ap", "t"],
          ["FALSE", '"the numbers prove it"', "↗ 3 of 4 sources contradict", "f"],
          ["UNVRF", '"sources say" — no attribution', "↗ cannot cross-check", "u"],
        ].map(([badge, claim, cite, tone], i) => {
          const tones: Record<string, string> = {
            t: "bg-[rgba(74,222,128,0.1)] text-brand-green border-[rgba(74,222,128,0.22)]",
            f: "bg-[rgba(255,93,99,0.1)] text-brand-red border-[rgba(255,93,99,0.22)]",
            u: "bg-[rgba(255,181,71,0.1)] text-brand-amber border-[rgba(255,181,71,0.22)]",
          };
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: false, amount: 0.6 }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              className="flex items-start gap-2.5"
            >
              <span
                className={`shrink-0 px-1.5 py-0.5 rounded text-[9.5px] font-bold tracking-wider border ${tones[tone as string]}`}
              >
                {badge}
              </span>
              <div className="text-[11.5px] text-ink-2">
                {claim}
                <div className="text-ink-4 mt-0.5">{cite}</div>
              </div>
            </motion.div>
          );
        })}
      </div>
    ),
  },
  {
    kicker: "05 · Verdict",
    title: "One score. With receipts.",
    body: "Manipulation index from 0 to 100, the techniques that drove it, the claims that checked out, and the ones that didn't. Open and inspectable — not a black box.",
    icon: Gavel,
    accent: "#ff6b8b",
    art: (
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <div className="grad-meter text-[44px] font-bold tracking-[-0.04em] leading-none">
            82
            <span className="text-base text-ink-4 ml-0.5">/100</span>
          </div>
          <span className="font-mono text-[10px] tracking-[0.14em] uppercase px-1.5 py-0.5 rounded bg-[rgba(255,93,99,0.12)] text-brand-red border border-[rgba(255,93,99,0.25)]">
            severe
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden mb-3">
          <motion.div
            initial={{ width: "0%" }}
            whileInView={{ width: "82%" }}
            viewport={{ once: false, amount: 0.6 }}
            transition={{ duration: 1.2, ease: [0.2, 0.7, 0.3, 1] }}
            className="h-full bg-gradient-to-r from-brand-green via-brand-amber to-brand-red"
          />
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ["7", "techniques"],
            ["3", "claims"],
            ["12s", "runtime"],
          ].map(([v, l]) => (
            <div key={l} className="rounded-md bg-white/[0.025] border border-white/[0.07] px-2 py-2">
              <div className="text-[18px] font-bold tracking-tight">{v}</div>
              <div className="font-mono text-[9.5px] tracking-wider text-ink-4 uppercase">
                {l}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

function StepCard({ step, index }: { step: Step; index: number }) {
  const Icon = step.icon;
  return (
    <div
      className="sticky"
      style={{
        top: `${88 + index * 18}px`,
        marginBottom: index === STEPS.length - 1 ? 0 : "28px",
      }}
    >
      <div
        className="rounded-2xl p-[1px] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)]"
        style={{
          background: `linear-gradient(160deg, ${step.accent}55, rgba(255,255,255,0.06) 30%, rgba(255,255,255,0.04))`,
        }}
      >
        <div className="rounded-[15px] bg-[#0c0c0f] grid md:grid-cols-2 gap-8 px-7 md:px-10 py-9 md:py-12">
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-2.5 font-mono text-[11px] tracking-[0.16em] uppercase mb-4">
              <span
                className="w-7 h-7 rounded-md inline-flex items-center justify-center"
                style={{
                  background: `${step.accent}1a`,
                  border: `1px solid ${step.accent}55`,
                }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color: step.accent }} />
              </span>
              <span style={{ color: step.accent }}>{step.kicker}</span>
            </div>
            <h3
              className="grad-feature-h font-semibold leading-[1.05] tracking-[-0.025em] mb-4"
              style={{ fontSize: "clamp(26px, 3.2vw, 38px)" }}
            >
              {step.title}
            </h3>
            <p className="text-ink-3 text-[15.5px] leading-relaxed max-w-[42ch]">
              {step.body}
            </p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-white/[0.02] to-transparent border border-white/[0.05] p-5">
            {step.art}
          </div>
        </div>
      </div>
    </div>
  );
}

export function StickyHow() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const progress = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <section id="how" className="relative z-10 px-7 max-w-[1240px] mx-auto py-32 scroll-mt-24">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.7 }}
        className="text-center mb-14"
      >
        <div className="inline-flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-brand-violet mb-4">
          <span
            className="w-1.5 h-1.5 rounded-full bg-brand-violet"
            style={{ boxShadow: "0 0 8px currentColor" }}
          />
          From paste to verdict
        </div>
        <h2 className="grad-feature-h font-semibold leading-[1.02] tracking-[-0.028em] mb-4 max-w-[18ch] mx-auto" style={{ fontSize: "clamp(30px, 4.6vw, 52px)" }}>
          Five steps. <em className="not-italic grad-feature-em">Twelve seconds.</em>
        </h2>
        <p className="text-ink-3 text-[16.5px] leading-relaxed max-w-[56ch] mx-auto">
          Scroll to watch GKIN read an article the way a researcher would — only faster, and with sources attached.
        </p>
      </motion.div>

      <div ref={ref} className="relative">
        {/* progress bar */}
        <div className="hidden md:block absolute -left-8 top-2 bottom-2 w-px bg-white/[0.06]">
          <motion.div
            style={{ height: progress }}
            className="w-full bg-gradient-to-b from-brand-cyan via-brand-violet to-brand-rose"
          />
        </div>

        {STEPS.map((s, i) => (
          <StepCard key={s.kicker} step={s} index={i} />
        ))}
      </div>
    </section>
  );
}
