const loginUrl = "/login";

export function Footer() {
  return (
    <footer className="relative z-10 border-t border-white/[0.07] py-9 px-7">
      <div className="max-w-[1240px] mx-auto flex flex-wrap items-center justify-between gap-3.5 text-[12.5px] text-ink-4">
        <span className="text-[13.5px] text-ink-3">GKIN · Truth Navigator</span>
        <div className="flex gap-5">
          {[
            { label: "Launch", href: loginUrl },
            { label: "How it works", href: "#how" },
            { label: "Compare", href: "#compare" },
            { label: "Since midterm", href: "#since-midterm" },
            { label: "Proof", href: "#proof" },
          ].map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-ink-4 hover:text-ink-2 transition-colors no-underline"
            >
              {l.label}
            </a>
          ))}
        </div>
        <span>© 2026 · built for media literacy</span>
      </div>
    </footer>
  );
}
