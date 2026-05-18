import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function FinalCTA() {
  return (
    <section className="relative z-10 pt-32 pb-20 px-7 max-w-[1240px] mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.9, ease: [0.2, 0.7, 0.3, 1] }}
        className="relative rounded-3xl p-[1px] overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, rgba(93,217,255,0.4), rgba(155,123,255,0.3) 50%, rgba(255,107,139,0.3))",
        }}
      >
        <div
          className="absolute -inset-[50%] blur-[60px] opacity-40 animate-spinSlow"
          style={{
            background:
              "conic-gradient(from 90deg at 50% 50%, #5dd9ff, #9b7bff, #ff6b8b, #5dd9ff)",
          }}
        />
        <div className="relative z-10 rounded-[23px] bg-gradient-to-b from-[#0c0c0f] to-[#050505] px-8 py-20 sm:px-16 text-center">
          <h2 className="grad-feature-h font-semibold leading-[0.98] tracking-[-0.035em] mb-4 max-w-[16ch] mx-auto" style={{ fontSize: "clamp(40px, 6.4vw, 84px)" }}>
            Stop arguing with vibes.
            <br />
            Start arguing with <em className="not-italic grad-feature-em">evidence.</em>
          </h2>
          <p className="text-ink-3 text-[17px] max-w-[52ch] mx-auto mb-9">
            Open GKIN. Paste the article that&apos;s been bugging you. Get the verdict in seconds.
          </p>
          <Button variant="primary" size="lg" href="/login">
            Launch GKIN
            <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.4} />
          </Button>
        </div>
      </motion.div>
    </section>
  );
}
