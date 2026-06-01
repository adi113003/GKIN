const navLinks = [
  { label: "How it works", href: "#how" },
  { label: "Method", href: "#method" },
  { label: "Benchmarks", href: "#bench" },
];

const fields = [
  { k: "Ref", v: "GKIN-BRF-0001" },
  { k: "Date", v: "01 JUN 2026" },
  { k: "Subject", v: "How GKIN reads a source" },
  { k: "Prepared for", v: "Newsroom & IR desks" },
];

export function Masthead() {
  return (
    <header>
      {/* navy utility nav strip — centered mono links */}
      <nav
        aria-label="Primary"
        className="flex flex-wrap justify-center border-b-[1.5px] border-ink bg-navy"
      >
        {navLinks.map((l, i) => (
          <a
            key={l.href}
            href={l.href}
            className={[
              "cursor-pointer px-[18px] py-[9px] font-mono text-[11px] uppercase tracking-[0.12em] text-paper no-underline hover:underline hover:underline-offset-[3px]",
              i === 0 ? "" : "border-l border-paper/20",
            ].join(" ")}
          >
            {l.label}
          </a>
        ))}
        <a
          href="/login"
          className="cursor-pointer border-l border-paper/20 bg-paper/10 px-[18px] py-[9px] font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-paper no-underline hover:underline hover:underline-offset-[3px]"
        >
          Sign in
        </a>
      </nav>

      {/* centered GKIN nameplate */}
      <div className="border-b-[1.5px] border-ink px-4 py-[18px] text-center sm:px-[26px] sm:py-[26px]">
        <div
          className="font-slab font-bold leading-none text-ink"
          style={{
            fontSize: "clamp(40px, 7vw, 56px)",
            letterSpacing: "0.16em",
            textIndent: "0.16em",
          }}
        >
          GKIN
        </div>
        <div className="mt-[13px] inline-block border-t border-rule-soft pt-3 font-mono text-[11px] uppercase tracking-[0.22em] text-ink-soft">
          Ground Knowledge · Media-Forensics Bureau
        </div>
      </div>

      {/* fielded document-header block */}
      <div className="border-b-[1.5px] border-ink px-4 py-[18px] sm:px-[26px]">
        <div
          role="group"
          aria-label="Briefing metadata"
          className="grid grid-cols-1 border-l border-t border-rule-soft sm:grid-cols-2"
        >
          {fields.map((f) => (
            <div
              key={f.k}
              className="flex flex-col gap-[3px] border-b border-r border-rule-soft px-3 py-2"
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-navy">
                {f.k}
              </span>
              <span className="font-mono text-[13px] text-ink">{f.v}</span>
            </div>
          ))}
          <div className="col-span-1 flex flex-col gap-[3px] border-b border-r border-rule-soft px-3 py-2 sm:col-span-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-navy">
              Assessment
            </span>
            <span className="font-mono text-[13px] font-semibold uppercase tracking-[0.04em] text-contradicted">
              Auditable — every verdict tied to a source sentence or declared insufficient
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
