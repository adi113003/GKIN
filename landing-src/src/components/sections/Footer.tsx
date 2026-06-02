const links = [
  { label: "Sign in", href: "/login" },
  { label: "How it works", href: "#how" },
  { label: "Method", href: "#method" },
  { label: "Benchmarks", href: "#bench" },
];

export function Footer() {
  return (
    <footer className="border-t border-hairline bg-white px-6 py-10 sm:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col">
          <span className="text-base font-semibold text-ink">GKIN</span>
          <span className="text-sm text-muted">Ground Knowledge</span>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="cursor-pointer text-sm text-ink-soft no-underline transition-colors hover:text-ink"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <span className="text-sm text-muted">© 2026 GKIN</span>
      </div>
    </footer>
  );
}
