import { motion } from "framer-motion";
import {
  Brain,
  Code2,
  Image as ImageIcon,
  Mic2,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

const NODES = [
  { icon: Brain, label: "DeepSeek R1", sub: "reasoning · 70B", color: "#5dd9ff" },
  { icon: Code2, label: "Llama 3.3", sub: "JSON struct · 70B", color: "#9b7bff" },
  { icon: ImageIcon, label: "Llama Vision", sub: "OCR · 90B", color: "#ffb547" },
  { icon: Mic2, label: "Whisper v3", sub: "audio · large", color: "#4ade80" },
  { icon: Sparkles, label: "Llama 8B", sub: "claims · fast", color: "#ff6b8b" },
];

// SVG coordinates: 5 source nodes evenly spaced on left edge, central verdict on right
// Canvas: 720 x 460
const PATHS = [
  "M120 60 C 320 60, 380 230, 600 230",
  "M120 160 C 320 160, 400 230, 600 230",
  "M120 230 L 600 230",
  "M120 300 C 320 300, 400 230, 600 230",
  "M120 400 C 320 400, 380 230, 600 230",
];

const POS = [
  { x: 24, y: 22, color: "#5dd9ff" },
  { x: 24, y: 122, color: "#9b7bff" },
  { x: 24, y: 192, color: "#ffb547" },
  { x: 24, y: 262, color: "#4ade80" },
  { x: 24, y: 362, color: "#ff6b8b" },
];

export function PipelineBeams() {
  return (
    <section className="relative z-10 py-28 px-7 max-w-[1240px] mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.7 }}
        className="text-center mb-12"
      >
        <div className="inline-flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-brand-cyan mb-4">
          <span
            className="w-1.5 h-1.5 rounded-full bg-brand-cyan"
            style={{ boxShadow: "0 0 8px currentColor" }}
          />
          The reasoning stack
        </div>
        <h2 className="grad-feature-h font-semibold leading-[1.02] tracking-[-0.028em] mb-4 max-w-[18ch] mx-auto" style={{ fontSize: "clamp(30px, 4.6vw, 52px)" }}>
          Five models, <em className="not-italic grad-feature-em">one verdict.</em>
        </h2>
        <p className="text-ink-3 text-[16.5px] leading-relaxed max-w-[56ch] mx-auto">
          Each modality routes to a specialist. Their outputs converge into a single
          manipulation index with citations — no black-box averaging.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.9, ease: [0.2, 0.7, 0.3, 1] }}
        className="relative rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.025] to-transparent overflow-hidden p-6 md:p-10"
      >
        <div
          className="absolute inset-0 pointer-events-none opacity-60"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 70% 50%, rgba(75,139,255,0.18), transparent 70%)",
            filter: "blur(40px)",
          }}
        />

        <div className="relative grid md:grid-cols-[1fr_1.5fr_1fr] gap-6 items-center">
          {/* Source labels */}
          <div className="flex flex-col gap-4 z-10">
            {NODES.map((n) => {
              const Icon = n.icon;
              return (
                <div
                  key={n.label}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg border border-white/[0.07] bg-[#0c0c0f]/80 backdrop-blur"
                >
                  <span
                    className="w-7 h-7 rounded-md inline-flex items-center justify-center"
                    style={{
                      background: `${n.color}1a`,
                      border: `1px solid ${n.color}55`,
                    }}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: n.color }} />
                  </span>
                  <div>
                    <div className="text-[12.5px] font-semibold leading-tight">
                      {n.label}
                    </div>
                    <div className="font-mono text-[10px] text-ink-4 tracking-wider">
                      {n.sub}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* SVG beams */}
          <div className="relative w-full h-[460px] hidden md:block">
            <svg
              viewBox="0 0 720 460"
              fill="none"
              className="absolute inset-0 w-full h-full"
            >
              <defs>
                {PATHS.map((_, i) => (
                  <linearGradient
                    key={i}
                    id={`beam-${i}`}
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="0%"
                  >
                    <stop offset="0%" stopColor={POS[i].color} stopOpacity="0" />
                    <stop offset="50%" stopColor={POS[i].color} stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#5dd9ff" stopOpacity="0" />
                  </linearGradient>
                ))}
                <radialGradient id="hub-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#5dd9ff" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#9b7bff" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* base paths */}
              {PATHS.map((d, i) => (
                <path
                  key={`base-${i}`}
                  d={d}
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="1"
                  fill="none"
                />
              ))}

              {/* animated dash beams */}
              {PATHS.map((d, i) => (
                <motion.path
                  key={`anim-${i}`}
                  d={d}
                  stroke={`url(#beam-${i})`}
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray="80 600"
                  initial={{ strokeDashoffset: 700 }}
                  animate={{ strokeDashoffset: [700, -100] }}
                  transition={{
                    duration: 3.5,
                    repeat: Infinity,
                    ease: "linear",
                    delay: i * 0.45,
                  }}
                />
              ))}

              {/* source dots */}
              {POS.map((p, i) => (
                <g key={`src-${i}`}>
                  <circle
                    cx={120}
                    cy={[60, 160, 230, 300, 400][i]}
                    r="5"
                    fill={p.color}
                    opacity="0.9"
                  />
                  <circle
                    cx={120}
                    cy={[60, 160, 230, 300, 400][i]}
                    r="10"
                    fill={p.color}
                    opacity="0.15"
                  />
                </g>
              ))}

              {/* hub */}
              <circle cx="600" cy="230" r="60" fill="url(#hub-glow)" />
              <circle
                cx="600"
                cy="230"
                r="14"
                fill="#0c0c0f"
                stroke="#5dd9ff"
                strokeWidth="1.5"
              />
              <circle cx="600" cy="230" r="5" fill="#5dd9ff" />
            </svg>
          </div>

          {/* Verdict card */}
          <div className="z-10 flex justify-center md:justify-end">
            <div
              className="rounded-2xl p-[1px] w-full max-w-[240px]"
              style={{
                background:
                  "linear-gradient(135deg, rgba(93,217,255,0.5), rgba(155,123,255,0.4), rgba(255,107,139,0.4))",
              }}
            >
              <div className="rounded-2xl bg-[#0c0c0f] px-5 py-4">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-brand-cyan" />
                  <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-4">
                    Verdict
                  </span>
                </div>
                <div className="grad-meter text-3xl font-bold tracking-[-0.04em] leading-none mb-1">
                  82<span className="text-base text-ink-4 ml-0.5">/100</span>
                </div>
                <div className="text-[11.5px] text-ink-3 leading-snug mb-2.5">
                  Severe manipulation · 7 techniques · 3 claims checked
                </div>
                <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                  <motion.div
                    initial={{ width: "0%" }}
                    whileInView={{ width: "82%" }}
                    viewport={{ once: true, amount: 0.5 }}
                    transition={{ duration: 1.4, ease: [0.2, 0.7, 0.3, 1] }}
                    className="h-full bg-gradient-to-r from-brand-green via-brand-amber to-brand-red"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
