import { motion, useInView, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useRef } from "react";

const STATS = [
  {
    target: 99.4,
    decimals: 1,
    unit: "%",
    label: "Classifier accuracy",
    detail: "DistilBERT · WELFake test",
  },
  {
    target: 72073,
    decimals: 0,
    unit: "",
    label: "Labelled articles",
    detail: "Training corpus",
  },
  {
    target: 14,
    decimals: 0,
    unit: "",
    label: "Persuasion classes",
    detail: "named & located",
  },
  {
    target: 5,
    decimals: 0,
    unit: "",
    label: "Input modalities",
    detail: "text · url · img · audio · video",
  },
];

function Counter({
  target,
  decimals,
  unit,
  active,
}: {
  target: number;
  decimals: number;
  unit: string;
  active: boolean;
}) {
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 40, damping: 18 });
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (active) mv.set(target);
  }, [active, target, mv]);

  useEffect(() => {
    return spring.on("change", (v) => {
      if (!ref.current) return;
      const formatted =
        decimals > 0
          ? v.toFixed(decimals)
          : Math.round(v).toLocaleString();
      ref.current.textContent = formatted;
    });
  }, [spring, decimals]);

  return (
    <div className="font-bold tracking-[-0.04em] leading-none mb-2" style={{ fontSize: "40px" }}>
      <span
        ref={ref}
        className="bg-gradient-to-br from-white to-[#a8a8b0] bg-clip-text text-transparent"
      >
        0
      </span>
      {unit && (
        <span
          className="text-[22px]"
          style={{
            background: "linear-gradient(120deg, #5dd9ff, #9b7bff)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {unit}
        </span>
      )}
    </div>
  );
}

export function Stats() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const inView = useInView(wrapRef, { once: true, amount: 0.3 });

  return (
    <section id="proof" className="relative z-10 py-20 px-7 max-w-[1240px] mx-auto">
      <div
        ref={wrapRef}
        className="grid grid-cols-2 md:grid-cols-4 border border-white/[0.07] rounded-2xl overflow-hidden bg-gradient-to-b from-white/[0.025] to-transparent"
      >
        {STATS.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ delay: i * 0.08, duration: 0.6 }}
            className={`px-7 py-8 relative ${
              i < STATS.length - 1 ? "md:border-r border-white/[0.07]" : ""
            } ${i < 2 ? "border-b md:border-b-0 border-white/[0.07]" : ""} ${
              i === 0 ? "border-r border-white/[0.07]" : ""
            } ${i === 2 ? "border-r border-white/[0.07] md:border-r-0" : ""}`}
          >
            <Counter
              target={s.target}
              decimals={s.decimals}
              unit={s.unit}
              active={inView}
            />
            <div className="text-[13.5px] text-ink-2 font-medium mb-1">
              {s.label}
            </div>
            <div className="font-mono text-[11px] text-ink-4 tracking-wide">
              {s.detail}
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
