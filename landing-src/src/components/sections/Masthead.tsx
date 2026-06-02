const navLinks = [
  { label: "How it works", href: "#how" },
  { label: "Method", href: "#method" },
  { label: "Benchmarks", href: "#bench" },
];

export function Masthead() {
  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-white">
      <nav
        aria-label="Primary"
        className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-6"
      >
        {/* wordmark */}
        <a
          href="/"
          className="text-[22px] font-extrabold tracking-tight text-ink no-underline"
        >
          GKIN<span className="text-rausch">.</span>
        </a>

        {/* right-side nav links + sign in */}
        <div className="flex items-center gap-2 sm:gap-6">
          <div className="hidden items-center gap-6 sm:flex">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-ink-soft no-underline transition-colors hover:text-ink"
              >
                {l.label}
              </a>
            ))}
          </div>
          <a
            href="/login"
            className="rounded-full bg-rausch px-5 py-2 text-sm font-semibold text-white no-underline transition-colors hover:bg-rausch-active"
          >
            Sign in
          </a>
        </div>
      </nav>
    </header>
  );
}
