import { useState, useEffect, useRef } from "react";
import {
  Shield,
  Search,
  PlayCircle,
  Fingerprint,
  Activity,
  Globe,
  Brain,
  CheckCircle2,
  FileText,
  Cpu,
  AlertTriangle,
  ImageIcon,
  Mic,
  Link2,
  Quote,
  Mail,
  Lock,
  ArrowRight,
  Youtube,
  Zap,
  Eye,
  TrendingUp,
} from "lucide-react";
import { motion, useScroll, useTransform, AnimatePresence } from "motion/react";

// ── Animated counter ──────────────────────────────────────────────────────────
function useCounter(target: number, duration = 2000, start = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!start) return;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) { setVal(target); clearInterval(timer); }
      else setVal(Math.floor(current));
    }, duration / steps);
    return () => clearInterval(timer);
  }, [target, duration, start]);
  return val;
}

// ── Typewriter ────────────────────────────────────────────────────────────────
const phrases = ["Fake News Detected.", "Propaganda Identified.", "Claim Verified.", "Manipulation: 87/100."];
function Typewriter() {
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const phrase = phrases[phraseIdx];
    if (!deleting && displayed.length < phrase.length) {
      const t = setTimeout(() => setDisplayed(phrase.slice(0, displayed.length + 1)), 60);
      return () => clearTimeout(t);
    }
    if (!deleting && displayed.length === phrase.length) {
      const t = setTimeout(() => setDeleting(true), 1800);
      return () => clearTimeout(t);
    }
    if (deleting && displayed.length > 0) {
      const t = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 30);
      return () => clearTimeout(t);
    }
    if (deleting && displayed.length === 0) {
      setDeleting(false);
      setPhraseIdx((i) => (i + 1) % phrases.length);
    }
  }, [displayed, deleting, phraseIdx]);

  return (
    <span className="grad-accent font-mono font-bold tracking-tight">
      {displayed}
      <span className="animate-pulse text-primary opacity-50 ml-1">|</span>
    </span>
  );
}

// ── Particle canvas ───────────────────────────────────────────────────────────
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let animId: number;
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener("resize", resize);

    const particles: { x: number; y: number; vx: number; vy: number; r: number }[] = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 1.5 + 0.5,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(195,192,255,0.6)";
        ctx.fill();
      });
      particles.forEach((a, i) => particles.slice(i + 1).forEach((b) => {
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 120) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(195,192,255,${0.12 * (1 - d / 120)})`;
          ctx.stroke();
        }
      }));
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

// ── Nav ───────────────────────────────────────────────────────────────────────
const Nav = () => {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-500 ${scrolled ? "bg-background/80 backdrop-blur-xl border-b border-outline-variant/30 shadow-lg" : "bg-transparent"}`}>
      <div className="flex justify-between items-center px-6 md:px-16 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="bg-primary text-on-primary font-black px-2 py-1 rounded text-sm">G</span>
          <span className="font-bold text-2xl tracking-tighter text-on-surface">GKIN</span>
        </div>
        <div className="hidden md:flex gap-1">
          {[["Product", "#"], ["Analyzer", "/app"], ["Workflow", "#"], ["Extension", "#"]].map(([item, href], idx) => (
            <a key={item} href={href}
              className={`font-mono text-sm px-4 py-2 rounded hover:text-primary transition-colors ${idx === 0 ? "text-primary" : "text-on-surface-variant"}`}>
              {item}
            </a>
          ))}
        </div>
        <div className="flex gap-4 items-center">
          <a href="/app" className="hidden sm:block font-mono text-sm text-on-surface hover:text-primary transition-all">Sign in</a>
          <a href="/app" className="bg-primary text-on-primary px-6 py-2 rounded font-mono text-sm font-bold shadow-[0_0_15px_rgba(79,70,229,0.4)] hover:scale-95 hover:brightness-110 transition-all">
            Start free
          </a>
        </div>
      </div>
    </nav>
  );
};

