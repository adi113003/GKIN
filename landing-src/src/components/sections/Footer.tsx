const links = [
  { label: "Sign in", href: "/login" },
  { label: "How it works", href: "#how" },
  { label: "Method", href: "#method" },
  { label: "Benchmarks", href: "#bench" },
];

export function Footer() {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-3 px-4 py-[18px] font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-soft sm:px-[26px]">
      <span>GKIN — Ground Knowledge · Media-Forensics Bureau</span>
      <div className="flex flex-wrap gap-4">
        {links.map((l) => (
          <a
            key={l.href}
            href={l.href}
            className="cursor-pointer no-underline hover:underline hover:underline-offset-[3px]"
          >
            {l.label}
          </a>
        ))}
      </div>
      <span className="text-navy">© 2026 · FILE GKIN-BRF-0001</span>
    </footer>
  );
}
