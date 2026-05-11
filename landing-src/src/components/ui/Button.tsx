import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
  href?: string;
}

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold tracking-tight transition-all duration-200 cubic-bezier(.2,.7,.3,1) cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black";

const variants: Record<Variant, string> = {
  primary:
    "bg-white text-black border-transparent shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_8px_24px_rgba(75,139,255,0.18)] hover:bg-white hover:-translate-y-px hover:shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_14px_38px_rgba(155,123,255,0.28)]",
  secondary:
    "bg-white/[0.04] text-white border-white/[0.14] hover:bg-white/[0.08] hover:border-white/[0.24] hover:-translate-y-px",
  ghost:
    "bg-transparent text-ink-3 border-transparent hover:text-white hover:bg-white/[0.04]",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-[13px]",
  md: "px-4 py-2.5 text-sm",
  lg: "px-5 py-3 text-[15px]",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", href, children, ...props }, ref) => {
    const cls = cn(base, variants[variant], sizes[size], className);
    if (href) {
      return (
        <a href={href} className={cls}>
          {children}
        </a>
      );
    }
    return (
      <button ref={ref} className={cls} {...props}>
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