// ── Hero ──────────────────────────────────────────────────────────────────────
const Hero = () => {
  const [inView, setInView] = useState(false);
  const score = useCounter(72, 1800, inView);
  useEffect(() => { setTimeout(() => setInView(true), 500); }, []);

  return (
    <section className="relative min-h-screen flex items-center pt-24 pb-20 overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none flex justify-center items-center opacity-40">
        <div className="w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] bg-primary/20 blur-[120px] rounded-full mix-blend-screen" />
      </div>

      <div className="relative z-10 w-full px-6 md:px-16 max-w-7xl mx-auto lg:grid lg:grid-cols-2 gap-16 items-center">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} className="space-y-8">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, duration: 0.5, ease: "easeOut" }}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-surface-container-high/40 border border-outline-variant/50 rounded-full backdrop-blur-md shadow-sm">
            <span className="w-2 h-2 rounded-full bg-secondary shadow-[0_0_8px_rgba(52,211,153,0.5)] animate-pulse" />
            <span className="font-mono text-[10px] text-on-surface-variant tracking-widest uppercase font-semibold">Media Forensics · Live</span>
          </motion.div>

          <h1 className="text-5xl md:text-7xl font-extrabold text-balance leading-[1.1] tracking-tight text-on-surface">
            Cut Through the Noise.<br />
            <span className="grad-accent">Detect the Lie.</span>
          </h1>

          <div className="h-8">
            <Typewriter />
          </div>

          <p className="text-on-surface-variant max-w-xl text-lg font-light leading-relaxed">
            Truth Navigator turns articles, screenshots, audio, and competing narratives into a clear read on manipulation, missing context, and source credibility.
          </p>

          <div className="flex flex-wrap gap-4 pt-2">
            <a href="/app" className="bg-primary text-on-primary font-bold px-8 py-4 rounded flex items-center gap-2 hover:brightness-110 hover:scale-[1.02] transition-all glow-border shadow-[0_0_30px_rgba(79,70,229,0.3)]">
              <Search className="w-5 h-5" />
              Analyze an Article
            </a>
            <button className="bg-surface-container-high text-on-surface border border-outline-variant px-8 py-4 rounded flex items-center gap-2 hover:bg-surface-container-highest hover:border-primary/40 transition-all">
              <PlayCircle className="w-5 h-5" />
              Watch Demo
            </button>
          </div>

          <div className="grid grid-cols-3 gap-6 pt-8 border-t border-outline-variant/30">
            {[
              { val: "4 modes", sub: "Text, URL, audio/video, and image analysis." },
              { val: "0-100", sub: "Manipulation and authenticity scoring." },
              { val: "Live chat", sub: "Ask follow-up questions after each scan." },
            ].map((s) => (
              <div key={s.val}>
                <div className="font-mono text-xl font-bold text-on-surface">{s.val}</div>
                <div className="font-mono text-on-surface-variant mt-1 text-[10px] leading-tight opacity-70">{s.sub}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Live analyzer widget */}
        <motion.div
          initial={{ opacity: 0, scale: 0.88, rotate: 3 }}
          animate={{ opacity: 1, scale: 1, rotate: 2 }}
          transition={{ duration: 1.1, delay: 0.3, ease: "easeOut" }}
          className="hidden lg:block relative glass-card p-8 rounded-xl glow-border"
        >
          <div className="flex justify-between items-center border-b border-outline-variant/30 pb-4 mb-6">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary fill-primary/20" />
              <span className="font-mono text-xs tracking-wider text-on-surface-variant">LATEST SCAN</span>
            </div>
            <span className="font-mono text-xs text-on-surface-variant">ID: #4491-GK</span>
          </div>

          <div className="flex items-end justify-between mb-8">
            <div>
              <div className="text-7xl font-bold leading-none text-on-surface tabular-nums">
                {score}<span className="text-2xl text-on-surface-variant font-normal">/100</span>
              </div>
              <div className="font-mono text-xs tracking-widest text-primary mt-2 uppercase font-bold">High Persuasion</div>
            </div>
            <div className="w-24 h-24 relative flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <circle className="stroke-surface-container-highest" cx="18" cy="18" fill="none" r="15" strokeWidth="3" />
                <motion.circle
                  className="stroke-primary" cx="18" cy="18" fill="none" r="15"
                  strokeLinecap="round" strokeWidth="3"
                  initial={{ strokeDasharray: "0, 100" }}
                  animate={{ strokeDasharray: `${score}, 100` }}
                  transition={{ duration: 1.8, delay: 0.5 }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <Brain className="w-8 h-8 text-primary animate-pulse" />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {[
              { label: "Loaded language", pct: 85, color: "bg-error", text: "text-error", status: "strong" },
              { label: "Missing context", pct: 60, color: "bg-tertiary-container", text: "text-tertiary", status: "notable" },
              { label: "Source support", pct: 20, color: "bg-secondary", text: "text-secondary", status: "thin" },
            ].map((bar, i) => (
              <div key={bar.label} className="flex items-center gap-3">
                <span className="font-mono text-[10px] text-on-surface-variant w-28 shrink-0">{bar.label}</span>
                <div className="flex-1 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full ${bar.color} rounded-full`}
                    initial={{ width: 0 }}
                    animate={{ width: `${bar.pct}%` }}
                    transition={{ duration: 1.2, delay: 0.8 + i * 0.15 }}
                  />
                </div>
                <span className={`font-mono text-[10px] font-bold w-12 text-right ${bar.text}`}>{bar.status}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-5 border-t border-outline-variant/30 flex flex-wrap gap-2">
            {["Appeal to Authority", "False Dichotomy", "Ad Hominem"].map((tag) => (
              <span key={tag} className="px-2 py-1 bg-surface-container-high rounded text-[9px] font-mono text-on-surface-variant border border-outline-variant hover:border-primary/50 transition-colors cursor-default">
                {tag}
              </span>
            ))}
          </div>
          <Fingerprint className="absolute -bottom-6 -right-6 w-24 h-24 text-primary opacity-10 rotate-12" />
        </motion.div>
      </div>
    </section>
  );
};

// ── Ticker ────────────────────────────────────────────────────────────────────
const Ticker = () => {
  const items = [
    { icon: <Activity className="w-3 h-3 text-primary animate-pulse" />, text: "DEEPFAKES DETECTED: 12,491" },
    { icon: <Globe className="w-3 h-3 text-primary animate-pulse" />, text: "LIVE SOURCES TRACKED: 840,293" },
    { icon: <Zap className="w-3 h-3 text-primary animate-pulse" />, text: "AVERAGE SCAN TIME: 0.84s" },
    { icon: <CheckCircle2 className="w-3 h-3 text-primary animate-pulse" />, text: "AI CONFIDENCE: 99.4%" },
    { icon: <Youtube className="w-3 h-3 text-primary animate-pulse" />, text: "YOUTUBE VIDEOS ANALYZED: 3,847" },
    { icon: <Globe className="w-3 h-3 text-primary animate-pulse" />, text: "47 LANGUAGES SUPPORTED" },
  ];
  return (
    <section className="bg-surface-container-lowest py-5 border-y border-primary/10 overflow-hidden">
      <div className="flex whitespace-nowrap gap-16 font-mono text-xs text-primary/60 animate-marquee">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex gap-16 shrink-0">
            {items.map((item, j) => (
              <div key={j} className="flex items-center gap-3">
                {item.icon}
                <span className="tracking-widest uppercase">{item.text}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
};

// ── Methodology ───────────────────────────────────────────────────────────────
const Methodology = () => (
  <section className="py-32 px-6 md:px-16 max-w-7xl mx-auto">
    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-20">
      <h2 className="text-4xl font-bold text-on-surface mb-4 uppercase tracking-tight">Forensic Methodology</h2>
      <p className="text-on-surface-variant font-mono text-xs uppercase tracking-[0.3em] opacity-60">Systematic Deconstruction of Digital Narratives</p>
    </motion.div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {[
        { id: "01", title: "Input & Ingest", icon: <FileText className="w-8 h-8" />, desc: "Submit URLs, paste plain text, or upload multimedia. Our system strips styling to analyze raw semantic intent — including YouTube video transcripts in 47 languages." },
        { id: "02", title: "AI Reasoning", icon: <Cpu className="w-8 h-8" />, desc: "Multi-agent LLM analysis using DeepSeek R1 chain-of-thought reasoning cross-references claims against global knowledge bases and detects rhetorical fallacies in real-time." },
        { id: "03", title: "Truth Score", icon: <Shield className="w-8 h-8" />, desc: "Receive a comprehensive integrity report with actionable confidence scores, missing context alerts, source reliability ratings, and a manipulation index from 0–100." },
      ].map((card, idx) => (
        <motion.div
          key={card.id}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: idx * 0.15 }}
          viewport={{ once: true }}
          whileHover={{ y: -6, transition: { duration: 0.3 } }}
          className="glass-card p-10 group relative overflow-hidden cursor-default"
        >
          <div className="absolute top-4 right-6 font-mono text-primary/10 text-7xl font-black select-none">{card.id}</div>
          <div className="text-primary mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">{card.icon}</div>
          <h3 className="text-xl font-bold text-on-surface mb-4">{card.title}</h3>
          <p className="text-on-surface-variant text-sm leading-relaxed mb-8 opacity-80">{card.desc}</p>
          <div className="w-full h-0.5 bg-surface-container-highest overflow-hidden rounded-full">
            <div className="h-full bg-primary w-0 group-hover:w-full transition-all duration-1000 rounded-full" />
          </div>
        </motion.div>
      ))}
    </div>
  </section>
);

// ── Command Center ────────────────────────────────────────────────────────────
const CommandCenter = () => {
  const [inputText, setInputText] = useState("");
  const [scanning, setScanning] = useState(false);
  const [done, setDone] = useState(false);

  const runScan = () => {
    if (!inputText.trim()) return;
    setScanning(true);
    setDone(false);
    setTimeout(() => { setScanning(false); setDone(true); }, 2200);
  };

  return (
    <section className="py-28 bg-surface-container-lowest/50 border-y border-outline-variant/10">
      <div className="px-6 md:px-16 max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-start">
        <div className="space-y-8">
          <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            <h2 className="text-4xl font-bold text-on-surface uppercase tracking-tight mb-2">Live Command Center</h2>
            <p className="text-on-surface-variant">Experience the analyzer in real-time. Input any claim or headline to see the forensic engine in action.</p>
          </motion.div>

          <div className="glass-card overflow-hidden glow-border">
            <div className="bg-surface-container-high px-4 py-2.5 border-b border-outline-variant flex items-center justify-between">
              <span className="font-mono text-[10px] tracking-widest text-on-surface-variant uppercase font-bold">input_stream_analysis</span>
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-error/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-secondary/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-primary/50" />
              </div>
            </div>
            <div className="p-6 relative bg-background/50 min-h-[160px]">
              <span className="absolute top-6 left-6 font-mono text-primary/50 text-xs font-bold">COMMAND &gt;</span>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="w-full bg-transparent border-none outline-none focus:ring-0 text-on-surface font-mono text-sm resize-none pl-24 pt-0 leading-relaxed"
                placeholder="Paste claim or URL here for immediate forensic deconstruction..."
                rows={7}
              />
              {scanning && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  <div className="w-full h-0.5 bg-primary/40 animate-scanline" />
                </div>
              )}
            </div>
            <div className="px-6 py-3 border-t border-outline-variant flex justify-between items-center bg-surface-container-low/50">
              <div className="flex gap-5">
                {[<ImageIcon size={16} />, <Mic size={16} />, <Link2 size={16} />, <Youtube size={16} />].map((icon, i) => (
                  <button key={i} className="text-on-surface-variant hover:text-primary transition-colors">{icon}</button>
                ))}
              </div>
              <button
                onClick={runScan}
                disabled={scanning}
                className="bg-primary text-on-primary px-8 py-2 font-mono text-xs tracking-widest uppercase font-bold hover:brightness-110 transition-all shadow-[0_0_15px_rgba(195,192,255,0.2)] disabled:opacity-60 flex items-center gap-2"
              >
                {scanning ? <><span className="animate-spin">◌</span> Scanning…</> : "Execute Scan"}
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {done ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, x: 30, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              className="glass-card rounded-xl p-10 border-primary/20 relative overflow-hidden"
            >
              <div className="flex items-center gap-6 mb-10">
                <div className="w-20 h-20 rounded-full border-4 border-error flex items-center justify-center bg-error/10">
                  <span className="font-bold text-error text-xl">31%</span>
                </div>
                <div>
                  <h4 className="font-bold text-xl text-on-surface uppercase">Manipulation Index</h4>
                  <p className="font-mono text-[11px] text-error tracking-widest font-extrabold uppercase">High Probability of Distortion</p>
                </div>
              </div>
              <div className="space-y-6">
                <div className="p-5 bg-surface-container-high border-l-4 border-error rounded-r">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-error" />
                    <span className="font-mono text-[11px] text-on-surface uppercase font-bold tracking-wider">Claim Verdict</span>
                  </div>
                  <div className="text-on-surface text-xl font-bold mb-2">"Mostly Unsubstantiated"</div>
                  <p className="text-on-surface-variant text-sm leading-relaxed opacity-80">
                    The claim lacks direct evidentiary support from reputable institutional archives and relies on anecdotal cross-referencing from unverified sources.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-surface-container-low border border-outline-variant rounded">
                    <div className="font-mono text-[9px] text-on-surface-variant mb-2 uppercase font-bold tracking-widest">Bias Orientation</div>
                    <div className="text-on-surface font-bold text-sm">Right-Skewed / Populist</div>
                  </div>
                  <div className="p-4 bg-surface-container-low border border-outline-variant rounded">
                    <div className="font-mono text-[9px] text-on-surface-variant mb-2 uppercase font-bold tracking-widest">Techniques</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {["Ad Hominem", "Cherry-picking"].map((t) => (
                        <span key={t} className="px-2 py-0.5 bg-primary/10 text-primary text-[9px] border border-primary/20 rounded font-mono">{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass-card rounded-xl p-10 border-primary/20 flex flex-col items-center justify-center min-h-[400px] gap-4 text-center"
            >
              <Eye className="w-16 h-16 text-primary/20" />
              <p className="font-mono text-sm text-on-surface-variant opacity-50">Enter text and run scan to see live forensic analysis</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};

// ── Feature slides ────────────────────────────────────────────────────────────
const features = [
  {
    icon: <Youtube className="w-10 h-10" />,
    title: "YouTube Misinformation Scanner",
    desc: "Paste any YouTube URL. GKIN extracts the full video transcript — auto-translated from any language — and runs it through the full detection pipeline.",
    badge: "NEW",
    stat: "47 languages",
  },
  {
    icon: <Globe className="w-10 h-10" />,
    title: "Multilingual Detection",
    desc: "Auto-detect and translate from Hindi, Spanish, Arabic, Russian and more. The analysis pipeline always works in English for maximum accuracy.",
    badge: null,
    stat: "Real-time",
  },
  {
    icon: <CheckCircle2 className="w-10 h-10" />,
    title: "Claim-by-Claim Verification",
    desc: "Every factual claim is extracted and individually verified against real-world sources. Each claim gets an independent verdict: accurate, misleading, or false.",
    badge: null,
    stat: "Per-claim",
  },
  {
    icon: <TrendingUp className="w-10 h-10" />,
    title: "Manipulation Index",
    desc: "A 0–100 composite score built from loaded language, source quality, emotional appeal, missing context, and rhetorical fallacy detection.",
    badge: null,
    stat: "0–100 score",
  },
  {
    icon: <Brain className="w-10 h-10" />,
    title: "AI Authorship Detection",
    desc: "Detect whether an article is AI-generated using linguistic entropy, sentence rhythm, and perplexity scoring — not just a keyword check.",
    badge: null,
    stat: "99.4% acc.",
  },
];

const Features = () => (
  <section className="py-32 px-6 md:px-16 max-w-7xl mx-auto">
    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-20">
      <h2 className="text-4xl font-bold text-on-surface mb-4 uppercase tracking-tight">Detection Arsenal</h2>
      <p className="text-on-surface-variant font-mono text-xs uppercase tracking-[0.3em] opacity-60">Every tool built for modern disinformation</p>
    </motion.div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {features.map((f, i) => (
        <motion.div
          key={f.title}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          viewport={{ once: true }}
          whileHover={{ y: -4 }}
          className="glass-card p-8 group relative overflow-hidden cursor-default"
        >
          {f.badge && (
            <span className="absolute top-4 right-4 bg-secondary text-on-secondary text-[9px] font-mono font-bold px-2 py-0.5 rounded-full">{f.badge}</span>
          )}
          <div className="text-primary mb-5 group-hover:scale-110 transition-transform duration-300">{f.icon}</div>
          <h3 className="text-base font-bold text-on-surface mb-3">{f.title}</h3>
          <p className="text-on-surface-variant text-sm leading-relaxed opacity-75 mb-5">{f.desc}</p>
          <div className="font-mono text-[10px] text-primary border border-primary/20 bg-primary/5 px-3 py-1 rounded-full inline-block">{f.stat}</div>
        </motion.div>
      ))}
    </div>
  </section>
);

// ── Threat Map ────────────────────────────────────────────────────────────────
const ThreatMap = () => (
  <section className="py-28 px-6 md:px-16 max-w-7xl mx-auto overflow-hidden relative">
    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
      <h2 className="text-4xl font-bold text-on-surface mb-2 uppercase tracking-tighter">Global Threat Landscape</h2>
      <p className="text-on-surface-variant font-mono text-xs uppercase tracking-widest opacity-60">Real-time Monitoring of Disinformation Campaigns</p>
    </motion.div>

    <div className="relative w-full aspect-[21/9] glass-card rounded-2xl overflow-hidden glow-border">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
      {/* Grid lines */}
      <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgb(195,192,255)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background" />

      {/* Hotspots */}
      {[
        { top: "28%", left: "18%", color: "bg-error", label: "North America", risk: "High" },
        { top: "42%", left: "52%", color: "bg-secondary", label: "Central Asia", risk: "Verified" },
        { top: "60%", left: "78%", color: "bg-primary", label: "Southeast Asia", risk: "Pending" },
        { top: "35%", left: "46%", color: "bg-error", label: "Eastern Europe", risk: "High" },
        { top: "55%", left: "30%", color: "bg-tertiary", label: "South America", risk: "Medium" },
      ].map((h, i) => (
        <div key={i} className="absolute group/dot" style={{ top: h.top, left: h.left }}>
          <div className={`w-3 h-3 ${h.color} rounded-full animate-ping absolute opacity-60`} />
          <div className={`w-3 h-3 ${h.color} rounded-full relative cursor-pointer`} />
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-background/90 border border-outline-variant px-3 py-1.5 rounded text-[9px] font-mono whitespace-nowrap opacity-0 group-hover/dot:opacity-100 transition-opacity pointer-events-none backdrop-blur-sm z-10">
            <div className="font-bold text-on-surface">{h.label}</div>
            <div className={`${h.color.replace("bg-", "text-")} font-bold`}>{h.risk} Risk</div>
          </div>
        </div>
      ))}

      <div className="absolute bottom-5 left-5 flex items-center gap-5 bg-background/80 px-5 py-2.5 rounded-full border border-outline-variant backdrop-blur-md">
        {[["bg-error", "High Risk"], ["bg-secondary", "Verified"], ["bg-primary", "Pending"], ["bg-tertiary", "Medium"]].map(([c, l]) => (
          <div key={l} className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${c}`} />
            <span className="text-[10px] font-mono font-bold uppercase">{l}</span>
          </div>
        ))}
      </div>

      {/* Scanning line */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="w-full h-0.5 bg-primary/15 absolute top-0 animate-scanline" />
      </div>
    </div>
  </section>
);

// ── Testimonials ──────────────────────────────────────────────────────────────
const Testimonials = () => (
  <section className="py-28 px-6 md:px-16 max-w-7xl mx-auto">
    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
      <h2 className="text-4xl font-bold text-on-surface mb-4 uppercase tracking-tight">Trusted by Investigators</h2>
      <p className="text-on-surface-variant font-mono text-xs uppercase tracking-[0.3em] opacity-60">From journalists to researchers</p>
    </motion.div>
    <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-2 gap-5">
      <motion.div whileHover={{ y: -5 }} className="md:col-span-2 md:row-span-2 glass-card p-10 flex flex-col justify-between group cursor-default">
        <Quote className="w-10 h-10 text-primary opacity-25 group-hover:scale-110 transition-transform" />
        <div className="space-y-6 mt-6">
          <p className="text-2xl font-bold text-on-surface italic leading-snug">
            "In an era where deepfakes can spark geopolitical crises, GKIN is the only tool that provides the cold, hard data needed to verify information in seconds, not hours."
          </p>
          <div className="flex items-center gap-4 border-t border-outline-variant/30 pt-5">
            <div className="w-10 h-10 rounded bg-surface-container-highest flex items-center justify-center font-bold text-primary text-sm glow-border">EJ</div>
            <div>
              <div className="text-sm text-on-surface font-bold">Elena J.</div>
              <div className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest">Senior Investigative Journalist</div>
            </div>
          </div>
        </div>
      </motion.div>

      {[
        { quote: "I used GKIN to verify historical citations for my thesis. It caught three 'reputable' sources that were actually circular-referencing AI hallucinations.", by: "Ph.D. Candidate, Digital History" },
        { quote: "The multilingual detection is light years ahead. Hindi, Arabic, Russian — it handles them all without breaking the analysis pipeline.", by: "News Desk Manager" },
        { quote: "Integrated GKIN into our corporate risk workflow. Essential for OSINT investigations.", by: "Cybersecurity Analyst" },
      ].map((t, i) => (
        <motion.div
          key={i}
          whileHover={{ y: -3 }}
          className={`glass-card p-7 flex flex-col justify-between cursor-default ${i === 2 ? "bg-primary-container/10 border-primary/30" : ""}`}
        >
          <p className="text-on-surface-variant text-sm leading-relaxed opacity-80 italic">"{t.quote}"</p>
          <span className="font-mono text-[9px] text-primary font-bold uppercase tracking-widest mt-4">{t.by}</span>
        </motion.div>
      ))}
    </div>
  </section>
);

// ── Footer ────────────────────────────────────────────────────────────────────
const Footer = () => (
  <footer className="relative bg-surface-container-lowest border-t border-primary/20 pt-24">
    <div className="max-w-7xl mx-auto px-6 md:px-16 overflow-hidden">
      <motion.div whileInView={{ opacity: 1, scale: 1 }} initial={{ opacity: 0, scale: 0.95 }} viewport={{ once: true }}
        className="max-w-2xl mx-auto text-center mb-20 space-y-7">
        <h2 className="text-5xl font-bold text-on-surface uppercase tracking-tight">Master the Truth.</h2>
        <p className="text-on-surface-variant text-lg">Join the front lines of digital forensics. Get weekly insights on disinformation trends and early access to new GKIN modules.</p>
        <form className="flex flex-col sm:flex-row gap-3" onSubmit={(e) => e.preventDefault()}>
          <div className="flex-1 relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-primary/40 text-[9px] font-bold pointer-events-none">EMAIL ://</span>
            <input type="email" className="w-full bg-surface-container-highest/30 border-b-2 border-primary/30 focus:border-primary focus:outline-none text-on-surface font-mono pl-24 py-4 rounded-sm transition-colors" placeholder="identity@domain.com" />
          </div>
          <button type="submit" className="bg-primary text-on-primary font-bold px-10 py-4 rounded-sm hover:scale-95 transition-all shadow-[0_0_20px_rgba(195,192,255,0.4)] flex items-center justify-center gap-2">
            ENLIST <ArrowRight size={14} />
          </button>
        </form>
        <div className="flex justify-center gap-8 opacity-30 text-[9px] font-mono font-bold tracking-[0.2em]">
          <span className="flex items-center gap-1.5"><Lock size={9} /> ENCRYPTED END-TO-END</span>
          <span>ZERO DATA RETENTION</span>
        </div>
      </motion.div>

      <div className="flex flex-col md:flex-row justify-between items-center py-10 gap-6 border-t border-outline-variant/10">
        <div className="flex items-center gap-2">
          <span className="bg-primary text-on-primary font-black px-1.5 py-0.5 text-xs rounded">G</span>
          <span className="font-bold text-primary text-lg uppercase tracking-tighter">GKIN</span>
        </div>
        <div className="flex flex-wrap justify-center gap-5 font-mono text-[9px] text-outline font-bold uppercase tracking-widest">
          {["Privacy Policy", "Terms of Service", "Security Protocol", "Contact Command"].map((l) => (
            <a key={l} href="#" className="hover:text-secondary transition-colors">{l}</a>
          ))}
        </div>
        <p className="font-mono text-[9px] text-outline/50 font-bold">© {new Date().getFullYear()} GKIN Forensic Systems. All rights reserved.</p>
      </div>
    </div>
  </footer>
);

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <div className="min-h-screen relative mesh-bg bg-background text-on-background selection:bg-primary/30">
      <div className="fixed inset-0 pointer-events-none z-[60] grain mix-blend-overlay opacity-30" />
      <div className="relative z-10">
        <Nav />
        <Hero />
        <Ticker />
        <Methodology />
        <CommandCenter />
        <Features />
        <ThreatMap />
        <Testimonials />
        <Footer />
      </div>
    </div>
  );
}
