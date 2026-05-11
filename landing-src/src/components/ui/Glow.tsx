import { cn } from "@/lib/utils";

type Variant = "top" | "above" | "bottom" | "below" | "center";

export function Glow({
  className,
  variant = "above",
}: {
  className?: string;
  variant?: Variant;
}) {
  const pos = {
    top: "top-0",
    above: "-top-[128px]",
    bottom: "bottom-0",
    below: "-bottom-[128px]",
    center: "top-1/2",
  }[variant];

  return (
    <div className={cn("absolute w-full pointer-events-none", pos, className)}>
      <div
        className={cn(
          "absolute left-1/2 h-[256px] w-[60%] -translate-x-1/2 scale-[2.5] rounded-[50%] sm:h-[512px]",
          variant === "center" && "-translate-y-1/2",
        )}
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(75,139,255,0.32) 10%, rgba(155,123,255,0) 60%)",
        }}
      />
      <div
        className={cn(
          "absolute left-1/2 h-[128px] w-[40%] -translate-x-1/2 scale-[2] rounded-[50%] sm:h-[256px]",
          variant === "center" && "-translate-y-1/2",
        )}
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(93,217,255,0.25) 10%, rgba(75,139,255,0) 60%)",
        }}
      />
    </div>
  );
}
