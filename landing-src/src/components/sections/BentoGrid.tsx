import { motion } from "framer-motion";
import { ShieldCheck, Layers, GitCompare, Zap } from "lucide-react";

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-100px" },
};

export function BentoGrid() {
  return (
    <section id="features" className="py-24 px-6 md:px-12 max-w-[1240px] mx-auto relative z-10">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
          <span className="text-ink">A complete forensic toolkit, </span>
          <span className="grad-accent">built for scale.</span>
        </h2>
        <p className="text-ink-3 max-w-2xl mx-auto text-lg">
          Everything you need to detect, analyze, and neutralize synthetic media
          and manipulative narratives in real-time.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[300px]">
        {/* Large Feature 1 */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.6 }}
          className="md:col-span-2 md:row-span-2 relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.02] p-8 flex flex-col justify-between group"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-brand-blue/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          
          <div className="relative z-10">
            <div className="w-12 h-12 rounded-xl bg-brand-blue/20 flex items-center justify-center mb-6 border border-brand-blue/30">
              <ShieldCheck className="text-brand-blue w-6 h-6" />
            </div>
            <h3 className="text-2xl font-semibold mb-2">Deepfake & Audio Spoof Detection</h3>
            <p className="text-ink-3 max-w-md">
              Our multimodal models instantly flag AI-generated images, synthetic voice clones, and manipulated video frames with 99.4% accuracy.
            </p>
          </div>
          
          <div className="relative z-10 mt-8 h-48 rounded-xl border border-white/[0.05] bg-black/40 overflow-hidden flex items-center justify-center">
            {/* Abstract visual */}
            <div className="absolute w-[200px] h-[200px] bg-brand-blue/30 blur-[60px] rounded-full animate-pulse" />
            <div className="grid grid-cols-4 gap-2 opacity-50">
              {[...Array(16)].map((_, i) => (
                <div key={i} className={`w-12 h-12 rounded-md border border-white/10 ${i % 3 === 0 ? 'bg-brand-red/20 border-brand-red/50' : 'bg-white/5'}`} />
              ))}
            </div>
          </div>
        </motion.div>

        {/* Small Feature 1 */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="md:col-span-1 md:row-span-1 relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.02] p-8 group"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-brand-violet/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="w-10 h-10 rounded-xl bg-brand-violet/20 flex items-center justify-center mb-4 border border-brand-violet/30">
            <Layers className="text-brand-violet w-5 h-5" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Any Input Format</h3>
          <p className="text-ink-3 text-sm">
            Drag and drop images, paste URLs, or upload raw audio files. GKIN normalizes the input instantly.
          </p>
        </motion.div>

        {/* Small Feature 2 */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="md:col-span-1 md:row-span-1 relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.02] p-8 group"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-brand-amber/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="w-10 h-10 rounded-xl bg-brand-amber/20 flex items-center justify-center mb-4 border border-brand-amber/30">
            <GitCompare className="text-brand-amber w-5 h-5" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Cross-Reference</h3>
          <p className="text-ink-3 text-sm">
            Factual claims are automatically cross-checked against 140+ trusted live sources.
          </p>
        </motion.div>

        {/* Wide Feature */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="md:col-span-3 md:row-span-1 relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.02] p-8 flex flex-col md:flex-row items-center justify-between group"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-brand-cyan/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative z-10 md:max-w-xl mb-6 md:mb-0">
            <div className="w-10 h-10 rounded-xl bg-brand-cyan/20 flex items-center justify-center mb-4 border border-brand-cyan/30">
              <Zap className="text-brand-cyan w-5 h-5" />
            </div>
            <h3 className="text-2xl font-semibold mb-2">Lightning Fast Inference</h3>
            <p className="text-ink-3">
              Built on a distributed edge architecture. Your media is analyzed and scored in under 400 milliseconds.
            </p>
          </div>
          
          <div className="relative z-10 flex gap-4">
            <div className="flex flex-col items-center justify-center w-24 h-24 rounded-full border-4 border-brand-cyan/30 text-brand-cyan">
              <span className="text-2xl font-bold">12ms</span>
              <span className="text-xs uppercase tracking-wider">Latency</span>
            </div>
            <div className="flex flex-col items-center justify-center w-24 h-24 rounded-full border-4 border-brand-violet/30 text-brand-violet">
              <span className="text-2xl font-bold">99%</span>
              <span className="text-xs uppercase tracking-wider">Uptime</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
