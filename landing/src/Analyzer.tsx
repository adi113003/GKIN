import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Shield, Search, Network, Brain, BarChart3, ScrollText,
  ArrowRight, Upload,
  Clock, Loader2, Lock, User, Mail,
  Eye, EyeOff, X, Radio, Zap, FileText, Mic,
  MessageSquare, RefreshCw, AlertTriangle,
  Link as LinkIcon, GitBranch, ChevronDown, ChevronRight,
} from "lucide-react";
import { PromptInputBox } from "@/components/ui/ai-prompt-box";

// ── Palette ───────────────────────────────────────────────────────────────────
// Premium SaaS Dark Mode Ramp
const P = {
  bg:       "#09090b",
  nav:      "rgba(9,9,11,0.72)",       // glass over mesh
  card:     "rgba(24,24,27,0.5)",
  panel:    "rgba(24,24,27,0.4)",
  border:   "rgba(255,255,255,0.06)",
  border2:  "rgba(255,255,255,0.12)",
  border3:  "rgba(255,255,255,0.20)",
  accent:    "#818cf8",                // primary (indigo)
  accentCyan:"#38bdf8",                // cyan
  accentRose:"#fb7185",                // rose
  accentDim: "rgba(129,140,248,0.12)",
  accentGlow:"rgba(129,140,248,0.28)",
  text:     "#fafafa",                 // ink-DEFAULT
  text2:    "#d4d4d8",                 // ink-2
  muted:    "#a1a1aa",                 // ink-3
  faint:    "#52525b",                 // ink-5
  body:     "#d4d4d8",
  green:    "#34d399",                 // emerald
  red:      "#f87171",                 // red
  yellow:   "#fbbf24",                 // amber
  blue:     "#60a5fa",                 // blue
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface PersuasionTechnique { technique: string; span?: string; explanation?: string; }
interface ContextGap { gap: string; why_it_matters?: string; }
interface Claim {
  text: string;
  type?: string;
  verification?: { verdict: string; explanation: string };
  citation_ids?: number[];
}
interface SourceUsed {
  url: string;
  hostname: string;
  title: string;
  published_date: string | null;
  claim_supported: string;
  relevance_snippet: string;
  tier?: number;
  trusted?: boolean;
}
interface TimelineEntry { date: string; hostname: string; url: string; how_claim_changed: string; }
interface ClaimTimeline { claim: string; first_reported: string; timeline_entries: TimelineEntry[]; }
interface AnalysisResult {
  summary?: string;
  manipulation_index?: number;
  claims?: Claim[];
  persuasion_techniques?: PersuasionTechnique[];
  emotion_scores?: Record<string, number>;
  narrative_cluster?: string;
  bias_orientation?: string;
  missing_context?: ContextGap[];
  sources_used?: SourceUsed[];
  fake_detection?: {
    verdict?: string; confidence?: number; fake_confidence?: number;
    trust_rating?: number; explanation?: string; reasoning?: string;
    red_flags?: string[]; trust_signals?: string[];
    sources_used?: SourceUsed[];
  };
  ai_detection?: { verdict?: string; score?: number; ai_confidence?: number; explanation?: string; };
  reasoning_trace?: string;
  source_language?: string;
  _article_text?: string;  // cached for /timeline lazy fetch (not from server)
}
interface Investigation { id: string; snippet: string; timestamp: number; verdict: string; result: AnalysisResult; }
interface ChatMsg { role: "user" | "assistant"; content: string; }

// ── Auth ──────────────────────────────────────────────────────────────────────
const getToken  = () => localStorage.getItem("gkin_token") || "";
const getUser   = () => localStorage.getItem("gkin_user") || "guest";
const setAuth   = (t: string, u: string) => { localStorage.setItem("gkin_token", t); localStorage.setItem("gkin_user", u); };
const clearAuth = () => { localStorage.removeItem("gkin_token"); localStorage.removeItem("gkin_user"); };
const invKey    = (u: string) => `gkin_inv_${u || "guest"}`;
async function apiFetch(path: string, opts: RequestInit = {}) {
  return fetch(path, { ...opts, headers: { "Content-Type": "application/json", ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}), ...opts.headers } });
}

// ── Gauge ─────────────────────────────────────────────────────────────────────
function Gauge({ score }: { score: number }) {
  const r = 52, circ = 2 * Math.PI * r, dash = (score / 100) * circ;
  const color = score >= 70 ? P.red : score >= 40 ? P.yellow : P.green;
  const level = score >= 70 ? "HIGH" : score >= 40 ? "MEDIUM" : "LOW";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ position: "relative", width: 140, height: 140, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="140" height="140" style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
          <circle cx="70" cy="70" r={r} fill="none" stroke={P.border} strokeWidth="8" />
          <motion.circle cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
            initial={{ strokeDasharray: "0 999" }} animate={{ strokeDasharray: `${dash} ${circ}` }}
            transition={{ duration: 1.4, ease: "easeOut" }} />
        </svg>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 36, fontWeight: 700, color: P.text, lineHeight: 1 }}>{score}</div>
          <div style={{ fontSize: 9, color, letterSpacing: "0.1em", fontWeight: 700, marginTop: 4 }}>THREAT: {level}</div>
        </div>
      </div>
    </div>
  );
}

// ── Persuasion network ────────────────────────────────────────────────────────
function PersuasionNet({ techniques }: { techniques: PersuasionTechnique[] }) {
  const nodes = useMemo(() => {
    const seed = techniques.length;
    return Array.from({ length: 10 }, (_, i) => ({
      x: 20 + ((i * 73 + seed * 17) % 200),
      y: 15 + ((i * 47 + seed * 31) % 70),
    }));
  }, [techniques]);
  const edges = useMemo(() =>
    nodes.flatMap((a, i) => nodes.slice(i + 1).filter((_, j) => (i + j) % 3 !== 0)
      .map((b, j) => ({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, key: `${i}-${j}` }))
    ), [nodes]);
  return (
    <div style={{ background: "rgba(10,9,24,0.6)", borderRadius: 4, overflow: "hidden" }}>
      <svg width="100%" height={100} viewBox="0 0 240 100">
        {edges.map(e => <line key={e.key} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke="rgba(155,123,255,0.1)" strokeWidth="0.8" />)}
        {nodes.map((n, i) => (
          <circle key={i} cx={n.x} cy={n.y} r={i === 0 ? 7 : 4}
            fill={i === 0 ? "rgba(155,123,255,0.25)" : "rgba(165,180,252,0.2)"}
            stroke={i === 0 ? P.accent : "rgba(165,180,252,0.5)"} strokeWidth="1" />
        ))}
      </svg>
    </div>
  );
}

