const principles: { term: string; body: string }[] = [
  {
    term: "Grounded citations",
    body: "Every confident verdict is bolted to a verbatim source sentence, re-verified against the live page. The model cannot cite something that isn't really there.",
  },
  {
    term: "Tiered sources",
    body: "A trusted-source tier policy weights credibility. A verdict backed only by unverified sources is downgraded to insufficient, no matter how many agree.",
  },
  {
    term: "Auditable, not a black box",
    body: "Three honest states (supported, contradicted, insufficient), each with clickable, tiered citations. Insufficient is the default when the record is thin.",
  },
];

export function Method() {
  return (
    <section id="method" className="px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-6xl">
      <div className="mb-3">
        <h2 className="text-[28px] font-semibold leading-tight tracking-tight text-ink sm:text-[32px]">
          Method: why it's different
        </h2>
        <p className="mt-1 text-[15px] text-ink-soft">
          They answer. GKIN proves.
        </p>
      </div>

      <p className="mb-10 max-w-[64ch] text-[16px] leading-[1.6] text-ink">
        General assistants are broader and more fluent. For the one job that
        matters here, whether a claim is true and you can prove it, GKIN's design
        makes guarantees they don't.
      </p>

      {/* three principles: clean rounded cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {principles.map((p) => (
          <div
            key={p.term}
            className="rounded-card border border-hairline-soft p-6"
          >
            <div className="mb-2 text-[15px] font-semibold text-ink">
              {p.term}
            </div>
            <p className="text-[14px] leading-[1.55] text-ink-soft">{p.body}</p>
          </div>
        ))}
      </div>

      {/* midterm critique: quoted, then rebuilt */}
      <div className="mt-10 rounded-card border-l-[3px] border-rausch bg-surface-soft p-6">
        <div className="mb-2 text-[13px] text-ink-soft">From midterm review</div>
        <blockquote className="text-[16px] italic leading-[1.55] text-ink-soft">
          “How do you verify the information is true? Using multiple sources
          isn't enough; bad actors can seed or position multiple sources to
          manufacture a consensus.”
        </blockquote>
        <div className="mb-2 mt-6 text-[13px] font-semibold text-ink">
          What we rebuilt
        </div>
        <p className="text-[15px] leading-[1.6] text-ink">
          Grounding is now enforced by construction, not by prompt: an
          ungrounded verdict is impossible to build. Manufactured consensus
          can't clear the bar, because tier weighting downgrades unverified
          agreement to <b className="font-semibold">insufficient</b>. And when
          the record is silent, GKIN says so instead of bluffing. Abstention
          is a feature.
        </p>
      </div>
      </div>
    </section>
  );
}
