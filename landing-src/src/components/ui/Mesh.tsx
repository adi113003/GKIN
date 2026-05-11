export function Mesh() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      <div
        className="absolute left-1/2 -translate-x-1/2 -top-[20%] w-[1400px] h-[900px] opacity-90 blur-[60px]"
        style={{
          background: `
            radial-gradient(circle at 30% 40%, rgba(75,139,255,0.20), transparent 50%),
            radial-gradient(circle at 70% 30%, rgba(155,123,255,0.18), transparent 55%),
            radial-gradient(circle at 50% 80%, rgba(93,217,255,0.12), transparent 60%)
          `,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.024) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.024) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse 70% 50% at 50% 30%, #000 0%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 50% at 50% 30%, #000 0%, transparent 75%)",
        }}
      />
    </div>
  );
}
