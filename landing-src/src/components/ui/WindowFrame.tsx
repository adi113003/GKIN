import * as React from "react";
import { cn } from "@/lib/utils";
import { MoreHorizontal, Clock3 } from "lucide-react";

export function WindowFrame({
  url = "gkin.app/analyze",
  className,
  innerClassName,
  children,
}: {
  url?: string;
  className?: string;
  innerClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative rounded-2xl p-[1px] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7),0_60px_120px_-40px_rgba(75,139,255,0.18)]",
        className,
      )}
      style={{
        background:
          "linear-gradient(160deg, rgba(255,255,255,0.16), rgba(255,255,255,0.04) 30%, rgba(75,139,255,0.18) 70%, rgba(155,123,255,0.12))",
      }}
    >
      <div
        className={cn(
          "rounded-[15px] overflow-hidden bg-[#0c0c0f]",
          innerClassName,
        )}
      >
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.07] bg-white/[0.02]">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
          </div>
          <div className="flex-1 max-w-[320px] mx-auto px-3 py-1 rounded-md bg-white/[0.04] border border-white/[0.07] font-mono text-[11px] text-ink-3 flex items-center gap-1.5 justify-center">
            <span className="text-brand-green text-[10px]">●</span>
            {url}
          </div>
          <div className="text-ink-4 flex gap-3">
            <Clock3 className="w-3.5 h-3.5" />
            <MoreHorizontal className="w-3.5 h-3.5" />
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
