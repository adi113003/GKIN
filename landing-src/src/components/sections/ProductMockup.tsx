import { motion, useInView, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useRef } from "react";
import {
  FileText,
  Link2,
  Image as ImageIcon,
  Mic,
} from "lucide-react";
import { WindowFrame } from "@/components/ui/WindowFrame";

const TECHS = [
  { label: "Loaded language", tone: "v" as const },
  { label: "Anon source", tone: "b" as const },
  { label: "Appeal to fear", tone: "r" as const },
  { label: "Consensus claim", tone: "v" as const },
  { label: "Catastrophising", tone: "r" as const },
  { label: "False echo", tone: "b" as const },
];

const TONE = {
  v: "bg-[rgba(155,123,255,0.08)] border-[rgba(155,123,255,0.18)] text-[#c2afff]",
  r: "bg-[rgba(255,93,99,0.08)] border-[rgba(255,93,99,0.22)] text-[#ff8d92]",
  b: "bg-[rgba(75,139,255,0.08)] border-[rgba(75,139,255,0.22)] text-[#8bb5ff]",
};

function Gauge({ target = 82, active }: { target?: number; active: boolean }) {
  const value = useMotionValue(0);
  const display = useSpring(value, { stiffness: 50, damping: 18 });
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (active) value.set(target);
  }, [active, target, value]);

  useEffect(() => {
    return display.on("change", (v) => {
      if (ref.current) ref.current.textContent = Math.round(v).toString();
    });
  }, [display]);

  const label =
    target < 25
      ? "low"
      : target < 50
        ? "moderate"
        : target < 75
          ? "high"
          : "severe";

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3.5">
      <div className="flex items-baseline justify-between mb-2.5">
        <div className="grad-meter text-[38px] font-bold tracking-[-0.04em] leading-none">
          <span ref={ref}>0</span>
          <span className="text-sm text-ink-4 ml-1 font-medium">/100</span>
        </div>
        <span className="font-mono text-[10px] tracking-[0.12em] uppercase px-1.5 py-0.5 rounded bg-[rgba(255,181,71,0.12)] text-brand-amber border border-[rgba(255,181,71,0.25)]">
          {label}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.05] border border-white/[0.07] overflow-hidden">
        <motion.div
          initial={{ width: "0%" }}
          animate={{ width: active ? `${target}%` : "0%" }}
          transition={{ duration: 1.6, ease: [0.2, 0.7, 0.3, 1] }}
          className="h-full bg-gradient-to-r from-brand-green via-brand-amber to-brand-red"
        />
      </div>
    </div>
  );
}

export function ProductMockup() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const inView = useInView(wrapRef, { once: true, amount: 0.3 });

  return (
    <div ref={wrapRef} className="relative max-w-[1100px] mx-auto [perspective:2000px]">
      <div
        className="absolute pointer-events-none z-0"
        style={{
          left: "5%",
          right: "5%",
          top: "30%",
          bottom: "-20%",
          background:
            "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(75,139,255,0.35), transparent 70%)",
          filter: "blur(80px)",
        }}
      />
      <motion.div
        initial={{ rotateX: 8, opacity: 0, y: 30 }}
        animate={inView ? { rotateX: 2, opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.9, ease: [0.2, 0.7, 0.3, 1] }}
        className="relative z-10 origin-top"
      >
        <WindowFrame>
          <div className="grid md:grid-cols-[1.35fr_1fr] min-h-[460px]">
            {/* Article side */}
            <div className="px-7 py-6 md:border-r border-white/[0.07] relative">
              <div className="flex gap-1 mb-4 border-b border-white/[0.07] pb-2.5">
                <Tab active icon={<FileText className="w-3 h-3" />}>
                  Article
                </Tab>
                <Tab icon={<Link2 className="w-3 h-3" />}>URL</Tab>
                <Tab icon={<ImageIcon className="w-3 h-3" />}>Image</Tab>
                <Tab icon={<Mic className="w-3 h-3" />}>Audio</Tab>
              </div>
              <h3 className="text-[15px] font-semibold leading-snug tracking-tight mb-1">
                The new policy will{" "}
                <Highlight tone="r" n={2}>destroy</Highlight> small businesses, sources warn
              </h3>
              <div className="font-mono text-[10.5px] text-ink-4 tracking-wider mb-3.5">
                DAILY WIRE · OP-ED · 4 MIN READ
              </div>
              <div className="text-[13.5px] leading-[1.7] text-ink-2 space-y-2.5">
                <p>
                  <Highlight n={1}>Sources say</Highlight> the new policy will{" "}
                  <Highlight tone="r" n={2}>destroy</Highlight> small business in this
                  country. <Highlight n={3}>Everyone knows</Highlight> the elites
                  pushing this agenda{" "}
                  <Highlight tone="r" n={4}>don&apos;t care</Highlight> about working
                  families — and{" "}
                  <Highlight n={5}>the numbers prove it</Highlight>.
                </p>
                <p>
                  Critics warn the consequences could be{" "}
                  <Highlight tone="r" n={6}>catastrophic</Highlight>. As one insider
                  put it,{" "}
                  <em>
                    &ldquo;this is the end of the American Main Street as we know
                    it&rdquo;
                  </em>{" "}
                  — a sentiment{" "}
                  <Highlight n={7}>echoed across the industry</Highlight>.
                </p>
              </div>
              <ScanLine />
            </div>

            {/* Analysis side */}
            <div className="px-6 py-6 bg-gradient-to-b from-white/[0.014] to-transparent flex flex-col gap-4">
              <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.16em] text-ink-4 uppercase">
                <span>Analysis · GKIN</span>
                <span className="inline-flex items-center gap-1.5 text-brand-green">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-green shadow-[0_0_8px_currentColor] animate-liveBlink" />
                  LIVE
                </span>
              </div>

              <Gauge target={82} active={inView} />

              <div>
                <h5 className="flex justify-between items-baseline text-[11.5px] font-semibold text-ink-2 mb-2.5">
                  Persuasion
                  <span className="font-mono text-[10px] text-ink-4 font-medium tracking-wider">
                    7 found
                  </span>
                </h5>
                <div className="flex flex-wrap gap-1.5">
                  {TECHS.map((t, i) => (
                    <motion.span
                      key={t.label}
                      initial={{ opacity: 0, y: 6 }}
                      animate={inView ? { opacity: 1, y: 0 } : {}}
                      transition={{ delay: 0.7 + i * 0.07, duration: 0.4 }}
                      className={`text-[11px] px-2 py-0.5 rounded border ${TONE[t.tone]}`}
                    >
                      {t.label}
                    </motion.span>
                  ))}
                </div>
              </div>

              <div>
                <h5 className="flex justify-between items-baseline text-[11.5px] font-semibold text-ink-2 mb-2.5">
                  Claims
                  <span className="font-mono text-[10px] text-ink-4 font-medium tracking-wider">
                    3 of 3 verified
                  </span>
                </h5>
                <ClaimRow verdict="f" claim={`"the numbers prove it"`} cite="3 of 4 sources contradict" />
                <ClaimRow verdict="u" claim={`"sources say" — no attribution`} cite="cannot be cross-checked" />
                <ClaimRow verdict="t" claim="Policy introduced this quarter" cite="2 sources · gov.gazette" last />
              </div>
            </div>
          </div>
        </WindowFrame>
      </motion.div>
    </div>
  );
}

