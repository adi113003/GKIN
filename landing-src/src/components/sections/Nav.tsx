import { useEffect, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { label: "How it works", href: "#how" },
  { label: "Compare", href: "#compare" },
  { label: "Since midterm", href: "#since-midterm" },
  { label: "Proof", href: "#proof" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={cn(
        "fixed top-0 inset-x-0 z-50 py-3.5 backdrop-blur-md transition-all",
        scrolled
          ? "bg-black/80 border-b border-white/[0.07]"
          : "bg-black/50 border-b border-transparent",
      )}
    >
      <div className="max-w-[1240px] mx-auto px-7 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2.5 text-white font-semibold text-[15px] tracking-tight">
          <span className="w-6 h-6 rounded-md bg-gradient-to-br from-white to-[#a8a8b0] flex items-center justify-center">
            <Search className="w-3.5 h-3.5 text-black" strokeWidth={2.6} />
          </span>
          GKIN
        </a>
        <div className="flex items-center gap-1.5">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="hidden sm:inline-flex px-3 py-2 text-[13.5px] font-medium text-ink-3 rounded-md hover:text-white hover:bg-white/[0.04] transition-colors"
            >
              {l.label}
            </a>
          ))}
          <a
            href="/login"
            className="ml-2 inline-flex items-center gap-1.5 px-3.5 py-2 bg-white text-black text-[13px] font-semibold rounded-md hover:bg-white hover:-translate-y-px transition-all"
          >
            Launch
            <ArrowRight className="w-3 h-3" strokeWidth={2.4} />
          </a>
        </div>
      </div>
    </nav>
  );
}
