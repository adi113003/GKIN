export function FinalCTA() {
  return (
    <section className="border-b-[1.5px] border-ink bg-paper-2 px-4 py-[40px] text-center sm:px-[26px]">
      <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-navy">
        5.0 — Open the file
      </div>
      <h2
        className="mx-auto mb-4 max-w-[20ch] font-slab font-bold leading-[1.04] tracking-[-0.005em] text-ink"
        style={{ fontSize: "clamp(30px, 5vw, 44px)" }}
      >
        Stop arguing with vibes.{" "}
        <em className="not-italic text-navy underline decoration-2 underline-offset-[4px]">
          Start arguing with evidence.
        </em>
      </h2>
      <p className="mx-auto mb-7 max-w-[52ch] text-[17px] leading-[1.6] text-ink">
        Open GKIN. Paste the article that's been bugging you. Get the verdict —
        with its receipts — in seconds.
      </p>
      <a
        href="/login"
        className="inline-flex cursor-pointer items-center gap-[10px] border-[1.5px] border-ink bg-navy px-[26px] py-[13px] font-mono text-[12px] font-semibold uppercase tracking-[0.1em] text-paper no-underline hover:bg-ink"
      >
        Analyze an article <span aria-hidden="true">→</span>
      </a>
    </section>
  );
}
