export function Mesh() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-[#09090b]">
      <div
        className="absolute left-1/2 -translate-x-1/2 -top-[20%] w-[1400px] h-[900px] opacity-60 blur-[120px]"
        style={{
          background: `
            radial-gradient(circle at 30% 40%, rgba(129,140,248,0.20), transparent 50%),
            radial-gradient(circle at 70% 30%, rgba(79,70,229,0.18), transparent 55%),
            radial-gradient(circle at 50% 80%, rgba(56,189,248,0.12), transparent 60%)
          `,
        }}
      />
    </div>
  );
}