function Tab({
  children,
  icon,
  active,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  active?: boolean;
}) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[12px] font-medium ${
        active
          ? "bg-white/[0.06] text-white border border-white/[0.14]"
          : "text-ink-4 border border-transparent"
      }`}
    >
      {icon}
      {children}
    </div>
  );
}

function Highlight({
  children,
  tone = "v",
  n,
}: {
  children: React.ReactNode;
  tone?: "v" | "r";
  n: number;
}) {
  const styles =
    tone === "r"
      ? "bg-[rgba(255,93,99,0.16)] border-b border-dashed border-[rgba(255,93,99,0.7)]"
      : "bg-[rgba(255,181,71,0.18)] border-b border-dashed border-[rgba(255,181,71,0.7)]";
  return (
    <span className={`px-0.5 cursor-help ${styles}`}>
      {children}
      <sup className="ml-0.5 inline-flex w-3.5 h-3.5 items-center justify-center bg-brand-blue text-white font-mono text-[9px] font-bold rounded-full align-super leading-none">
        {n}
      </sup>
    </span>
  );
}

function ClaimRow({
  verdict,
  claim,
  cite,
  last,
}: {
  verdict: "t" | "f" | "u";
  claim: string;
  cite: string;
  last?: boolean;
}) {
  const tones = {
    t: "bg-[rgba(74,222,128,0.1)] text-brand-green border-[rgba(74,222,128,0.22)]",
    f: "bg-[rgba(255,93,99,0.1)] text-brand-red border-[rgba(255,93,99,0.22)]",
    u: "bg-[rgba(255,181,71,0.1)] text-brand-amber border-[rgba(255,181,71,0.22)]",
  };
  const text = { t: "TRUE", f: "FALSE", u: "UNVRF" }[verdict];
  return (
    <div
      className={`grid grid-cols-[44px_1fr] gap-2 items-start py-2 text-[12px] text-ink-2 leading-snug border-t border-white/[0.07] ${
        last ? "border-b" : ""
      }`}
    >
      <span
        className={`font-mono text-[9.5px] font-bold px-1.5 py-0.5 rounded text-center tracking-wider border ${tones[verdict]}`}
      >
        {text}
      </span>
      <span>
        {claim}
        <br />
        <span className="font-mono text-[9.5px] text-ink-4 mt-0.5 inline-block">
          {cite}
        </span>
      </span>
    </div>
  );
}

function ScanLine() {
  return (
    <div
      className="absolute left-0 right-0 h-px animate-scan"
      style={{
        background:
          "linear-gradient(90deg, transparent, #5dd9ff, transparent)",
        boxShadow: "0 0 14px #5dd9ff",
        opacity: 0.7,
      }}
    />
  );
}
