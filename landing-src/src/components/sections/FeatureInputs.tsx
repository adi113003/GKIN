import { motion } from "framer-motion";
import { FileText, Link2, ImageIcon, Mic } from "lucide-react";

const INPUTS = [
  { icon: FileText, title: "Article text", caption: "paste · 200+ chars" },
  { icon: Link2, title: "URL fetch", caption: "scrape · trafilatura" },
  { icon: ImageIcon, title: "Screenshot", caption: "llama-3.2-vision-90b" },
  { icon: Mic, title: "Audio & video", caption: "whisper-large-v3" },
];

export function FeatureInputs() {
  return (
    <section id="inputs" className="relative z-10 py-32 px-7 max-w-[1240px] mx-auto">
      <div className="grid md:grid-cols-[1.1fr_1fr] gap-12 md:gap-20 items-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.9, ease: [0.2, 0.7, 0.3, 1] }}
          className="order-2 md:order-1"
        >
          <div
            className="relative rounded-xl p-[1px] shadow-[0_20px_50px_-15px_rgba(0,0,0,0.7),0_30px_80px_-30px_rgba(155,123,255,0.18)]"
            style={{
              background:
                "linear-gradient(160deg, rgba(255,255,255,0.14), rgba(155,123,255,0.18) 100%)",
            }}
          >
            <div className="rounded-[11px] bg-[#0c0c0f] px-6 py-6">
              <div className="grid grid-cols-2 gap-3">
                {INPUTS.map(({ icon: Icon, title, caption }, i) => (
                  <motion.div
                    key={title}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{ delay: i * 0.08, duration: 0.45 }}
                    whileHover={{ y: -3, transition: { duration: 0.2 } }}
                    className="px-4 py-4 bg-white/[0.025] border border-white/[0.07] rounded-xl overflow-hidden hover:bg-white/[0.05] hover:border-white/[0.14] transition-colors group"
                  >
                    <div
                      className="w-7 h-7 rounded-md inline-flex items-center justify-center mb-3 border border-white/[0.14]"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(93,217,255,0.12), rgba(155,123,255,0.08))",
                      }}
                    >
                      <Icon className="w-3.5 h-3.5 text-white" strokeWidth={2} />
                    </div>
                    <h6 className="text-[13.5px] font-semibold tracking-tight mb-0.5">
                      {title}
                    </h6>
                    <p className="font-mono text-[11.5px] text-ink-4 tracking-wide">
                      {caption}
                    </p>
                    <div
                      className="h-[3px] mt-3 rounded-sm opacity-60 animate-pulseSlide"
                      style={{
                        background:
                          "linear-gradient(90deg, #5dd9ff, #9b7bff, transparent)",
                        backgroundSize: "200% 100%",
                      }}
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8, ease: [0.2, 0.7, 0.3, 1] }}
          className="order-1 md:order-2"
        >
          <div className="inline-flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-brand-violet mb-4">
            <span
              className="w-1.5 h-1.5 rounded-full bg-brand-violet"
              style={{ boxShadow: "0 0 8px currentColor" }}
            />
            Whatever you&apos;ve got
          </div>
          <h2 className="grad-feature-h font-semibold leading-[1.02] tracking-[-0.028em] mb-4 max-w-[14ch]" style={{ fontSize: "clamp(30px, 4.6vw, 52px)" }}>
            Text. URL. Screenshot. <em className="not-italic grad-feature-em">Podcast.</em>
          </h2>
          <p className="text-ink-3 text-[16.5px] leading-relaxed max-w-[50ch] mb-3.5">
            The misinformation you encounter isn&apos;t always neatly formatted text. It&apos;s a
            tweet screenshot. It&apos;s a podcast clip. It&apos;s a YouTube rant your uncle sent.
            GKIN normalises all of it.
          </p>
          <p className="text-ink-3 text-[16.5px] leading-relaxed max-w-[50ch]">
            Llama Vision 90B reads images. Whisper Large v3 transcribes audio and video.
            Everything flows into the same analysis pipeline — same techniques, same claim
            checks.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