// ── Narrative source map modal ────────────────────────────────────────────────
function NarrativeModal({ claimTimeline, timelineLoading, timelineError, onBuildTimeline, onClose }: {
  claimTimeline: ClaimTimeline[] | null;
  timelineLoading: boolean;
  timelineError: string;
  onBuildTimeline: () => void;
  onClose: () => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const W = 720, H = 480, cx = W / 2, cy = H / 2;

  // Flatten all timeline entries from all claims into one list of nodes
  const nodes = useMemo(() => {
    if (!claimTimeline) return [];
    return claimTimeline.flatMap((ct, ci) =>
      ct.timeline_entries.map((e, ei) => ({ ...e, claim: ct.claim, claimIdx: ci, entryIdx: ei }))
    );
  }, [claimTimeline]);

  // Arrange nodes in a circle
  const positioned = useMemo(() => {
    const n = Math.max(nodes.length, 1);
    return nodes.map((node, i) => {
      const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
      const r = n <= 6 ? 175 : n <= 12 ? 195 : 210;
      return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), node };
    });
  }, [nodes]);

  // Claim color palette
  const claimColors = ["#9b7bff", "#5dd9ff", "#ff6b8b", "#4ade80", "#ffb547", "#a5b4fc"];

  // Auto-trigger build if not loaded
  useEffect(() => {
    if (!claimTimeline && !timelineLoading && !timelineError) {
      onBuildTimeline();
    }
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <motion.div initial={{ scale: 0.88, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.88, opacity: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 26 }}
        onClick={e => e.stopPropagation()}
        style={{ background: "#0d0c1a", border: `1px solid ${P.border2}`, borderRadius: 14, overflow: "hidden", width: 820, maxWidth: "95vw", maxHeight: "92vh", display: "flex", flexDirection: "column" }}>

        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: `1px solid ${P.border}` }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: P.text, letterSpacing: "0.1em" }}>CLAIM PROPAGATION TIMELINE</div>
            <div style={{ fontSize: 9, color: P.muted, letterSpacing: "0.06em", marginTop: 3 }}>
              {nodes.length > 0 ? `${nodes.length} source node${nodes.length !== 1 ? "s" : ""} across ${claimTimeline?.length ?? 0} claim${(claimTimeline?.length ?? 0) !== 1 ? "s" : ""} · click any node to open` : "Building timeline…"}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: P.muted, cursor: "pointer", padding: 4 }}><X size={15} /></button>
        </div>

        {/* loading */}
        {timelineLoading && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 40 }}>
            <Loader2 size={28} style={{ animation: "spin 1s linear infinite", color: P.accent }} />
            <div style={{ fontSize: 11, color: P.muted, letterSpacing: "0.08em" }}>TRACING CLAIM PROPAGATION…</div>
            <div style={{ fontSize: 9, color: P.faint }}>Running deeper web scrape — usually 6–10 seconds</div>
          </div>
        )}

        {/* error */}
        {!timelineLoading && timelineError && (
          <div style={{ padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: P.red, marginBottom: 14 }}>{timelineError}</div>
            <button onClick={onBuildTimeline} style={{ ...{ background: P.accent, border: "none", color: "#0a0a0f", fontFamily: "inherit", fontSize: 10, letterSpacing: "0.1em", fontWeight: 700, padding: "9px 18px", borderRadius: 4, cursor: "pointer" } }}>RETRY</button>
          </div>
        )}

        {/* no data yet prompt */}
        {!timelineLoading && !timelineError && claimTimeline === null && (
          <div style={{ padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: P.muted, marginBottom: 14 }}>Starting timeline trace…</div>
          </div>
        )}

        {/* graph */}
        {!timelineLoading && nodes.length > 0 && (
          <div style={{ padding: "16px 20px 0", flex: 1, overflow: "hidden" }}>
            <svg width="100%" viewBox={`0 0 ${W} ${H}`}
              style={{ background: "rgba(8,7,20,0.9)", borderRadius: 8, display: "block" }}>

              {/* edges: center → each node */}
              {positioned.map((p, i) => {
                const col = claimColors[p.node.claimIdx % claimColors.length];
                return (
                  <line key={`e-${i}`} x1={cx} y1={cy} x2={p.x} y2={p.y}
                    stroke={hovered === i ? col : `${col}22`}
                    strokeWidth={hovered === i ? 1.8 : 0.8}
                    strokeDasharray={hovered === i ? "none" : "4 3"} />
                );
              })}

              {/* timeline nodes */}
              {positioned.map((p, i) => {
                const isHov = hovered === i;
                const col = claimColors[p.node.claimIdx % claimColors.length];
                const host = (p.node.hostname || "").replace(/^www\./, "").slice(0, 13);
                return (
                  <g key={`n-${i}`} style={{ cursor: "pointer" }}
                    onClick={() => window.open(p.node.url, "_blank", "noopener")}
                    onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
                    {/* glow ring on hover */}
                    {isHov && <circle cx={p.x} cy={p.y} r={32} fill="none" stroke={col} strokeWidth="1" opacity="0.3" />}
                    <circle cx={p.x} cy={p.y} r={isHov ? 26 : 22}
                      fill={isHov ? `${col}33` : `${col}14`}
                      stroke={col} strokeWidth={isHov ? 1.8 : 1} />
                    {/* hostname */}
                    <text x={p.x} y={p.y - 3} textAnchor="middle" dominantBaseline="middle"
                      fill={isHov ? "#fff" : P.text2} fontSize={isHov ? "8.5" : "7.5"}
                      fontWeight={isHov ? "bold" : "normal"}
                      style={{ pointerEvents: "none" }}>
                      {host}
                    </text>
                    {/* date */}
                    {p.node.date && (
                      <text x={p.x} y={p.y + 9} textAnchor="middle"
                        fill={P.faint} fontSize="6"
                        style={{ pointerEvents: "none" }}>
                        {p.node.date.slice(0, 10)}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* center node */}
              <circle cx={cx} cy={cy} r={30}
                fill="rgba(155,123,255,0.25)" stroke={P.accent} strokeWidth="2.5" />
              <text x={cx} y={cy - 6} textAnchor="middle" fill={P.text} fontSize="10" fontWeight="bold" style={{ pointerEvents: "none" }}>ARTICLE</text>
              <text x={cx} y={cy + 8} textAnchor="middle" fill={P.muted} fontSize="7" style={{ pointerEvents: "none" }}>ORIGIN</text>
            </svg>
          </div>
        )}

        {/* empty state */}
        {!timelineLoading && !timelineError && claimTimeline !== null && nodes.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", fontSize: 11, color: P.faint, letterSpacing: "0.06em" }}>
            NO TIMELINE ENTRIES FOUND FOR THIS ARTICLE
          </div>
        )}

        {/* link list at bottom */}
        {nodes.length > 0 && (
          <div style={{ borderTop: `1px solid ${P.border}`, padding: "10px 20px", display: "flex", flexWrap: "wrap", gap: 6, overflowY: "auto", maxHeight: 110 }}>
            {positioned.map((p, i) => {
              const col = claimColors[p.node.claimIdx % claimColors.length];
              return (
                <a key={i} href={p.node.url} target="_blank" rel="noopener noreferrer"
                  onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
                  style={{ fontSize: 9, color: hovered === i ? "#fff" : P.muted, background: hovered === i ? `${col}22` : P.panel, border: `1px solid ${hovered === i ? col : P.border}`, borderRadius: 4, padding: "4px 9px", textDecoration: "none", display: "flex", alignItems: "center", gap: 5, transition: "all 0.12s" }}>
                  <span style={{ color: col, fontWeight: 700 }}>●</span>
                  {(p.node.hostname || p.node.url).replace(/^www\./, "").slice(0, 25)}
                  {p.node.date && <span style={{ color: P.faint, fontSize: 8 }}>{p.node.date.slice(0, 7)}</span>}
                </a>
              );
            })}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ── Emotion bars ──────────────────────────────────────────────────────────────
function EmotionBars({ scores }: { scores: Record<string, number> }) {
  const order = ["fear", "anger", "disgust", "hope", "guilt", "ingroup_framing"];
  const colors: Record<string, string> = {
    fear: "#ef4444", anger: "#f97316", disgust: "#a855f7",
    hope: "#4ae176", guilt: "#fbbf24", ingroup_framing: "#a5b4fc",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {order.map(k => {
        const val = scores[k] ?? 0, color = colors[k] || P.accent;
        return (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 9, color: P.muted, letterSpacing: "0.08em", width: 100, flexShrink: 0, textTransform: "uppercase" }}>
              {k.replace(/_/g, " ")}
            </span>
            <div style={{ flex: 1, height: 4, background: P.border, borderRadius: 2, overflow: "hidden" }}>
              <motion.div style={{ height: "100%", background: color, borderRadius: 2 }}
                initial={{ width: 0 }} animate={{ width: `${val}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }} />
            </div>
            <span style={{ fontSize: 9, color: P.text2, width: 24, textAlign: "right", fontWeight: 700 }}>{val}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Login Modal ───────────────────────────────────────────────────────────────
function LoginModal({ onClose, onAuth }: { onClose: () => void; onAuth: (t: string, u: string) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState(""), [email, setEmail] = useState(""), [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState("");

  const inp: React.CSSProperties = { width: "100%", background: P.bg, border: `1px solid ${P.border2}`, borderRadius: 4, padding: "10px 12px 10px 34px", color: P.text, fontSize: 11, letterSpacing: "0.06em", outline: "none", fontFamily: "inherit" };

  const submit = async () => {
    setError(""); setLoading(true);
    try {
      const body = mode === "login" ? { username, password } : { username, email, password };
      const r = await fetch(`/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) { setError((await r.text()) || "Authentication failed"); return; }
      const d = await r.json(); onAuth(d.token, d.username); onClose();
    } catch { setError("Connection error"); } finally { setLoading(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
      <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
        style={{ width: 360, background: P.card, border: `1px solid ${P.border2}`, borderRadius: 8, padding: 28, boxShadow: `0 0 40px rgba(155,123,255,0.08)` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <span style={{ fontSize: 11, letterSpacing: "0.12em", color: P.accent, fontWeight: 700 }}>
            {mode === "login" ? "AUTHENTICATE" : "REGISTER AGENT"}
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: P.muted, cursor: "pointer", padding: 4 }}><X size={16} /></button>
        </div>
        {error && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 3, padding: "8px 12px", fontSize: 10, color: "#ff6b6b", marginBottom: 14 }}>{error}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ position: "relative" }}>
            <User size={12} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: P.muted, pointerEvents: "none" }} />
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="USERNAME" style={inp} onKeyDown={e => e.key === "Enter" && submit()} />
          </div>
          {mode === "register" && (
            <div style={{ position: "relative" }}>
              <Mail size={12} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: P.muted, pointerEvents: "none" }} />
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="EMAIL" type="email" style={inp} />
            </div>
          )}
          <div style={{ position: "relative" }}>
            <Lock size={12} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: P.muted, pointerEvents: "none" }} />
            <input value={password} onChange={e => setPassword(e.target.value)} placeholder="PASSWORD"
              type={showPw ? "text" : "password"} style={{ ...inp, paddingRight: 34 }} onKeyDown={e => e.key === "Enter" && submit()} />
            <button onClick={() => setShowPw(v => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: P.muted, cursor: "pointer", padding: 2 }}>
              {showPw ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>
          </div>
          <button onClick={submit} disabled={loading}
            style={{ background: P.accent, border: "none", color: "#0a0a0f", fontFamily: "inherit", fontSize: 10, letterSpacing: "0.1em", fontWeight: 700, padding: "11px", borderRadius: 4, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {loading && <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />}
            {loading ? "AUTHENTICATING…" : mode === "login" ? "LOG IN" : "CREATE ACCOUNT"}
          </button>
        </div>
        <div style={{ marginTop: 14, textAlign: "center", fontSize: 10, color: P.muted }}>
          {mode === "login" ? "No account? " : "Have an account? "}
          <button onClick={() => { setMode(m => m === "login" ? "register" : "login"); setError(""); }}
            style={{ background: "none", border: "none", color: P.accent, cursor: "pointer", fontFamily: "inherit", fontSize: 10 }}>
            {mode === "login" ? "REGISTER" : "LOGIN"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Analyzer() {
  const [token, setToken]       = useState(() => getToken());
  const [username, setUsername] = useState(() => getUser());
  const [showLogin, setShowLogin]     = useState(false);
  const [activeNav, setActiveNav]     = useState("neural");
  const [activeTab, setActiveTab]     = useState<"TEXT" | "URL" | "MEDIA">("TEXT");
  const [showArchives, setShowArchives]         = useState(false);
  const [showNarrativeModal, setShowNarrativeModal] = useState(false);
  const [input, setInput]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [loadingMsg, setLoadingMsg]   = useState("INITIALIZING");
  const [result, setResult]           = useState<AnalysisResult | null>(null);
  const [fetchedTitle, setFetchedTitle] = useState("");
  const [langBadge, setLangBadge]     = useState("");
  const [investigations, setInvestigations] = useState<Investigation[]>(() => {
    try { return JSON.parse(localStorage.getItem(invKey(getUser())) || "[]"); } catch { return []; }
  });

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput]       = useState("");
  const [chatMode, setChatMode]         = useState<"context" | "open" | "conspiracy">("context");
  const [chatLoading, setChatLoading]   = useState(false);
  const [suggestions, setSuggestions]   = useState<string[]>([]);

  // Claim timeline (lazy-loaded so /analyze stays under 1.8s)
  const [claimTimeline, setClaimTimeline] = useState<ClaimTimeline[] | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState("");
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [expandedSrc, setExpandedSrc] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  const handleAuth = (t: string, u: string) => {
    setAuth(t, u); setToken(t); setUsername(u);
    try { setInvestigations(JSON.parse(localStorage.getItem(invKey(u)) || "[]")); } catch { setInvestigations([]); }
  };
  const handleLogout = () => { clearAuth(); window.location.href = "/"; };

  const saveInvestigation = useCallback((res: AnalysisResult, snippet: string) => {
    const verdict =
      res.fake_detection?.verdict === "fake" ? "DECEPTIVE" :
      (res.manipulation_index ?? 0) > 60      ? "UNDER_REVIEW" : "VERIFIED";
    const inv: Investigation = {
      id: `DX-${Math.floor(Math.random() * 9000) + 1000}`,
      snippet: snippet.slice(0, 90), timestamp: Date.now(), verdict, result: res,
    };
    setInvestigations(prev => {
      const next = [inv, ...prev].slice(0, 100);
      localStorage.setItem(invKey(getUser()), JSON.stringify(next));
      return next;
    });
  }, []);

  const fetchSuggestions = useCallback(async (res: AnalysisResult) => {
    try {
      const r = await apiFetch("/suggestions", { method: "POST", body: JSON.stringify({ analysis: res }) });
      if (!r.ok) return;
      const d = await r.json();
      setSuggestions((d.suggestions || []).slice(0, 4));
    } catch { /* silent */ }
  }, []);

  const buildClaimTimeline = useCallback(async () => {
    if (!result || timelineLoading) return;
    const article = result._article_text
      || result.summary
      || (result.claims || []).map(c => c.text).join(". ")
      || "";
    if (article.length < 100) {
      setTimelineError("Not enough article context to build a timeline. Re-run the scan with the article URL.");
      return;
    }
    setTimelineLoading(true); setTimelineError("");
    try {
      const r = await apiFetch("/timeline", { method: "POST", body: JSON.stringify({ article }) });
      if (r.status === 401) { setShowLogin(true); return; }
      if (!r.ok) throw new Error(await r.text());
      const d = await r.json();
      setClaimTimeline(d.claim_timeline || []);
      // If /analyze had no sources_used (e.g. older cached investigation), borrow from /timeline.
      if (!result.sources_used?.length && Array.isArray(d.sources_used) && d.sources_used.length) {
        setResult(prev => prev ? { ...prev, sources_used: d.sources_used } : prev);
      }
    } catch (e) {
      setTimelineError("Could not build timeline: " + (e instanceof Error ? e.message : String(e)));
    } finally { setTimelineLoading(false); }
  }, [result, timelineLoading]);

  const executeScan = async (overrideText?: string) => {
    if (!token) { setShowLogin(true); return; }
    const sourceText = overrideText ?? input;
    if (!sourceText.trim()) return;
    setLoading(true); setResult(null); setFetchedTitle(""); setLangBadge("");
    setChatMessages([]); setSuggestions([]);
    setClaimTimeline(null); setTimelineError(""); setTimelineOpen(false); setExpandedSrc(null);
    try {
      let articleText = sourceText, displayTitle = "";
      if (activeTab === "URL" && !overrideText) {
        setLoadingMsg("FETCHING EVIDENCE");
        const r = await apiFetch("/fetch-url", { method: "POST", body: JSON.stringify({ url: sourceText }) });
        if (r.status === 401) { setShowLogin(true); return; }
        if (!r.ok) throw new Error(await r.text());
        const d = await r.json();
        articleText = d.text; displayTitle = d.title || sourceText;
        if (d.source_language && d.source_language !== "English") setLangBadge(d.source_language);
        setFetchedTitle(displayTitle);
      }
      setLoadingMsg("RUNNING NEURAL SCAN");
      const r2 = await apiFetch("/analyze", { method: "POST", body: JSON.stringify({ article: articleText }) });
      if (r2.status === 401) { setShowLogin(true); return; }
      if (!r2.ok) throw new Error(await r2.text());
      const analysis: AnalysisResult = await r2.json();
      saveInvestigation(analysis, displayTitle || sourceText);
      analysis._article_text = articleText;  // for lazy /timeline lookup (not persisted)
      setResult(analysis);
      setActiveNav("neural");
      fetchSuggestions(analysis);
    } catch (e: unknown) {
      alert("SCAN ERROR: " + (e instanceof Error ? e.message : String(e)));
    } finally { setLoading(false); }
  };

  // ── Ingestion-hub: Upload / Mic / Link / Youtube ──
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isRecording, setIsRecording]   = useState(false);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recStreamRef = useRef<MediaStream | null>(null);

  const openFilePicker = () => {
    if (!token) { setShowLogin(true); return; }
    fileInputRef.current?.click();
  };

  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";  // allow re-selecting the same file
    if (!file) return;
    const name = file.name.toLowerCase();
    const type = file.type || "";

    // Image → /analyze-image (returns full analysis directly)
    if (type.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp)$/.test(name)) {
      if (!token) { setShowLogin(true); return; }
      setLoading(true); setLoadingMsg("READING IMAGE"); setResult(null);
      setFetchedTitle(file.name); setChatMessages([]); setSuggestions([]);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const r = await fetch("/analyze-image", { method: "POST", headers: { Authorization: `Bearer ${getToken()}` }, body: fd });
        if (r.status === 401) { setShowLogin(true); return; }
        if (!r.ok) throw new Error(await r.text());
        const analysis: AnalysisResult = await r.json();
        setResult(analysis);
        saveInvestigation(analysis, file.name);
        setActiveNav("neural");
        fetchSuggestions(analysis);
      } catch (err) {
        alert("IMAGE SCAN ERROR: " + (err instanceof Error ? err.message : String(err)));
      } finally { setLoading(false); }
      return;
    }

    // Audio → /transcribe → fill input → executeScan
    if (type.startsWith("audio/") || /\.(mp3|wav|m4a|ogg|webm|mp4|flac)$/.test(name)) {
      await transcribeAndScan(file, file.name);
      return;
    }

    // Text / markdown → read as text into the input box
    if (type.startsWith("text/") || /\.(txt|md|rtf|csv)$/.test(name)) {
      const text = await file.text();
      setActiveTab("TEXT");
      setInput(text);
      setFetchedTitle(file.name);
      return;
    }

    alert(`Unsupported file type: ${file.name}\nSupported: text, images (jpg/png/webp), audio (mp3/wav/m4a/webm).`);
  };

  const transcribeAndScan = async (blob: Blob, label: string) => {
    if (!token) { setShowLogin(true); return; }
    setLoading(true); setLoadingMsg("TRANSCRIBING AUDIO"); setResult(null);
    setChatMessages([]); setSuggestions([]);
    try {
      const fd = new FormData();
      const fileForUpload = blob instanceof File ? blob : new File([blob], label, { type: blob.type || "audio/webm" });
      fd.append("file", fileForUpload);
      const r = await fetch("/transcribe", { method: "POST", headers: { Authorization: `Bearer ${getToken()}` }, body: fd });
      if (r.status === 401) { setShowLogin(true); return; }
      if (!r.ok) throw new Error(await r.text());
      const { transcript } = await r.json();
      if (!transcript || !transcript.trim()) { alert("No speech detected."); return; }
      setActiveTab("TEXT");
      setInput(transcript);
      setFetchedTitle(label);
      setLoading(false);  // let executeScan re-set loading
      await executeScan(transcript);
    } catch (err) {
      alert("TRANSCRIPTION ERROR: " + (err instanceof Error ? err.message : String(err)));
      setLoading(false);
    }
  };

  const toggleMic = async () => {
    if (!token) { setShowLogin(true); return; }
    if (isRecording) {
      mediaRecRef.current?.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      alert("Microphone not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recStreamRef.current = stream;
      recChunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      rec.ondataavailable = ev => { if (ev.data.size) recChunksRef.current.push(ev.data); };
      rec.onstop = async () => {
        setIsRecording(false);
        recStreamRef.current?.getTracks().forEach(t => t.stop());
        recStreamRef.current = null;
        const blob = new Blob(recChunksRef.current, { type: mime || "audio/webm" });
        if (blob.size < 1000) { alert("Recording too short."); return; }
        await transcribeAndScan(blob, `mic-${Date.now()}.webm`);
      };
      mediaRecRef.current = rec;
      rec.start();
      setIsRecording(true);
    } catch (err) {
      alert("Mic access denied: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  useEffect(() => {
    return () => {
      mediaRecRef.current?.state === "recording" && mediaRecRef.current.stop();
      recStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const sendChat = async (message: string) => {
    if (!message.trim() || !result || chatLoading) return;
    const userMsg: ChatMsg = { role: "user", content: message };
    const newHistory = [...chatMessages, userMsg];
    setChatMessages([...newHistory, { role: "assistant", content: "" }]);
    setChatInput(""); setChatLoading(true);
    try {
      const r = await apiFetch("/chat", { method: "POST", body: JSON.stringify({ message, analysis: result, history: chatMessages, mode: chatMode }) });
      if (r.status === 401) { setShowLogin(true); setChatLoading(false); return; }
      if (!r.ok) throw new Error(await r.text());
      const reader = r.body!.getReader(), decoder = new TextDecoder();
      let assistant = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistant += decoder.decode(value, { stream: true });
        setChatMessages([...newHistory, { role: "assistant", content: assistant }]);
      }
    } catch (e) {
      setChatMessages([...newHistory, { role: "assistant", content: "Error: " + String(e) }]);
    } finally { setChatLoading(false); }
  };

  // Derived values
  const mi = result?.manipulation_index ?? 0;
  const aiRaw = result?.ai_detection?.score ?? result?.ai_detection?.ai_confidence ?? 0;
  const syntheticPct = Math.round(aiRaw * (aiRaw <= 1 ? 100 : 1));
  const rhetPct = Math.min(100, (result?.persuasion_techniques?.length ?? 0) * 14);
  const fakeRaw = result?.fake_detection?.fake_confidence ?? result?.fake_detection?.confidence ?? 0;
  const srcObfPct = Math.round(fakeRaw * (fakeRaw <= 1 ? 100 : 1));

  const techniques  = result?.persuasion_techniques ?? [];
  const gaps        = result?.missing_context ?? [];
  const emotionScores = result?.emotion_scores ?? {};

  const timeAgo = (ts: number) => {
    const d = Date.now() - ts;
    if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
    if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
    return `${Math.floor(d / 86400000)}d ago`;
  };

  const verdictStyle = (v: string) =>
    v === "DECEPTIVE"    ? { bg: "rgba(239,68,68,0.12)", color: "#ff6b6b", border: "rgba(239,68,68,0.3)" } :
    v === "VERIFIED"     ? { bg: "rgba(74,225,118,0.1)", color: "#4ae176", border: "rgba(74,225,118,0.3)" } :
                           { bg: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "rgba(251,191,36,0.25)" };

  const metricColor = (pct: number) => pct >= 70 ? P.red : pct >= 40 ? P.yellow : P.green;

  const metrics = [
    { label: "Synthetic Content", pct: syntheticPct, status: syntheticPct >= 70 ? "STRONG" : syntheticPct >= 40 ? "MODERATE" : "LOW" },
    { label: "Rhetorical Fallacy", pct: rhetPct,     status: rhetPct >= 70 ? "CRITICAL" : rhetPct >= 40 ? "NOTABLE" : "MINIMAL" },
    { label: "Source Obfuscation", pct: srcObfPct,   status: srcObfPct >= 70 ? "CRITICAL" : srcObfPct >= 40 ? "NOTABLE" : "CLEAR" },
  ];

  const navItems = [
    { id: "neural",    icon: <Radio size={13} />,         label: "Neural Scan"  },
    { id: "source",    icon: <Network size={13} />,       label: "Source Trace" },
    { id: "citations", icon: <LinkIcon size={13} />,      label: "Citations"    },
    { id: "logic",     icon: <Brain size={13} />,         label: "Logic Audit"  },
    { id: "metadata",  icon: <FileText size={13} />,      label: "Metadata"     },
    { id: "report",    icon: <ScrollText size={13} />,    label: "Report"       },
    { id: "chat",      icon: <MessageSquare size={13} />, label: "AI Assistant" },
  ];

  // ── Shared styles ──
  const S = {
    card: { background: P.card, border: `1px solid ${P.border}`, borderRadius: 8 } as React.CSSProperties,
    cardHd: { padding: "10px 16px", borderBottom: `1px solid ${P.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 10, letterSpacing: "0.12em", color: P.muted, fontWeight: 700 } as React.CSSProperties,
    btnFilled: { background: P.accent, border: "none", color: "#0a0a0f", fontFamily: "inherit", fontSize: 10, letterSpacing: "0.1em", fontWeight: 700, padding: "9px 18px", borderRadius: 4, cursor: "pointer" } as React.CSSProperties,
    btnOutline: { background: "transparent", border: `1px solid ${P.border3}`, color: P.accent, fontFamily: "inherit", fontSize: 10, letterSpacing: "0.1em", fontWeight: 700, padding: "8px 14px", borderRadius: 4, cursor: "pointer" } as React.CSSProperties,
    btnGhost: { background: "transparent", border: `1px solid ${P.border}`, color: P.muted, fontFamily: "inherit", fontSize: 10, letterSpacing: "0.08em", padding: "7px 12px", borderRadius: 4, cursor: "pointer" } as React.CSSProperties,
    tab: (active: boolean): React.CSSProperties => ({ fontSize: 10, letterSpacing: "0.08em", padding: "4px 10px", borderRadius: 3, cursor: "pointer", fontFamily: "inherit", border: active ? `1px solid ${P.border3}` : `1px solid transparent`, background: active ? P.accentDim : "transparent", color: active ? P.accent : P.muted }),
    navItem: (active: boolean): React.CSSProperties => ({ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 6, fontSize: 11, letterSpacing: "0.06em", color: active ? P.accent : P.muted, cursor: "pointer", border: active ? `1px solid ${P.border3}` : "1px solid transparent", background: active ? P.accentDim : "transparent", width: "100%", fontFamily: "inherit" }),
  };

  return (
    <>
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onAuth={handleAuth} />}
      {showNarrativeModal && (
        <NarrativeModal
          claimTimeline={claimTimeline}
          timelineLoading={timelineLoading}
          timelineError={timelineError}
          onBuildTimeline={buildClaimTimeline}
          onClose={() => setShowNarrativeModal(false)}
        />
      )}

      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 300px", gridTemplateRows: "52px 1fr", minHeight: "100vh" }}>

        {/* ── Top Nav ── */}
        <nav style={{ gridColumn: "1/-1", gridRow: 1, background: P.nav, borderBottom: `1px solid ${P.border}`, display: "flex", alignItems: "center", padding: "0 20px", gap: 24, position: "sticky", top: 0, zIndex: 50, backdropFilter: "blur(20px)" }}>
          <a href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 24, height: 24, borderRadius: 6, background: "linear-gradient(135deg, #fff, #a8a8b0)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Search size={13} color="#000" strokeWidth={2.6} />
            </span>
            <span style={{ fontSize: 15, fontWeight: 600, color: P.text, letterSpacing: "-0.02em" }}>GKIN</span>
          </a>
          <div style={{ flex: 1 }} />
          {[{ label: "Analyzer", active: !showArchives }, { label: "Archives", active: showArchives }].map(({ label, active }) => (
            <button key={label}
              onClick={() => setShowArchives(label === "Archives")}
              style={{ fontSize: 11, color: active ? P.accent : P.muted, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.06em", padding: 0 }}>
              {label}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          {token
            ? <><span style={{ fontSize: 10, color: P.muted, letterSpacing: "0.06em" }}>{username.toUpperCase()}</span>
                <button style={S.btnFilled} onClick={handleLogout}>LOGOUT</button></>
            : <button style={{ ...S.btnFilled, boxShadow: `0 0 20px ${P.accentGlow}` }} onClick={() => setShowLogin(true)}>Log in</button>
          }
        </nav>

        {/* ── Left Sidebar ── */}
        <aside style={{ gridColumn: 1, gridRow: 2, background: P.panel, borderRight: `1px solid ${P.border}`, padding: "20px 12px", display: "flex", flexDirection: "column", gap: 6, position: "sticky", top: 52, height: "calc(100vh - 52px)", overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", marginBottom: 8 }}>
            <div style={{ width: 32, height: 32, border: `1px solid ${P.border3}`, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: P.accentDim }}>
              <Shield size={14} color={P.accent} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: P.text, fontWeight: 700, letterSpacing: "0.06em" }}>{username.toUpperCase().slice(0, 10)}</div>
              <div style={{ fontSize: 9, color: P.muted, letterSpacing: "0.08em" }}>CLEARANCE: OMEGA</div>
            </div>
          </div>

          <button style={{ ...S.btnOutline, width: "100%", marginBottom: 6 }}
            onClick={() => { setResult(null); setInput(""); setFetchedTitle(""); setLangBadge(""); setActiveNav("neural"); setChatMessages([]); setSuggestions([]); setShowArchives(false); }}>
            + NEW INVESTIGATION
          </button>

          {result && navItems.map(item => (
            <button key={item.id} style={S.navItem(activeNav === item.id)} onClick={() => setActiveNav(item.id)}>
              {item.icon} {item.label}
            </button>
          ))}

          <div style={{ flex: 1 }} />
        </aside>

        {/* ── Main ── */}
        <main style={{ gridColumn: 2, gridRow: 2, padding: 24, overflowY: "auto", maxHeight: "calc(100vh - 52px)" }}>

          {/* ── Archives View ── */}
          {showArchives && (
            <div>
              <div style={{ marginBottom: 28 }}>
                <h1 className="text-balance" style={{ fontSize: 48, fontWeight: 600, letterSpacing: "-0.038em", lineHeight: 0.98, marginBottom: 14 }}>
                  <span className="grad-title">Investigation</span><br />
                  <span className="grad-accent">Archives.</span>
                </h1>
                <p style={{ fontSize: 13, color: P.muted, lineHeight: 1.6, maxWidth: 480 }}>
                  {token ? `All saved analyses for ${username.toUpperCase()}.` : "Log in to see your saved investigations."} {investigations.length > 0 ? `${investigations.length} record${investigations.length !== 1 ? "s" : ""} found.` : ""}
                </p>
              </div>

              {investigations.length === 0 ? (
                <div style={{ ...S.card, padding: 40, textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: P.faint, letterSpacing: "0.08em" }}>
                    {token ? "NO INVESTIGATIONS ON FILE — RUN A SCAN TO BEGIN" : "LOG IN TO VIEW YOUR INVESTIGATION HISTORY"}
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {investigations.map(inv => {
                    const vs = verdictStyle(inv.verdict);
                    return (
                      <div key={inv.id}
                        onClick={() => { setShowArchives(false); setResult(inv.result); setActiveNav("neural"); setChatMessages([]); fetchSuggestions(inv.result); }}
                        style={{ ...S.card, padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 16 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                            <span style={{ fontSize: 9, color: P.faint, letterSpacing: "0.06em" }}>#{inv.id}</span>
                            <span style={{ fontSize: 9, letterSpacing: "0.08em", fontWeight: 700, padding: "2px 8px", borderRadius: 3, background: vs.bg, color: vs.color, border: `1px solid ${vs.border}` }}>{inv.verdict}</span>
                            <span style={{ fontSize: 9, color: P.faint, marginLeft: "auto" }}>{timeAgo(inv.timestamp)}</span>
                          </div>
                          <p style={{ fontSize: 11, color: P.body, lineHeight: 1.5, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{inv.snippet}{inv.snippet.length >= 90 ? "…" : ""}</p>
                        </div>
                        <ArrowRight size={13} color={P.muted} style={{ flexShrink: 0 }} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Normal Workspace (hidden when archives open) ── */}
          {!showArchives && <>

          {/* Translation badge */}
          {langBadge && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "6px 12px", background: P.panel, borderRadius: 6, border: `1px solid ${P.border}`, fontSize: 9, letterSpacing: "0.08em", width: "fit-content" }}>
              <span style={{ color: P.yellow, fontWeight: 700 }}>TRANSLATED FROM: {langBadge.toUpperCase()}</span>
            </div>
          )}

          <div style={{ marginBottom: 28 }}>
            <h1 className="text-balance" style={{ fontSize: 56, fontWeight: 600, letterSpacing: "-0.038em", lineHeight: 0.98, marginBottom: 14 }}>
              <span className="grad-title">Analyzer</span><br />
              <span className="grad-accent">Workspace.</span>
            </h1>
            <p style={{ fontSize: 14, color: P.muted, lineHeight: 1.6, maxWidth: 520 }}>
              Forensic deconstruction of digital narratives. Identifying manipulation patterns and synthetic context in real-time.
            </p>
          </div>

          {/* Ingestion Hub */}
          <div style={{ ...S.card, marginBottom: 20 }}>
            <div style={S.cardHd}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Search size={11} /> FORENSIC INGESTION HUB
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {(["TEXT", "URL", "MEDIA"] as const).map(t => (
                  <button key={t} style={S.tab(activeTab === t)} onClick={() => setActiveTab(t)}>{t}</button>
                ))}
              </div>
            </div>
            <div style={{ position: "relative", borderBottom: `1px solid ${P.border}` }}>
              {loading && (
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${P.accent}, transparent)`, animation: "shimmer 1.5s ease-in-out infinite", pointerEvents: "none", zIndex: 1 }} />
              )}
              <span style={{ position: "absolute", left: 14, top: 14, fontSize: 11, color: P.accentDim, fontWeight: 700, letterSpacing: "0.06em", pointerEvents: "none", zIndex: 1, opacity: 0.7 }}>
                COMMAND&gt;
              </span>
              {fetchedTitle && (
                <div style={{ padding: "10px 14px 0 106px", fontSize: 10, color: P.accent, letterSpacing: "0.06em", opacity: 0.7 }}>
                  SOURCE: {fetchedTitle}
                </div>
              )}
              <textarea value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && e.metaKey) executeScan(); }}
                placeholder={activeTab === "URL" ? "Paste a URL — youtube.com/watch?v=... or any article" : "Paste article text or headline to analyze…"}
                rows={6}
                style={{ background: "transparent", border: "none", outline: "none", resize: "none", color: P.body, fontFamily: "inherit", fontSize: 12, lineHeight: 1.7, width: "100%", padding: "14px 14px 14px 106px", display: "block" }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px" }}>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="text/*,image/*,audio/*,.txt,.md,.csv,.rtf,.png,.jpg,.jpeg,.webp,.gif,.mp3,.wav,.m4a,.ogg,.webm,.flac"
                  style={{ display: "none" }}
                  onChange={onFileChosen}
                />
                <button
                  type="button"
                  style={S.btnGhost}
                  onClick={openFilePicker}
                  title="Upload a file — text, image, or audio"
                  aria-label="Upload file"
                >
                  <Upload size={13} />
                </button>
                <button
                  type="button"
                  style={{
                    ...S.btnGhost,
                    background: isRecording ? "rgba(239,68,68,0.14)" : S.btnGhost.background,
                    border: isRecording ? `1px solid ${P.red}` : S.btnGhost.border,
                    color: isRecording ? P.red : P.muted,
                    animation: isRecording ? "pulse 1.4s ease-in-out infinite" : undefined,
                  }}
                  onClick={toggleMic}
                  title={isRecording ? "Stop recording — auto-scan on stop" : "Record from microphone"}
                  aria-label="Record from microphone"
                  aria-pressed={isRecording}
                >
                  <Mic size={13} />
                </button>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {loading && (
                  <span style={{ fontSize: 10, color: P.accent, letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 6 }}>
                    <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> {loadingMsg}…
                  </span>
                )}
                <button style={{ ...S.btnFilled, display: "flex", alignItems: "center", gap: 6, opacity: (loading || !input.trim()) ? 0.5 : 1, cursor: (loading || !input.trim()) ? "not-allowed" : "pointer", boxShadow: (!loading && input.trim()) ? `0 0 20px ${P.accentGlow}` : "none" }}
                  onClick={() => executeScan()} disabled={loading || !input.trim()}>
                  {loading ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> : <Zap size={11} />}
                  EXECUTE_SCAN
                </button>
              </div>
            </div>
          </div>

          {/* Results */}
          <AnimatePresence>
            {result && (
              <motion.div key="results" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

                {/* Neural Scan */}
                {activeNav === "neural" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {Object.keys(emotionScores).length > 0 && (
                      <div style={S.card}>
                        <div style={S.cardHd}><span>EMOTIONAL FRAMING</span><BarChart3 size={11} /></div>
                        <div style={{ padding: "14px 16px 14px" }}>
                          <EmotionBars scores={emotionScores} />
                        </div>
                      </div>
                    )}

                    {result.narrative_cluster && (
                      <div style={{ ...S.card, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 9, color: P.muted, letterSpacing: "0.1em" }}>NARRATIVE CLUSTER</span>
                        <span style={{ fontSize: 11, color: P.yellow, fontWeight: 700, letterSpacing: "0.06em" }}>
                          {result.narrative_cluster.toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Source Trace */}
                {activeNav === "source" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={S.card}>
                      <div style={S.cardHd}>CLAIM VERIFICATION</div>
                      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
                        {(result.claims || []).length === 0
                          ? <p style={{ color: P.muted, fontSize: 11 }}>No verifiable claims extracted.</p>
                          : (result.claims || []).map((c, i) => {
                              const v = c.verification?.verdict || "unverifiable";
                              const col = v === "accurate" ? P.green : v === "false" ? P.red : P.yellow;
                              const citationIds = c.citation_ids || [];
                              const sources = result.sources_used || [];
                              return (
                                <div key={i} style={{ borderLeft: `2px solid ${col}`, paddingLeft: 14 }}>
                                  <p style={{ fontSize: 11, color: P.body, marginBottom: 6, lineHeight: 1.6 }}>
                                    {c.text}
                                    {citationIds.length > 0 && (
                                      <span style={{ marginLeft: 4, display: "inline-flex", gap: 3, verticalAlign: "baseline" }}>
                                        {citationIds.slice(0, 6).map(idx => {
                                          const s = sources[idx];
                                          if (!s) return null;
                                          const tip = `${s.hostname}${s.published_date ? " · " + s.published_date : ""}${s.relevance_snippet ? "\n\n" + s.relevance_snippet : ""}`;
                                          return (
                                            <button key={idx}
                                              title={tip}
                                              onClick={() => { setActiveNav("citations"); setExpandedSrc(idx); }}
                                              style={{ display: "inline-flex", alignItems: "center", fontSize: 9, fontWeight: 700, color: P.accent, background: P.accentDim, border: `1px solid ${P.border3}`, borderRadius: 3, padding: "1px 5px", cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.02em", lineHeight: 1.2 }}>
                                              [{idx + 1}]
                                            </button>
                                          );
                                        })}
                                      </span>
                                    )}
                                  </p>
                                  <span style={{ fontSize: 10, color: col, letterSpacing: "0.06em", fontWeight: 700, textTransform: "uppercase" }}>{v}</span>
                                  {c.verification?.explanation && <p style={{ fontSize: 10, color: P.muted, marginTop: 4 }}>{c.verification.explanation}</p>}
                                </div>
                              );
                            })}
                      </div>
                    </div>

                    {gaps.length > 0 && (
                      <div style={S.card}>
                        <div style={S.cardHd}><span>MISSING CONTEXT ({gaps.length})</span><AlertTriangle size={11} /></div>
                        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                          {gaps.map((g, i) => (
                            <div key={i} style={{ borderLeft: "2px solid rgba(251,191,36,0.4)", paddingLeft: 14 }}>
                              <p style={{ fontSize: 11, color: P.body, lineHeight: 1.6, marginBottom: 4 }}>{g.gap}</p>
                              {g.why_it_matters && <p style={{ fontSize: 10, color: P.muted, lineHeight: 1.5 }}>Why it matters: {g.why_it_matters}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Logic Audit */}
                {activeNav === "logic" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={S.card}>
                      <div style={S.cardHd}>REASONING TRACE</div>
                      <pre style={{ padding: 16, fontSize: 11, color: P.text2, lineHeight: 1.8, whiteSpace: "pre-wrap", maxHeight: 320, overflowY: "auto", fontFamily: "inherit" }}>
                        {result.reasoning_trace || "No reasoning trace available."}
                      </pre>
                    </div>
                    {techniques.length > 0 && (
                      <div style={S.card}>
                        <div style={S.cardHd}>PERSUASION TECHNIQUES ({techniques.length})</div>
                        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
                          {techniques.map((t, i) => (
                            <div key={i} style={{ borderLeft: `2px solid rgba(165,180,252,0.4)`, paddingLeft: 14 }}>
                              <div style={{ fontSize: 10, color: P.blue, letterSpacing: "0.08em", fontWeight: 700, marginBottom: 6 }}>
                                {t.technique.replace(/_/g, " ").toUpperCase()}
                              </div>
                              {t.span && <p style={{ fontSize: 11, color: P.text2, fontStyle: "italic", lineHeight: 1.6, marginBottom: 4 }}>"{t.span}"</p>}
                              {t.explanation && <p style={{ fontSize: 10, color: P.muted, lineHeight: 1.5 }}>{t.explanation}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Metadata */}
                {activeNav === "metadata" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={S.card}>
                      <div style={S.cardHd}>DOCUMENT INTELLIGENCE</div>
                      <div style={{ padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        {([
                          ["Source Language",  result.source_language || "English"],
                          ["Narrative Cluster", result.narrative_cluster || "—"],
                          ["Bias Orientation",  result.bias_orientation || "—"],
                          ["AI Authorship",     result.ai_detection?.verdict?.toUpperCase() || "—"],
                          ["AI Score",          `${syntheticPct}%`],
                          ["Fake Detection",    result.fake_detection?.verdict?.toUpperCase() || "—"],
                        ] as [string, string][]).map(([k, v]) => (
                          <div key={k} style={{ borderBottom: `1px solid ${P.border}`, paddingBottom: 10 }}>
                            <div style={{ fontSize: 9, color: P.muted, letterSpacing: "0.1em", marginBottom: 4 }}>{k}</div>
                            <div style={{ fontSize: 11, color: P.accent, fontWeight: 700 }}>{v}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {result.fake_detection && (
                      <div style={S.card}>
                        <div style={S.cardHd}>FAKE DETECTION SIGNALS</div>
                        <div style={{ padding: 16 }}>
                          {result.fake_detection.reasoning && <p style={{ fontSize: 11, color: P.text2, lineHeight: 1.7, marginBottom: 14 }}>{result.fake_detection.reasoning}</p>}
                          {(result.fake_detection.red_flags || []).length > 0 && (
                            <div style={{ marginBottom: 10 }}>
                              <div style={{ fontSize: 9, color: P.red, letterSpacing: "0.1em", marginBottom: 8 }}>RED FLAGS</div>
                              {result.fake_detection.red_flags!.map((f, i) => <div key={i} style={{ fontSize: 10, color: "#ff6b6b", padding: "3px 0" }}>⚠ {f}</div>)}
                            </div>
                          )}
                          {(result.fake_detection.trust_signals || []).length > 0 && (
                            <div>
                              <div style={{ fontSize: 9, color: P.green, letterSpacing: "0.1em", marginBottom: 8 }}>TRUST SIGNALS</div>
                              {result.fake_detection.trust_signals!.map((f, i) => <div key={i} style={{ fontSize: 10, color: P.green, padding: "3px 0" }}>✓ {f}</div>)}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Report */}
                {activeNav === "report" && (
                  <div style={S.card}>
                    <div style={S.cardHd}>EXECUTIVE REPORT</div>
                    <div style={{ padding: 16 }}>
                      <p style={{ fontSize: 11, color: P.body, lineHeight: 1.8, marginBottom: 18 }}>{result.summary || "Summary not available."}</p>
                      {gaps.length > 0 && (
                        <div style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.15)", borderRadius: 6, padding: 14, marginBottom: 16 }}>
                          <div style={{ fontSize: 9, color: P.yellow, letterSpacing: "0.1em", marginBottom: 8 }}>MISSING CONTEXT ({gaps.length})</div>
                          {gaps.map((g, i) => <p key={i} style={{ fontSize: 11, color: P.body, lineHeight: 1.7, marginBottom: i < gaps.length - 1 ? 6 : 0 }}>• {g.gap}</p>)}
                        </div>
                      )}
                      {techniques.length > 0 && (
                        <div>
                          <div style={{ fontSize: 9, color: P.muted, letterSpacing: "0.1em", marginBottom: 10 }}>PERSUASION TECHNIQUES</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {techniques.map((t, i) => (
                              <span key={i} style={{ fontSize: 9, letterSpacing: "0.08em", fontWeight: 700, padding: "3px 8px", borderRadius: 3, background: "rgba(165,180,252,0.1)", color: P.blue, border: "1px solid rgba(165,180,252,0.2)" }}>
                                {t.technique.replace(/_/g, " ")}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Citations & Claim Timeline */}
                {activeNav === "citations" && (() => {
                  const sources = result.sources_used || [];
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <div style={S.card}>
                        <div style={S.cardHd}>
                          <span>SOURCES &amp; CITATIONS{sources.length > 0 ? ` (${sources.length})` : ""}</span>
                          <LinkIcon size={11} />
                        </div>
                        {sources.length === 0 ? (
                          <div style={{ padding: 24, textAlign: "center", fontSize: 11, color: P.faint, letterSpacing: "0.06em" }}>
                            NO SOURCES RETRIEVED — EVIDENCE PIPELINE DID NOT FIND CORROBORATING PAGES
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            {sources.map((s, i) => {
                              const expanded = expandedSrc === i;
                              return (
                                <div key={i} style={{ borderBottom: i < sources.length - 1 ? `1px solid ${P.border}` : "none", padding: "14px 16px" }}>
                                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: P.accent, background: P.accentDim, border: `1px solid ${P.border3}`, borderRadius: 4, padding: "2px 7px", minWidth: 28, textAlign: "center", flexShrink: 0 }}>
                                      [{i + 1}]
                                    </span>
                                    {s.hostname && (
                                      <img
                                        src={`https://www.google.com/s2/favicons?domain=${s.hostname}&sz=32`}
                                        alt=""
                                        width={16}
                                        height={16}
                                        style={{ marginTop: 2, borderRadius: 3, flexShrink: 0, opacity: 0.85 }}
                                        onError={e => { (e.target as HTMLImageElement).style.visibility = "hidden"; }}
                                      />
                                    )}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <a href={s.url} target="_blank" rel="noopener noreferrer"
                                        style={{ color: P.text, textDecoration: "none", fontSize: 12, fontWeight: 600, lineHeight: 1.4, display: "block", marginBottom: 4 }}>
                                        {s.title || s.hostname || s.url}
                                      </a>
                                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", fontSize: 9, color: P.muted, letterSpacing: "0.06em", marginBottom: 6 }}>
                                        <span style={{ color: P.accentCyan }}>{s.hostname || "unknown source"}</span>
                                        {s.published_date && (
                                          <span style={{ background: P.panel, border: `1px solid ${P.border}`, borderRadius: 3, padding: "2px 6px", color: P.text2 }}>
                                            {s.published_date}
                                          </span>
                                        )}
                                      </div>
                                      <div style={{ fontSize: 10, color: P.muted, lineHeight: 1.5 }}>
                                        <span style={{ color: P.faint, letterSpacing: "0.08em" }}>SUPPORTS: </span>
                                        <span style={{ color: P.text2 }}>{s.claim_supported}</span>
                                      </div>
                                      {s.relevance_snippet && (
                                        <button
                                          onClick={() => setExpandedSrc(expanded ? null : i)}
                                          style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: P.accent, fontSize: 10, letterSpacing: "0.06em", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
                                        >
                                          {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                                          {expanded ? "HIDE EXCERPT" : "SHOW EXCERPT"}
                                        </button>
                                      )}
                                      {expanded && s.relevance_snippet && (
                                        <p style={{ fontSize: 11, color: P.text2, lineHeight: 1.65, marginTop: 8, padding: "10px 12px", background: P.panel, borderLeft: `2px solid ${P.accent}`, borderRadius: 3 }}>
                                          "{s.relevance_snippet}"
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Claim Timeline — lazy load to keep /analyze under 1.8s */}
                      <div style={S.card}>
                        <div style={S.cardHd}>
                          <button onClick={() => setTimelineOpen(o => !o)}
                            style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", color: P.muted, fontSize: 10, letterSpacing: "0.12em", fontWeight: 700, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
                            {timelineOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                            CLAIM TIMELINE
                          </button>
                          <GitBranch size={11} />
                        </div>
                        {timelineOpen && (
                          <div style={{ padding: 16 }}>
                            {!claimTimeline && !timelineLoading && (
                              <div style={{ textAlign: "center" }}>
                                <p style={{ fontSize: 11, color: P.muted, lineHeight: 1.6, marginBottom: 14 }}>
                                  Trace how this claim spread across outlets over time. This runs a deeper scrape (~6–10s).
                                </p>
                                <button style={S.btnFilled} onClick={buildClaimTimeline}>
                                  BUILD TIMELINE
                                </button>
                              </div>
                            )}
                            {timelineLoading && (
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "16px 0", color: P.accent, fontSize: 11, letterSpacing: "0.08em" }}>
                                <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
                                TRACING NARRATIVE LINEAGE…
                              </div>
                            )}
                            {timelineError && (
                              <p style={{ fontSize: 11, color: P.red, lineHeight: 1.6 }}>{timelineError}</p>
                            )}
                            {claimTimeline && claimTimeline.length === 0 && !timelineLoading && (
                              <p style={{ fontSize: 11, color: P.faint, letterSpacing: "0.06em", textAlign: "center" }}>
                                NO DATED EVIDENCE FOUND TO RECONSTRUCT TIMELINE
                              </p>
                            )}
                            {claimTimeline && claimTimeline.length > 0 && (
                              <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
                                {claimTimeline.map((ct, ci) => (
                                  <div key={ci}>
                                    <div style={{ marginBottom: 12 }}>
                                      <div style={{ fontSize: 9, color: P.muted, letterSpacing: "0.1em", marginBottom: 4 }}>CLAIM</div>
                                      <p style={{ fontSize: 12, color: P.text, lineHeight: 1.5, fontWeight: 600, margin: 0 }}>{ct.claim}</p>
                                      {ct.first_reported && (
                                        <div style={{ fontSize: 10, color: P.accentCyan, marginTop: 6, letterSpacing: "0.04em" }}>
                                          FIRST REPORTED: {ct.first_reported}
                                        </div>
                                      )}
                                    </div>
                                    <div style={{ position: "relative", paddingLeft: 18 }}>
                                      <div style={{ position: "absolute", left: 5, top: 6, bottom: 6, width: 1, background: P.border2 }} />
                                      {ct.timeline_entries.map((te, ti) => (
                                        <div key={ti} style={{ position: "relative", paddingBottom: 14 }}>
                                          <div style={{ position: "absolute", left: -16, top: 5, width: 9, height: 9, borderRadius: "50%", background: P.bg, border: `2px solid ${P.accent}` }} />
                                          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                                            <span style={{ fontSize: 10, color: P.accent, fontWeight: 700, letterSpacing: "0.04em" }}>
                                              {te.date || "date unknown"}
                                            </span>
                                            <a href={te.url} target="_blank" rel="noopener noreferrer"
                                              style={{ fontSize: 10, color: P.accentCyan, textDecoration: "none", letterSpacing: "0.04em" }}>
                                              {te.hostname}
                                            </a>
                                          </div>
                                          <p style={{ fontSize: 11, color: P.body, lineHeight: 1.55, margin: 0 }}>{te.how_claim_changed}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* AI Assistant */}
                {activeNav === "chat" && (
                  <div style={S.card}>
                    <div style={S.cardHd}>
                      <span>AI ASSISTANT</span>
                      <button onClick={() => setChatMessages([])} style={S.btnGhost} title="Clear chat">
                        <RefreshCw size={11} /> CLEAR
                      </button>
                    </div>

                    {chatMode === "conspiracy" && (
                      <div style={{ margin: "10px 16px 0", padding: "8px 12px", background: "rgba(255,107,139,0.08)", border: `1px solid rgba(255,107,139,0.25)`, borderRadius: 6, fontSize: 11, color: P.accentRose, display: "flex", alignItems: "center", gap: 8 }}>
                        <AlertTriangle size={12} />
                        Speculative Mode — Alternative theories for critical thinking only.
                      </div>
                    )}

                    {suggestions.length > 0 && chatMessages.length === 0 && (
                      <div style={{ padding: "12px 16px 0", display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {suggestions.map((s, i) => (
                          <button key={i} onClick={() => sendChat(s)}
                            style={{ fontSize: 10, color: P.muted, background: P.accentDim, border: `1px solid ${P.border}`, borderRadius: 4, padding: "5px 10px", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                            {s}
                          </button>
                        ))}
                      </div>
                    )}

                    <div style={{ padding: 16, maxHeight: 380, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
                      {chatMessages.length === 0 && (
                        <div style={{ fontSize: 11, color: P.faint, textAlign: "center", padding: "24px 0" }}>
                          Ask a question about the analyzed article.
                        </div>
                      )}
                      {chatMessages.map((m, i) => (
                        <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
                          <div style={{ maxWidth: "85%", padding: "9px 13px", borderRadius: 6, fontSize: 11, lineHeight: 1.7,
                            background: m.role === "user" ? P.accentDim : P.panel,
                            color: m.role === "user" ? P.accent : P.body,
                            border: `1px solid ${m.role === "user" ? P.border3 : P.border}`,
                          }}>
                            {m.content || (chatLoading && i === chatMessages.length - 1
                              ? <span style={{ display: "flex", alignItems: "center", gap: 6, color: P.muted }}><Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} /> Thinking…</span>
                              : "")}
                          </div>
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                    </div>

                    <div style={{ borderTop: `1px solid ${P.border}`, padding: "10px 14px" }}>
                      <PromptInputBox
                        value={chatInput}
                        onValueChange={setChatInput}
                        onSend={msg => { sendChat(msg); }}
                        mode={chatMode}
                        onModeChange={setChatMode}
                        isLoading={chatLoading}
                        placeholder="Ask a question about the article…"
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Recent Investigations */}
          {investigations.length > 0 && (
            <div style={{ marginTop: 28 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, color: P.muted, letterSpacing: "0.1em" }}>
                  <Clock size={11} /> RECENT INVESTIGATIONS
                </div>
                <button style={S.btnGhost}>VIEW ALL</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                {investigations.slice(0, 3).map(inv => {
                  const vs = verdictStyle(inv.verdict);
                  return (
                    <div key={inv.id} onClick={() => { setResult(inv.result); setActiveNav("neural"); setChatMessages([]); fetchSuggestions(inv.result); }}
                      style={{ ...S.card, padding: 14, cursor: "pointer" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <span style={{ fontSize: 9, color: P.faint }}>#{inv.id}</span>
                        <span style={{ fontSize: 9, letterSpacing: "0.08em", fontWeight: 700, padding: "2px 8px", borderRadius: 3, background: vs.bg, color: vs.color, border: `1px solid ${vs.border}` }}>{inv.verdict}</span>
                      </div>
                      <p style={{ fontSize: 11, color: P.body, lineHeight: 1.5, marginBottom: 10 }}>{inv.snippet}{inv.snippet.length >= 90 ? "…" : ""}</p>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 9, color: P.faint }}>{timeAgo(inv.timestamp)}</span>
                        <ArrowRight size={11} color={P.muted} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          </>}
        </main>

        {/* ── Right Panel ── */}
        <aside style={{ gridColumn: 3, gridRow: 2, background: P.panel, borderLeft: `1px solid ${P.border}`, padding: 16, overflowY: "auto", position: "sticky", top: 52, height: "calc(100vh - 52px)", display: "flex", flexDirection: "column", gap: 14 }}>

          <div style={S.card}>
            <div style={S.cardHd}>MANIPULATION INDEX</div>
            <div style={{ padding: "16px 14px" }}>
              <Gauge score={mi} />
              <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                {metrics.map(m => (
                  <div key={m.label}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 10 }}>
                      <span style={{ color: P.text2 }}>{m.label}</span>
                      <span style={{ color: metricColor(m.pct), fontWeight: 700 }}>{m.status}</span>
                    </div>
                    <div style={{ height: 3, background: P.border, borderRadius: 2, overflow: "hidden" }}>
                      <motion.div style={{ height: "100%", background: metricColor(m.pct), borderRadius: 2 }}
                        initial={{ width: 0 }} animate={{ width: `${m.pct}%` }}
                        transition={{ duration: 1, ease: "easeOut" }} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button style={{ ...S.btnGhost, flex: 1, fontSize: 9 }} onClick={() => setActiveNav("report")}>EXECUTIVE SUMMARY</button>
                <button style={{ ...S.btnGhost, padding: "7px 10px" }} onClick={() => setActiveNav("chat")} title="Open AI Chat"><MessageSquare size={12} /></button>
              </div>
            </div>
          </div>

          <div style={{ ...S.card, flex: 1 }}>
            <div style={S.cardHd}>
              PERSUASION MAPPING
            </div>
            <div style={{ padding: 14 }}>
              <PersuasionNet techniques={techniques} />
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                {[{ color: P.accent, label: "Primary Narrative Vector" }, { color: "rgba(165,180,252,0.7)", label: "Echo Chamber Amplification" }].map(l => (
                  <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, color: P.text2 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: l.color, flexShrink: 0 }} />
                    {l.label}
                  </div>
                ))}
                {techniques.slice(0, 3).map((t, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 9, color: P.muted }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(251,191,36,0.5)", flexShrink: 0 }} />
                    {t.technique.replace(/_/g, " ")}
                  </div>
                ))}
              </div>
              {result && (
                <button
                  onClick={() => { setShowNarrativeModal(true); }}
                  style={{ marginTop: 14, width: "100%", padding: "10px", background: P.accentDim, border: `1px solid ${P.accent}`, color: P.accent, fontSize: 10, letterSpacing: "0.08em", fontWeight: 700, borderRadius: 6, cursor: "pointer", fontFamily: "inherit" }}>
                  ↗ OPEN NARRATIVE MAP
                </button>
              )}
            </div>
          </div>

          {!result && (
            <div style={S.card}>
              <div style={S.cardHd}>SYSTEM READY</div>
              <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                {[["Models online","5/5"],["Avg scan time","0.84s"],["Queue depth","0"]].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
                    <span style={{ color: P.muted }}>{k}</span>
                    <span style={{ color: P.accent, fontWeight: 700 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>


      <style>{`
        @keyframes pulse  { 0%,100%{opacity:1}50%{opacity:0.4} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        @keyframes shimmer{ 0%{transform:translateX(-100%)}100%{transform:translateX(100%)} }
      `}</style>
    </>
  );
}
