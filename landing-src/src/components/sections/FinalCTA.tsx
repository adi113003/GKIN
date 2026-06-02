export function FinalCTA() {
  return (
    <section className="bg-canvas px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-3xl rounded-card bg-[#fff0f3] px-6 py-16 text-center sm:px-12">
        <h2
          className="mx-auto mb-4 max-w-[20ch] font-semibold leading-[1.1] tracking-tight text-ink"
          style={{ fontSize: "clamp(30px, 5vw, 44px)" }}
        >
          Stop arguing with vibes.{" "}
          <span className="text-rausch">Start arguing with evidence.</span>
        </h2>
        <p className="mx-auto mb-8 max-w-[52ch] text-[17px] leading-relaxed text-[#3f3f3f]">
          Open GKIN. Paste the article that's been bugging you. Get the verdict,
          with its receipts, in seconds.
        </p>
        <a
          href="/login"
          className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-rausch px-7 py-3.5 font-semibold text-white no-underline transition-colors hover:bg-rausch-active"
        >
          Analyze an article <span aria-hidden="true">→</span>
        </a>
      </div>
    </section>
  );
}
