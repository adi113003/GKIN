import { motion } from "framer-motion";

type Row = { headline: string; outlet: string; mi: number };

const ROW_A: Row[] = [
  { headline: "Sources say new policy will DESTROY small business", outlet: "DAILY WIRE", mi: 82 },
  { headline: "Scientists baffled by miracle supplement big pharma hates", outlet: "HEALTHBUZZ", mi: 94 },
  { headline: "Senate passes infrastructure bill, 76–24 vote", outlet: "REUTERS", mi: 12 },
  { headline: "Insiders WARN: this could end America as we know it", outlet: "PATRIOT POST", mi: 88 },
  { headline: "Q3 GDP rose 2.4% versus 2.1% consensus, BEA reports", outlet: "AP", mi: 7 },
  { headline: "What they don't want you to see about the election", outlet: "TRUTHWIRE", mi: 91 },
];

const ROW_B: Row[] = [
  { headline: "The shocking truth about your morning coffee", outlet: "WELLNESSDAILY", mi: 76 },
  { headline: "Inflation eased to 2.6% in October, CPI data shows", outlet: "BLOOMBERG", mi: 9 },
  { headline: "Everyone is talking about this billionaire's secret", outlet: "TYCOONTIMES", mi: 84 },
  { headline: "Court rules 6-3 in favor of plaintiff in privacy case", outlet: "NYT", mi: 14 },
  { headline: "What no one is telling you about THE GREAT RESET", outlet: "AWAKENED", mi: 96 },
  { headline: "Fed holds rates steady at 4.50–4.75%, signals patience", outlet: "WSJ", mi: 8 },
];

function tone(mi: number) {
  if (mi >= 75)
    return {
      bar: "from-brand-red to-brand-rose",
      label: "text-brand-red",
      bg: "bg-[rgba(255,93,99,0.06)]",
      border: "border-[rgba(255,93,99,0.18)]",
    };
  if (mi >= 50)
    return {
      bar: "from-brand-amber to-brand-rose",
      label: "text-brand-amber",
      bg: "bg-[rgba(255,181,71,0.05)]",
      border: "border-[rgba(255,181,71,0.18)]",
    };
  return {
    bar: "from-brand-green to-brand-cyan",
    label: "text-brand-green",
    bg: "bg-[rgba(74,222,128,0.05)]",
    border: "border-[rgba(74,222,128,0.18)]",
  };
}

function Card({ row }: { row: Row }) {
  const t = tone(row.mi);
  return (
    <div
      className={`mx-3 inline-flex items-center gap-4 min-w-[420px] px-5 py-3.5 rounded-xl border ${t.border} ${t.bg} backdrop-blur-sm`}
    >
      <div className="flex-1 min-w-0">
        <div className="font-mono text-[10px] tracking-[0.16em] text-ink-4 uppercase mb-1">
          {row.outlet}
        </div>
        <div className="text-[13.5px] text-ink-2 font-medium leading-snug truncate">
          {row.headline}
        </div>
      </div>
      <div className="flex flex-col items-end shrink-0">
        <div className={`font-mono text-[10px] tracking-[0.12em] uppercase ${t.label}`}>
          MI
        </div>
        <div className={`text-xl font-bold tracking-[-0.04em] ${t.label}`}>
          {row.mi}
        </div>
      </div>
    </div>
  );
}

function MarqueeRow({
  rows,
  duration,
  reverse = false,
}: {
  rows: Row[];
  duration: number;
  reverse?: boolean;
}) {
  const tripled = [...rows, ...rows, ...rows];
  return (
    <div className="relative overflow-hidden">
      <motion.div
        className="flex w-max"
        animate={{ x: reverse ? ["-50%", "0%"] : ["0%", "-50%"] }}
        transition={{ duration, repeat: Infinity, ease: "linear" }}
      >
        {tripled.map((r, i) => (
          <Card key={`${r.outlet}-${i}`} row={r} />
        ))}
      </motion.div>
    </div>
  );
}

export function HeadlineMarquee() {
  return (
    <section className="relative z-10 py-20 overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-10 px-7"
      >
        <div className="inline-flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-brand-rose mb-3">
          <span
            className="w-1.5 h-1.5 rounded-full bg-brand-rose"
            style={{ boxShadow: "0 0 8px currentColor" }}
          />
          In the wild
        </div>
        <h2
          className="grad-feature-h font-semibold leading-[1.05] tracking-[-0.028em]"
          style={{ fontSize: "clamp(26px, 3.8vw, 40px)" }}
        >
          Real headlines, real scores.
        </h2>
      </motion.div>

      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-24 md:w-48 z-10 pointer-events-none bg-gradient-to-r from-[#050505] to-transparent" />
        <div className="absolute right-0 top-0 bottom-0 w-24 md:w-48 z-10 pointer-events-none bg-gradient-to-l from-[#050505] to-transparent" />
        <div className="space-y-3">
          <MarqueeRow rows={ROW_A} duration={48} />
          <MarqueeRow rows={ROW_B} duration={58} reverse />
        </div>
      </div>
    </section>
  );
}
