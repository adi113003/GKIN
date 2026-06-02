import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Shield, Search,
  ArrowRight, Upload,
  Clock, Loader2, Lock, User, Mail,
  Eye, EyeOff, X, Mic,
  RefreshCw, AlertTriangle,
  ChevronDown, ChevronRight, ShieldCheck,
} from "lucide-react";
import { PromptInputBox } from "@/components/ui/ai-prompt-box";

// ── Palette ───────────────────────────────────────────────────────────────────
// Airbnb-style: a warm, generous white canvas with a single brand voltage -
// Rausch (#ff385c) - carrying CTAs / accents / links. Keys are kept identical to
// the old ramp so every existing reference renders in the new look without a
// per-site rename. The three verdict colors carry MEANING ONLY (green / red / grey).
const P = {
  bg:       "#ffffff",                 // canvas - page background
  nav:      "#ffffff",                 // white top-nav surface
  card:     "#ffffff",                 // card fill
  panel:    "#f7f7f7",                 // surface-soft - recessed wells / cells
  border:   "#dddddd",                 // hairline
  border2:  "#ebebeb",                 // hairline-soft
  border3:  "#222222",                 // ink - true emphasis (selected)
  accent:    "#ff385c",                // Rausch - primary accent
  accentCyan:"#ff385c",                // Rausch
  accentRose:"#9B1C2E",                // contradicted red (semantic)
  accentDim: "#fff0f3",                // pale Rausch wash
  accentGlow:"transparent",            // no glow
  text:     "#222222",                 // ink - primary text
  text2:    "#3f3f3f",                 // body - secondary text
  muted:    "#6a6a6a",                 // muted / insufficient grey
  faint:    "#929292",                 // muted-soft caption
  body:     "#3f3f3f",                 // body
  green:    "#15633A",                 // supported (verdict)
  red:      "#9B1C2E",                 // contradicted (verdict)
  yellow:   "#6a6a6a",                 // disputed/insufficient (neutral grey)
  blue:     "#ff385c",                 // Rausch (was blue)
  navySoft: "#e00b41",                 // Rausch active (hover)
};

// ── Type scaffolding - full Inter sans (Airbnb feel) ──────────────────────────────
const SANS  = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif";
const SLAB  = SANS;   // editorial headings now render in Inter
const MONO  = SANS;   // former mono labels now render in Inter

// Turn a failed fetch Response into a short, user-facing message - never the raw
// JSON/HTML body. Maps capacity/timeout statuses to plain copy, and passes through
// the backend's own {detail} for actionable 4xx (e.g. "couldn't extract content").
async function friendlyError(r: Response): Promise<string> {
  let detail = "";
  try {
    const body = await r.json();
    if (body && typeof body.detail === "string") detail = body.detail;
  } catch {
    /* non-JSON body (e.g. an HTML 502 page) - fall through to the status map */
  }
  if (r.status === 429 || r.status === 503)
    return "Our analysis models are at capacity right now. Wait a few seconds and try again.";
  if (r.status === 502 || r.status === 504)
    return "That request timed out. Try again, or paste the text directly.";
  if (r.status >= 400 && r.status < 500 && detail) return detail;  // short, user-actionable validation messages
  return "Something went wrong. Please try again in a moment.";    // never surface a raw 5xx body
}

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
// Grounded /verify-claims output (gkin.agentic.verdict). A SUPPORTED/CONTRADICTED
// verdict is impossible to construct without >=1 evidence span (URL + verbatim
// sentence). INSUFFICIENT is the honest default.
interface EvidenceSpan {
  url: string; sentence: string; title?: string;
  tier?: number; tier_name?: string; trusted?: boolean; relevance?: number;
}
interface GroundedVerdict {
  claim_id: string; claim_text: string;
  label: "SUPPORTED" | "CONTRADICTED" | "INSUFFICIENT" | string;
  confidence: number; evidence: EvidenceSpan[];
  reasoning?: string; low_confidence?: boolean; flags?: string[]; cached?: boolean;
}
interface TimelineEntry { date: string; hostname: string; url: string; how_claim_changed: string; }
interface ClaimTimeline { claim: string; first_reported: string; timeline_entries: TimelineEntry[]; }
// Spread/corroboration signal from GDELT (global news index) returned by /timeline.
interface GdeltCoverage {
  source?: string;
  article_count: number;
  distinct_outlets: number;
  first_seen: string;
  last_seen: string;
  outlets?: string[];
  articles?: { date: string; hostname: string; url: string; title: string }[];
}
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

// ── Verification + source-reliability badges ───────────────────────────────────
// Surfaces the grounded verdict + trusted-source-tier work in the UI. Handles both
// the /analyze verdict vocabulary (accurate/false/unverifiable) and the grounded
// /verify-claims vocabulary (supported/contradicted/insufficient).
// "fill" describes the square verdict marker: solid for supported/contradicted,
// hollow for insufficient/unknown - per the Dossier device (not a colored pill).
function verdictMeta(raw?: string) {
  const v = (raw || "").toLowerCase().trim();
  // Grounded /verify-claims labels keep their canonical names; the /analyze
  // quick-pass synonyms map onto the same colors.
  if (v === "supported") return { label: "Supported", color: P.green, fill: true };
  if (v === "contradicted") return { label: "Contradicted", color: P.red, fill: true };
  if (v === "insufficient") return { label: "Insufficient", color: P.muted, fill: false };
  if (["accurate", "true", "verified", "correct"].includes(v))
    return { label: "Supported", color: P.green, fill: true };
  if (["false", "inaccurate", "debunked", "incorrect"].includes(v))
    return { label: "Contradicted", color: P.red, fill: true };
  if (["misleading", "partially true", "partial", "disputed", "mixed", "conflicting"].includes(v))
    return { label: "Disputed", color: P.muted, fill: false };
  return { label: "Insufficient", color: P.muted, fill: false };
}

// Square verdict marker - filled when supported/contradicted, hollow otherwise.
function VerdictBadge({ verdict }: { verdict?: string }) {
  const { label, color, fill } = verdictMeta(verdict);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600,
      letterSpacing: "0", color, fontFamily: SANS,
    }}>
      <span aria-hidden="true" style={{
        width: 8, height: 8, display: "inline-block", borderRadius: "50%",
        border: `1.5px solid ${color}`, background: fill ? color : "transparent",
      }} />
      {label}
    </span>
  );
}

// Trusted-source tiers mirror server.py TRUSTED_SOURCES: 1 primary/official,
// 2 established journalism, 3 fact-checkers/reference, 0 unverified.
function tierMeta(tier?: number, trusted?: boolean) {
  const t = tier ?? 0;
  if (t === 1) return { label: "Tier 1 · Primary", color: P.text, trusted: true };
  if (t === 2) return { label: "Tier 2 · Journalism", color: P.text, trusted: true };
  if (t === 3) return { label: "Tier 3 · Fact-check", color: P.text, trusted: true };
  return { label: "Uncorroborated", color: P.muted, trusted: !!trusted && t > 0 };
}

// Source tier as a ruled mono chip - navy outline, no colored pill fill.
function TierBadge({ tier, trusted }: { tier?: number; trusted?: boolean }) {
  const m = tierMeta(tier, trusted);
  const isTrusted = (tier ?? 0) > 0;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 500,
      letterSpacing: "0", color: m.color, fontFamily: SANS,
      border: `1px solid ${isTrusted ? P.accent : P.border}`, borderRadius: 9999, padding: "3px 10px",
    }}>
      {isTrusted ? <ShieldCheck size={9} strokeWidth={2.2} color={P.accent} /> : <Shield size={9} strokeWidth={2} />}
      {m.label}
    </span>
  );
}

function hostOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

// ── Gauge ─────────────────────────────────────────────────────────────────────
// Calm ruled manipulation-index gauge - a bordered track with a solid fill and
// real tick marks, not a glowing meter. The fill carries verdict color only when
// the index is high enough to read as "likely misleading".
function Gauge({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  // Heavy index reads as contradiction risk; mid as neutral; low as clean.
  const color = pct >= 70 ? P.red : pct >= 40 ? P.muted : P.green;
  const level = pct >= 70 ? "HEAVY" : pct >= 40 ? "MODERATE" : "LIGHT";
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontFamily: SLAB, fontWeight: 700, fontSize: 40, color: P.text, lineHeight: 1 }}>{pct}</span>
        <span style={{ fontFamily: MONO, fontSize: 14, color: P.muted, letterSpacing: "0.02em" }}>/100</span>
        <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", color }}>{level}</span>
      </div>
      <div style={{ position: "relative", height: 14, border: `1px solid ${P.text}`, background: P.bg, display: "flex", marginTop: 12 }}>
        <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: `${pct}%`, background: color, zIndex: 1 }} />
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={i} style={{ flex: "1 1 0", borderRight: i < 9 ? `1px solid ${P.border}` : "none" }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 9, letterSpacing: "0.08em", color: P.muted, marginTop: 5 }}>
        <span>0 · CLEAN</span><span>100 · HEAVY</span>
      </div>
    </div>
  );
}

// ── Persuasion summary ────────────────────────────────────────────────────────
// A calm ruled tally of detected techniques - replaces the old glowing node graph.
function PersuasionNet({ techniques }: { techniques: PersuasionTechnique[] }) {
  const count = techniques.length;
  const load = count === 0 ? "NONE DETECTED" : count >= 5 ? "HEAVY" : count >= 3 ? "NOTABLE" : "LIGHT";
  return (
    <div style={{ border: `1px solid ${P.border}`, background: P.panel }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "10px 12px", borderBottom: `1px solid ${P.border}` }}>
        <span style={{ fontFamily: SLAB, fontWeight: 700, fontSize: 26, color: P.text, lineHeight: 1 }}>{count}</span>
        <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.1em", color: P.muted }}>{load}</span>
      </div>
      {count === 0
        ? <div style={{ padding: "10px 12px", fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.08em", color: P.faint }}>NO PERSUASION TECHNIQUES FLAGGED</div>
        : (
          <div>
            {techniques.slice(0, 4).map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "baseline", padding: "7px 12px", borderTop: i > 0 ? `1px solid ${P.border}` : "none" }}>
                <span style={{ fontFamily: MONO, fontSize: 9.5, color: P.accent, fontWeight: 600, flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}</span>
                <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.04em", color: P.text2, lineHeight: 1.4 }}>
                  {t.technique.replace(/_/g, " ")}
                </span>
              </div>
            ))}
            {count > 4 && (
              <div style={{ padding: "7px 12px", borderTop: `1px solid ${P.border}`, fontFamily: MONO, fontSize: 9, color: P.faint, letterSpacing: "0.06em" }}>
                + {count - 4} more in the appendix
              </div>
            )}
          </div>
        )}
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

  // Auto-trigger build if not loaded
  useEffect(() => {
    if (!claimTimeline && !timelineLoading && !timelineError) {
      onBuildTimeline();
    }
  }, []);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(26,23,20,0.55)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div
        onClick={e => e.stopPropagation()}
        role="dialog" aria-label="Claim propagation map"
        style={{ background: P.bg, border: `1px solid ${P.border}`, overflow: "hidden", width: 820, maxWidth: "95vw", maxHeight: "92vh", display: "flex", flexDirection: "column" }}>

        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: `1px solid ${P.border}`, background: P.panel }}>
          <div>
            <div style={{ fontFamily: SLAB, fontWeight: 600, fontSize: 17, color: P.text, letterSpacing: "0.01em" }}>Claim propagation</div>
            <div style={{ fontFamily: MONO, fontSize: 9.5, color: P.muted, letterSpacing: "0.06em", marginTop: 3 }}>
              {nodes.length > 0 ? `${nodes.length} SOURCE NODE${nodes.length !== 1 ? "S" : ""} · ${claimTimeline?.length ?? 0} CLAIM${(claimTimeline?.length ?? 0) !== 1 ? "S" : ""} · CLICK A NODE TO OPEN` : "BUILDING…"}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: P.text, cursor: "pointer", padding: 4 }}><X size={16} /></button>
        </div>

        {/* loading */}
        {timelineLoading && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 40 }}>
            <Loader2 size={26} style={{ animation: "spin 1s linear infinite", color: P.accent }} />
            <div style={{ fontFamily: MONO, fontSize: 10.5, color: P.muted, letterSpacing: "0.08em" }}>TRACING CLAIM PROPAGATION…</div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: P.faint }}>Deeper web scrape, usually 6–10 seconds</div>
          </div>
        )}

        {/* error */}
        {!timelineLoading && timelineError && (
          <div style={{ padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 13, color: P.red, marginBottom: 14 }}>{timelineError}</div>
            <button onClick={onBuildTimeline} style={{ background: P.accent, border: "none", color: P.bg, fontFamily: SANS, fontSize: 13, letterSpacing: "0", fontWeight: 600, padding: "10px 18px", cursor: "pointer", borderRadius: 8 }}>Retry</button>
          </div>
        )}

        {/* no data yet prompt */}
        {!timelineLoading && !timelineError && claimTimeline === null && (
          <div style={{ padding: 32, textAlign: "center" }}>
            <div style={{ fontFamily: MONO, fontSize: 11, color: P.muted, marginBottom: 14, letterSpacing: "0.06em" }}>STARTING TIMELINE TRACE…</div>
          </div>
        )}

        {/* graph */}
        {!timelineLoading && nodes.length > 0 && (
          <div style={{ padding: "16px 20px 0", flex: 1, overflow: "hidden" }}>
            <svg width="100%" viewBox={`0 0 ${W} ${H}`}
              style={{ background: P.panel, border: `1px solid ${P.text}`, display: "block" }}>

              {/* edges: center → each node */}
              {positioned.map((p, i) => (
                <line key={`e-${i}`} x1={cx} y1={cy} x2={p.x} y2={p.y}
                  stroke={hovered === i ? P.accent : P.border}
                  strokeWidth={hovered === i ? 1.6 : 0.8}
                  strokeDasharray={hovered === i ? "none" : "4 3"} />
              ))}

              {/* timeline nodes */}
              {positioned.map((p, i) => {
                const isHov = hovered === i;
                const host = (p.node.hostname || "").replace(/^www\./, "").slice(0, 13);
                return (
                  <g key={`n-${i}`} style={{ cursor: "pointer" }}
                    onClick={() => window.open(p.node.url, "_blank", "noopener")}
                    onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
                    <rect x={p.x - 24} y={p.y - 14} width={48} height={28}
                      fill={isHov ? P.accent : P.bg}
                      stroke={P.text} strokeWidth={isHov ? 1.5 : 1} />
                    <text x={p.x} y={p.y - 1} textAnchor="middle" dominantBaseline="middle"
                      fill={isHov ? P.bg : P.text} fontSize="7.5"
                      fontFamily="'IBM Plex Mono', monospace"
                      style={{ pointerEvents: "none" }}>
                      {host}
                    </text>
                    {p.node.date && (
                      <text x={p.x} y={p.y + 9} textAnchor="middle"
                        fill={isHov ? P.bg : P.muted} fontSize="6"
                        fontFamily="'IBM Plex Mono', monospace"
                        style={{ pointerEvents: "none" }}>
                        {p.node.date.slice(0, 10)}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* center node */}
              <rect x={cx - 34} y={cy - 17} width={68} height={34} fill={P.accent} stroke={P.text} strokeWidth="1.5" />
              <text x={cx} y={cy - 4} textAnchor="middle" fill={P.bg} fontSize="9" fontFamily="'IBM Plex Mono', monospace" style={{ pointerEvents: "none" }}>SOURCE</text>
              <text x={cx} y={cy + 8} textAnchor="middle" fill={P.bg} fontSize="7" fontFamily="'IBM Plex Mono', monospace" style={{ pointerEvents: "none" }}>ORIGIN</text>
            </svg>
          </div>
        )}

        {/* empty state */}
        {!timelineLoading && !timelineError && claimTimeline !== null && nodes.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", fontFamily: MONO, fontSize: 11, color: P.faint, letterSpacing: "0.06em" }}>
            NO TIMELINE ENTRIES FOUND FOR THIS SOURCE
          </div>
        )}

        {/* link list at bottom */}
        {nodes.length > 0 && (
          <div style={{ borderTop: `1px solid ${P.border}`, padding: "10px 20px", display: "flex", flexWrap: "wrap", gap: 6, overflowY: "auto", maxHeight: 110 }}>
            {positioned.map((p, i) => (
              <a key={i} href={p.node.url} target="_blank" rel="noopener noreferrer"
                onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
                style={{ fontFamily: MONO, fontSize: 9, color: hovered === i ? P.bg : P.text2, background: hovered === i ? P.accent : "transparent", border: `1px solid ${hovered === i ? P.accent : P.border}`, padding: "4px 9px", textDecoration: "none", display: "flex", alignItems: "center", gap: 5, letterSpacing: "0.04em" }}>
                {(p.node.hostname || p.node.url).replace(/^www\./, "").slice(0, 25)}
                {p.node.date && <span style={{ color: hovered === i ? P.bg : P.faint, fontSize: 8 }}>{p.node.date.slice(0, 7)}</span>}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Emotion bars ──────────────────────────────────────────────────────────────
// Calm ruled bars - navy fill on a paper-2 track, no color-coding, no animation.
function EmotionBars({ scores }: { scores: Record<string, number> }) {
  const order = ["fear", "anger", "disgust", "hope", "guilt", "ingroup_framing"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {order.map(k => {
        const val = Math.max(0, Math.min(100, scores[k] ?? 0));
        return (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: MONO, fontSize: 9.5, color: P.muted, letterSpacing: "0.08em", width: 110, flexShrink: 0 }}>
              {k.replace(/_/g, " ")}
            </span>
            <div style={{ flex: 1, height: 8, background: P.panel, border: `1px solid ${P.border}`, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${val}%`, background: P.accent }} />
            </div>
            <span style={{ fontFamily: MONO, fontSize: 9.5, color: P.text2, width: 26, textAlign: "right", fontWeight: 600 }}>{val}</span>
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

  const inp: React.CSSProperties = { width: "100%", background: P.bg, border: `1px solid ${P.text}`, padding: "10px 12px 10px 34px", color: P.text, fontFamily: MONO, fontSize: 12, letterSpacing: "0.04em", outline: "none" };

  const submit = async () => {
    setError(""); setLoading(true);
    try {
      const body = mode === "login" ? { username, password } : { username, email, password };
      const r = await fetch(`/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) { setError((await r.text()) || "Sign-in failed"); return; }
      const d = await r.json(); onAuth(d.token, d.username); onClose();
    } catch { setError("Connection error"); } finally { setLoading(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(26,23,20,0.55)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div role="dialog" aria-label={mode === "login" ? "Sign in" : "Create account"}
        style={{ width: 380, maxWidth: "100%", background: P.bg, border: `1px solid ${P.border}`, padding: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: `1px solid ${P.border}`, background: P.panel }}>
          <span style={{ fontFamily: SLAB, fontSize: 18, fontWeight: 600, color: P.text, letterSpacing: "0.01em" }}>
            {mode === "login" ? "Sign in" : "Create account"}
          </span>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: P.text, cursor: "pointer", padding: 4 }}><X size={16} /></button>
        </div>
        <div style={{ padding: 24 }}>
        {error && <div style={{ background: P.panel, border: `1px solid ${P.red}`, padding: "8px 12px", fontFamily: MONO, fontSize: 10.5, color: P.red, marginBottom: 14, letterSpacing: "0.02em" }}>{error}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ position: "relative" }}>
            <User size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: P.muted, pointerEvents: "none" }} />
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" style={inp} onKeyDown={e => e.key === "Enter" && submit()} />
          </div>
          {mode === "register" && (
            <div style={{ position: "relative" }}>
              <Mail size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: P.muted, pointerEvents: "none" }} />
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email" style={inp} />
            </div>
          )}
          <div style={{ position: "relative" }}>
            <Lock size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: P.muted, pointerEvents: "none" }} />
            <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Password"
              type={showPw ? "text" : "password"} style={{ ...inp, paddingRight: 34 }} onKeyDown={e => e.key === "Enter" && submit()} />
            <button onClick={() => setShowPw(v => !v)} aria-label={showPw ? "Hide password" : "Show password"} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: P.muted, cursor: "pointer", padding: 2 }}>
              {showPw ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
          <button onClick={submit} disabled={loading}
            style={{ background: P.accent, border: "none", color: P.bg, fontFamily: SANS, fontSize: 14, letterSpacing: "0", fontWeight: 600, padding: "12px", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 8 }}>
            {loading && <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />}
            {loading ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </div>
        <div style={{ marginTop: 16, textAlign: "center", fontFamily: MONO, fontSize: 10.5, color: P.muted, letterSpacing: "0.02em" }}>
          {mode === "login" ? "No account? " : "Have an account? "}
          <button onClick={() => { setMode(m => m === "login" ? "register" : "login"); setError(""); }}
            style={{ background: "none", border: "none", color: P.accent, cursor: "pointer", fontFamily: MONO, fontSize: 10.5, textDecoration: "underline", textUnderlineOffset: 3 }}>
            {mode === "login" ? "Create one" : "Sign in"}
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}

// One-click sample so a first-time visitor can try the analyzer without hunting for
// an article. Mixes a false/exaggerated claim + conspiracy framing with checkable
// facts, so the verdicts panel shows CONTRADICTED and SUPPORTED side by side.
const SAMPLE_ARTICLE =
  "BREAKING: Scientists confirm the Great Barrier Reef has completely died — 100% gone — " +
  "and the government is hiding it from the public. In a shocking report this week, insiders " +
  "revealed the entire reef is dead, yet the mainstream media refuses to cover the story. " +
  "The reef, located off the coast of Australia, was once the largest living structure on Earth, " +
  "stretching more than 2,300 kilometres. Officials claim recovery is still possible, but sources " +
  "say that is a lie designed to protect tourism profits. Wake up — they don't want you to know " +
  "the truth about what is really happening to our oceans.";

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
  const [loadingMsg, setLoadingMsg]   = useState("PREPARING");
  const [result, setResult]           = useState<AnalysisResult | null>(null);
  const [scanError, setScanError]     = useState("");
  const [groundedVerdicts, setGroundedVerdicts] = useState<GroundedVerdict[] | null>(null);
  const [verifying, setVerifying]     = useState(false);
  const [verifyError, setVerifyError] = useState("");
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
  const [gdeltCoverage, setGdeltCoverage] = useState<GdeltCoverage | null>(null);
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
      setGdeltCoverage(d.gdelt_coverage || null);
      // If /analyze had no sources_used (e.g. older cached investigation), borrow from /timeline.
      if (!result.sources_used?.length && Array.isArray(d.sources_used) && d.sources_used.length) {
        setResult(prev => prev ? { ...prev, sources_used: d.sources_used } : prev);
      }
    } catch (e) {
      setTimelineError("Could not build timeline: " + (e instanceof Error ? e.message : String(e)));
    } finally { setTimelineLoading(false); }
  }, [result, timelineLoading]);

  // Grounded fact-check: run each extracted claim through the agentic
  // /verify-claims loop, which returns SUPPORTED/CONTRADICTED/INSUFFICIENT
  // verdicts carrying verbatim, credibility-tiered evidence spans.
  const runGroundedVerification = useCallback(async () => {
    if (!result || verifying) return;
    const claims = (result.claims || []).map(c => c.text).filter(Boolean).slice(0, 5);
    if (claims.length === 0) { setVerifyError("No verifiable claims were extracted to fact-check."); return; }
    setVerifying(true); setVerifyError("");
    try {
      const r = await apiFetch("/verify-claims", { method: "POST", body: JSON.stringify({ claims, max_claims: 5 }) });
      if (r.status === 401) { setShowLogin(true); return; }
      if (!r.ok) throw new Error(await friendlyError(r));
      const d = await r.json();
      setGroundedVerdicts(d.verdicts || []);
    } catch (e) {
      setVerifyError(e instanceof Error ? e.message : String(e));
    } finally { setVerifying(false); }
  }, [result, verifying]);

  const executeScan = async (overrideText?: string) => {
    if (!token) { setShowLogin(true); return; }
    const sourceText = overrideText ?? input;
    if (!sourceText.trim()) return;
    setLoading(true); setResult(null); setScanError(""); setFetchedTitle(""); setLangBadge("");
    setChatMessages([]); setSuggestions([]);
    setGroundedVerdicts(null); setVerifyError(""); setVerifying(false);
    setClaimTimeline(null); setGdeltCoverage(null); setTimelineError(""); setTimelineOpen(false); setExpandedSrc(null);
    try {
      let articleText = sourceText, displayTitle = "";
      if (activeTab === "URL" && !overrideText) {
        setLoadingMsg("FETCHING ARTICLE");
        const r = await apiFetch("/fetch-url", { method: "POST", body: JSON.stringify({ url: sourceText }) });
        if (r.status === 401) { setShowLogin(true); return; }
        if (!r.ok) throw new Error(await friendlyError(r));
        const d = await r.json();
        articleText = d.text; displayTitle = d.title || sourceText;
        if (d.source_language && d.source_language !== "English") setLangBadge(d.source_language);
        setFetchedTitle(displayTitle);
      }
      setLoadingMsg("ANALYZING");
      const r2 = await apiFetch("/analyze", { method: "POST", body: JSON.stringify({ article: articleText }) });
      if (r2.status === 401) { setShowLogin(true); return; }
      if (!r2.ok) throw new Error(await friendlyError(r2));
      const analysis: AnalysisResult = await r2.json();
      saveInvestigation(analysis, displayTitle || sourceText);
      analysis._article_text = articleText;  // for lazy /timeline lookup (not persisted)
      setResult(analysis);
      setActiveNav("neural");
      fetchSuggestions(analysis);
    } catch (e: unknown) {
      setScanError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  };

  const loadSample = () => {
    setActiveTab("TEXT");
    setInput(SAMPLE_ARTICLE);
    setScanError("");
    setResult(null);
    setFetchedTitle("Sample article (editable)");
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
        if (!r.ok) throw new Error(await friendlyError(r));
        const analysis: AnalysisResult = await r.json();
        setResult(analysis);
        saveInvestigation(analysis, file.name);
        setActiveNav("neural");
        fetchSuggestions(analysis);
      } catch (err) {
        alert("Image analysis error: " + (err instanceof Error ? err.message : String(err)));
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
      if (!r.ok) throw new Error(await friendlyError(r));
      const { transcript } = await r.json();
      if (!transcript || !transcript.trim()) { alert("No speech detected."); return; }
      setActiveTab("TEXT");
      setInput(transcript);
      setFetchedTitle(label);
      setLoading(false);  // let executeScan re-set loading
      await executeScan(transcript);
    } catch (err) {
      alert("Transcription error: " + (err instanceof Error ? err.message : String(err)));
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
      if (!r.ok) throw new Error(await friendlyError(r));
      if (!r.body) throw new Error("no-body");
      const reader = r.body.getReader(), decoder = new TextDecoder();
      let assistant = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistant += decoder.decode(value, { stream: true });
        setChatMessages([...newHistory, { role: "assistant", content: assistant }]);
      }
    } catch (e) {
      const msg = e instanceof Error && e.message && e.message !== "no-body"
        ? e.message
        : "Sorry — I couldn't finish that response. The model may be busy; please try again.";
      setChatMessages([...newHistory, { role: "assistant", content: msg }]);
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

  // Verdict chips for saved analyses (mono markers, neutral chrome). The stored
  // keys stay stable for backward compatibility; only the displayed label is plain.
  const verdictStyle = (v: string) =>
    v === "DECEPTIVE"    ? { color: P.red,   fill: true } :
    v === "VERIFIED"     ? { color: P.green, fill: true } :
                           { color: P.muted, fill: false };
  const verdictLabel = (v: string) =>
    v === "DECEPTIVE"    ? "Likely misleading" :
    v === "VERIFIED"     ? "No major flags" :
    v === "UNDER_REVIEW" ? "Mixed signals" :
                           v.replace(/_/g, " ");

  const metricColor = (pct: number) => pct >= 70 ? P.red : pct >= 40 ? P.muted : P.green;

  const metrics = [
    { label: "Synthetic content",     pct: syntheticPct, status: syntheticPct >= 70 ? "STRONG" : syntheticPct >= 40 ? "MODERATE" : "LOW" },
    { label: "Persuasion load",       pct: rhetPct,      status: rhetPct >= 70 ? "HEAVY" : rhetPct >= 40 ? "NOTABLE" : "MINIMAL" },
    { label: "Source-reliability flag", pct: srcObfPct,  status: srcObfPct >= 70 ? "STRONG" : srcObfPct >= 40 ? "NOTABLE" : "CLEAR" },
  ];

  // ── Shared styles (Airbnb: soft white cards, hairline rules, rounded corners) ──
  const CARD_SHADOW = "rgba(0,0,0,0.02) 0 0 0 1px, rgba(0,0,0,0.04) 0 2px 6px 0, rgba(0,0,0,0.1) 0 4px 8px 0";
  const S = {
    // A soft white card - hairline + 14px radius + single shadow tier.
    card: { background: P.card, border: `1px solid ${P.border2}`, borderRadius: 14, boxShadow: CARD_SHADOW, overflow: "hidden" } as React.CSSProperties,
    // Card header strip - clean Inter label on white, hairline divider beneath.
    cardHd: { padding: "14px 18px", borderBottom: `1px solid ${P.border2}`, background: P.card, display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: SANS, fontSize: 14, letterSpacing: "0", color: P.text, fontWeight: 600 } as React.CSSProperties,
    btnFilled: { background: P.accent, border: "none", color: "#ffffff", fontFamily: SANS, fontSize: 14, letterSpacing: "0", fontWeight: 600, padding: "12px 22px", cursor: "pointer", borderRadius: 8 } as React.CSSProperties,
    btnOutline: { background: "#ffffff", border: `1px solid ${P.text}`, color: P.text, fontFamily: SANS, fontSize: 14, letterSpacing: "0", fontWeight: 600, padding: "11px 20px", cursor: "pointer", borderRadius: 8 } as React.CSSProperties,
    btnGhost: { background: "transparent", border: `1px solid ${P.border}`, color: P.text, fontFamily: SANS, fontSize: 13, letterSpacing: "0", fontWeight: 500, padding: "9px 14px", cursor: "pointer", borderRadius: 8 } as React.CSSProperties,
    tab: (active: boolean): React.CSSProperties => ({ fontFamily: SANS, fontSize: 13, letterSpacing: "0", fontWeight: active ? 600 : 500, padding: "8px 16px", cursor: "pointer", border: `1px solid ${active ? P.accent : P.border}`, background: active ? P.accent : "transparent", color: active ? "#ffffff" : P.muted, borderRadius: 9999 }),
    // Section header - clean hairline rule + Inter title (numbering kept as a small Rausch index).
    secHead: { display: "flex", alignItems: "baseline", gap: 12, borderBottom: `1px solid ${P.border}`, paddingBottom: 12, marginBottom: 20, flexWrap: "wrap" } as React.CSSProperties,
    secNo: { fontFamily: SANS, fontWeight: 700, fontSize: 13, color: P.accent, letterSpacing: "0" } as React.CSSProperties,
    secTitle: { fontFamily: SANS, fontWeight: 700, fontSize: 22, letterSpacing: "-0.02em", color: P.text, lineHeight: 1.2 } as React.CSSProperties,
    secKicker: { marginLeft: "auto", fontFamily: SANS, fontSize: 13, letterSpacing: "0", color: P.muted } as React.CSSProperties,
  };

  // Reusable section header (decimal-numbered, ruled).
  const SectionHead = ({ title, kicker }: { title: string; kicker?: string }) => (
    <div style={S.secHead}>
      <span style={S.secTitle}>{title}</span>
      {kicker && <span style={S.secKicker}>{kicker}</span>}
    </div>
  );

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

      <div>

        {/* ── Full-bleed sticky top nav (wordmark left · actions right) ── */}
        <header style={{ position: "sticky", top: 0, zIndex: 30, background: P.nav, borderBottom: `1px solid ${P.border}` }}>
          <nav aria-label="Primary" style={{ maxWidth: 1152, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, padding: "0 24px", minHeight: 72 }}>
            <a href="/" style={{ display: "inline-flex", alignItems: "baseline", textDecoration: "none", fontFamily: SANS, fontWeight: 800, fontSize: 22, letterSpacing: "-0.02em", color: P.text }}>
              GKIN<span style={{ color: P.accent }}>.</span>
            </a>
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
              <button onClick={() => setShowArchives(false)} style={{ fontFamily: SANS, fontSize: 15, fontWeight: !showArchives ? 600 : 500, color: !showArchives ? P.text : P.muted, padding: "8px 14px", background: "transparent", border: "none", cursor: "pointer", borderRadius: 8 }}>Analyze</button>
              <button onClick={() => setShowArchives(true)} style={{ fontFamily: SANS, fontSize: 15, fontWeight: showArchives ? 600 : 500, color: showArchives ? P.text : P.muted, padding: "8px 14px", background: "transparent", border: "none", cursor: "pointer", borderRadius: 8 }}>History</button>
              {token
                ? <>
                    <span style={{ fontFamily: SANS, fontSize: 14, color: P.muted, padding: "0 6px" }}>{username}</span>
                    <button onClick={handleLogout} style={{ fontFamily: SANS, fontSize: 14, fontWeight: 500, color: P.text, background: "transparent", border: `1px solid ${P.border}`, borderRadius: 9999, padding: "8px 16px", cursor: "pointer" }}>Sign out</button>
                  </>
                : <button onClick={() => setShowLogin(true)} style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: "#ffffff", background: P.accent, border: "none", borderRadius: 9999, padding: "9px 18px", cursor: "pointer" }}>Sign in</button>
              }
            </div>
          </nav>
        </header>

        <div style={{ maxWidth: 1152, margin: "0 auto", padding: "0 0 40px" }}>
        {/* ── History (Archives) view ── */}
        {showArchives && (
          <div style={{ padding: "26px 26px 8px" }}>
            <SectionHead title="History" kicker={`${investigations.length} record${investigations.length !== 1 ? "s" : ""} on file`} />
            <p style={{ fontSize: 15, color: P.text2, lineHeight: 1.6, maxWidth: 560, marginBottom: 20 }}>
              {token ? `Saved analyses for ${username}.` : "Sign in to see your saved analyses."}
            </p>
            {investigations.length === 0 ? (
              <div style={{ border: `1px solid ${P.border}`, background: P.panel, padding: 32, textAlign: "center", fontFamily: MONO, fontSize: 11, color: P.faint, letterSpacing: "0.06em" }}>
                {token ? "No analyses on file yet. Run an analysis to begin." : "Sign in to view your history."}
              </div>
            ) : (
              <div style={{ border: `1px solid ${P.border}` }}>
                {investigations.map((inv, idx) => {
                  const vs = verdictStyle(inv.verdict);
                  return (
                    <div key={inv.id}
                      onClick={() => { setShowArchives(false); setResult(inv.result); setActiveNav("neural"); setChatMessages([]); fetchSuggestions(inv.result); }}
                      style={{ padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 16, borderTop: idx > 0 ? `1px solid ${P.border}` : "none" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
                          <span style={{ fontFamily: MONO, fontSize: 10, color: P.muted, letterSpacing: "0.06em" }}>{inv.id}</span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: vs.color }}>
                            <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", border: `1.5px solid ${vs.color}`, background: vs.fill ? vs.color : "transparent" }} />
                            {verdictLabel(inv.verdict)}
                          </span>
                          <span style={{ fontFamily: MONO, fontSize: 10, color: P.faint, marginLeft: "auto" }}>{timeAgo(inv.timestamp)}</span>
                        </div>
                        <p style={{ fontSize: 14.5, color: P.text, lineHeight: 1.4, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{inv.snippet}{inv.snippet.length >= 90 ? "…" : ""}</p>
                      </div>
                      <ArrowRight size={14} color={P.muted} style={{ flexShrink: 0 }} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Analyze view ── */}
        {!showArchives && <>

          {/* Status banner - subject + assessment chip (Airbnb-clean) */}
          <div style={{ padding: "20px 24px", borderBottom: `1px solid ${P.border}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: SANS, fontSize: 12, color: P.faint, marginBottom: 4 }}>
                  {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  {" · "}{activeTab === "URL" ? "URL" : activeTab === "MEDIA" ? "Media" : "Text"}
                  {" · "}{result ? `GKIN-${(investigations[0]?.id || "0000").replace("DX-", "")}` : "Draft"}
                </div>
                <div style={{ fontFamily: SANS, fontSize: 18, fontWeight: 600, color: P.text, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 640 }}>
                  {fetchedTitle ? fetchedTitle : "Source under analysis"}
                </div>
              </div>
              {(() => {
                const statusColor = result ? (mi >= 60 ? P.red : mi >= 40 ? P.muted : P.green) : P.muted;
                const statusBg = result ? (mi >= 60 ? "#fbeaec" : mi >= 40 ? "#f2f2f2" : "#e8f3ec") : "#f7f7f7";
                const statusText = result
                  ? `${mi >= 60 ? "Likely misleading" : mi >= 40 ? "Mixed signals" : "No major flags"} · MI ${mi}/100`
                  : "Awaiting a source";
                return (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, background: statusBg, color: statusColor, fontFamily: SANS, fontSize: 13, fontWeight: 600, padding: "7px 14px", borderRadius: 9999, whiteSpace: "nowrap" }}>
                    <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor }} />
                    {statusText}
                  </span>
                );
              })()}
            </div>
            {!result && (
              <p style={{ fontFamily: SANS, fontSize: 13, color: P.muted, marginTop: 10, lineHeight: 1.5, maxWidth: 620 }}>
                Every verdict is tied to a source sentence, or declared insufficient.
              </p>
            )}
          </div>

          <div style={{ padding: "26px 26px 8px" }}>

          {/* Translation note */}
          {langBadge && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 16, padding: "6px 12px", background: P.panel, border: `1px solid ${P.border}`, fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", color: P.text2 }}>
              TRANSLATED FROM: {langBadge.toUpperCase()}
            </div>
          )}

          {/* Intake - source bar / ingestion */}
          <div style={{ ...S.card, marginBottom: 22 }}>
            <div style={S.cardHd}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Search size={11} /> Source intake
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {(["TEXT", "URL", "MEDIA"] as const).map(t => (
                  <button key={t} style={S.tab(activeTab === t)} onClick={() => setActiveTab(t)}>{t}</button>
                ))}
              </div>
            </div>
            <div style={{ position: "relative", borderBottom: `1px solid ${P.border}` }}>
              {fetchedTitle && (
                <div style={{ padding: "10px 14px 0", fontFamily: MONO, fontSize: 10, color: P.accent, letterSpacing: "0.06em" }}>
                  SOURCE: {fetchedTitle}
                </div>
              )}
              {activeTab === "MEDIA" ? (
                <button type="button" onClick={openFilePicker}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", minHeight: 132, padding: "26px 14px", background: "transparent", border: "none", cursor: "pointer", color: P.muted }}>
                  <Upload size={20} />
                  <span style={{ fontSize: 14, color: P.text, fontWeight: 600 }}>Upload a screenshot or audio file</span>
                  <span style={{ fontSize: 12, color: P.muted, textAlign: "center" }}>PNG / JPG screenshot, or MP3 / WAV / M4A audio — or use the mic below</span>
                </button>
              ) : (
                <textarea value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && e.metaKey) executeScan(); }}
                  placeholder={activeTab === "URL" ? "Paste a URL: youtube.com/watch?v=… or any article" : "Paste article text or a headline to analyze…"}
                  rows={6}
                  style={{ background: "transparent", border: "none", outline: "none", resize: "none", color: P.text, fontFamily: "inherit", fontSize: 15, lineHeight: 1.6, width: "100%", padding: "14px", display: "block" }}
                />
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="text/*,image/*,audio/*,.txt,.md,.csv,.rtf,.png,.jpg,.jpeg,.webp,.gif,.mp3,.wav,.m4a,.ogg,.webm,.flac"
                  style={{ display: "none" }}
                  onChange={onFileChosen}
                />
                <button type="button" style={S.btnGhost} onClick={openFilePicker} title="Upload a file: text, image, or audio" aria-label="Upload file">
                  <Upload size={13} />
                </button>
                <button
                  type="button"
                  style={{ ...S.btnGhost, color: isRecording ? P.red : P.text, borderColor: isRecording ? P.red : P.text }}
                  onClick={toggleMic}
                  title={isRecording ? "Stop recording (analyzes on stop)" : "Record from microphone"}
                  aria-label="Record from microphone"
                  aria-pressed={isRecording}
                >
                  <Mic size={13} />
                </button>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {loading && (
                  <span style={{ fontFamily: MONO, fontSize: 10, color: P.accent, letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 6 }}>
                    <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> {loadingMsg}…
                  </span>
                )}
                <button style={{ ...S.btnFilled, display: "flex", alignItems: "center", gap: 7, opacity: (loading || !input.trim()) ? 0.5 : 1, cursor: (loading || !input.trim()) ? "not-allowed" : "pointer" }}
                  onClick={() => executeScan()} disabled={loading || !input.trim()}>
                  {loading ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> : <ArrowRight size={12} />}
                  Analyze
                </button>
              </div>
            </div>
          </div>

          {/* ── Error state ── */}
          {scanError && !loading && (
            <div style={{ ...S.card, marginBottom: 22, borderColor: P.red }}>
              <div style={{ ...S.cardHd, color: P.red, borderBottomColor: P.red }}><span>Analysis failed</span><AlertTriangle size={12} /></div>
              <div style={{ padding: 20, textAlign: "center" }}>
                <p style={{ fontSize: 15, color: P.text, lineHeight: 1.6, marginBottom: 6 }}>GKIN could not complete this analysis.</p>
                <p style={{ fontFamily: MONO, fontSize: 11, color: P.muted, lineHeight: 1.6, marginBottom: 16, wordBreak: "break-word" }}>{scanError}</p>
                <button style={{ ...S.btnFilled, display: "inline-flex", alignItems: "center", gap: 7 }} onClick={() => executeScan()}>
                  <RefreshCw size={12} /> Retry
                </button>
              </div>
            </div>
          )}

          {/* ── Empty / initial state ── */}
          {!result && !loading && !scanError && (
            <div style={{ ...S.card, padding: "32px 28px", marginBottom: 22 }}>
              <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: P.accent, marginBottom: 12 }}>
                Ready when you are
              </div>
              <p style={{ fontSize: 17, color: P.text, lineHeight: 1.6, maxWidth: "58ch", marginBottom: 22 }}>
                Paste an article, URL, screenshot, or audio clip and run an analysis. GKIN scores manipulation,
                checks each claim, and ties every verdict to the exact source sentence that backs it, or tells you the record is silent.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", marginBottom: 14 }}>
                <span style={{ fontFamily: SANS, fontSize: 13, color: P.muted, fontWeight: 500 }}>Verdicts</span>
                <VerdictBadge verdict="supported" />
                <VerdictBadge verdict="contradicted" />
                <VerdictBadge verdict="insufficient" />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <span style={{ fontFamily: SANS, fontSize: 13, color: P.muted, fontWeight: 500, marginRight: 6 }}>Source tiers</span>
                <TierBadge tier={1} /><TierBadge tier={2} /><TierBadge tier={3} /><TierBadge tier={0} />
              </div>
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${P.border}`, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
                <button style={{ ...S.btnFilled, display: "inline-flex", alignItems: "center", gap: 7 }} onClick={loadSample}>
                  <ArrowRight size={12} /> Load a sample article
                </button>
                <span style={{ fontFamily: SANS, fontSize: 13, color: P.muted }}>
                  New here? Load one with a click, then press Analyze.
                </span>
              </div>
            </div>
          )}

          {/* ── Loading placeholder ── */}
          {loading && !result && (
            <div style={{ ...S.card, padding: "34px 28px", marginBottom: 22, textAlign: "center" }}>
              <Loader2 size={22} style={{ animation: "spin 1s linear infinite", color: P.accent }} />
              <div style={{ fontFamily: SANS, fontSize: 14, letterSpacing: "0", color: P.muted, marginTop: 12 }}>{loadingMsg}…</div>
            </div>
          )}

          {/* ════════════════ RESULTS - read top-to-bottom as a case file ════════════════ */}
          {result && (() => {
            const sources = result.sources_used || [];
            const trustedCount = sources.filter(s => (s.tier ?? 0) > 0).length;
            const claims = result.claims || [];
            const verdictWord = mi >= 60 ? "Likely misleading" : mi >= 40 ? "Mixed signals" : "No major flags";
            const verdictColor = mi >= 60 ? P.red : mi >= 40 ? P.muted : P.green;
            return (
              <>

              {/* ───────── 1.0 VERDICT ───────── */}
              <section style={{ marginBottom: 26 }}>
                <SectionHead title="Verdict" kicker="Layer 1 · overall assessment" />
                <div style={{ border: `1px solid ${P.border}`, display: "grid", gridTemplateColumns: "1fr 250px" }} className="verdict-grid">
                  <div style={{ padding: "18px 20px" }}>
                    <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "0.1em", color: P.muted, marginBottom: 6 }}>Assessment</div>
                    <div style={{ fontFamily: SLAB, fontWeight: 700, fontSize: 30, lineHeight: 1.05, color: verdictColor, marginBottom: 12 }}>{verdictWord}</div>
                    <p style={{ fontSize: 16, lineHeight: 1.55, maxWidth: "52ch", margin: 0, color: P.text }}>
                      {result.summary || "Summary not available for this source."}
                    </p>
                    {result.narrative_cluster && (
                      <div style={{ marginTop: 14, fontFamily: MONO, fontSize: 11, letterSpacing: "0.06em", color: P.muted }}>
                        NARRATIVE CLUSTER: <span style={{ color: P.text }}>{result.narrative_cluster.toUpperCase()}</span>
                      </div>
                    )}
                  </div>
                  <div style={{ borderLeft: `1px solid ${P.border}`, padding: "18px 18px", display: "flex", flexDirection: "column", justifyContent: "center" }} className="gauge-cell">
                    <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", color: P.accent, marginBottom: 8 }}>Manipulation index</div>
                    <Gauge score={mi} />
                  </div>
                </div>
              </section>

              {/* ───────── 2.0 EVIDENCE ───────── */}
              <section id="evidence" style={{ marginBottom: 26 }}>
                <SectionHead title="Evidence" kicker={`Layer 2 · ${claims.length} claim${claims.length !== 1 ? "s" : ""}`} />

                {/* Grounded fact-check (agentic /verify-claims) */}
                <div style={{ ...S.card, marginBottom: 16 }}>
                  <div style={S.cardHd}>
                    <span>Grounded fact-check{groundedVerdicts ? ` · ${groundedVerdicts.length}` : ""}</span>
                    <ShieldCheck size={12} />
                  </div>
                  <div style={{ padding: 16 }}>
                    {!groundedVerdicts && !verifying && !verifyError && (
                      <div>
                        <p style={{ fontSize: 14.5, color: P.text2, lineHeight: 1.6, maxWidth: "60ch", margin: "0 0 14px" }}>
                          Run each extracted claim through GKIN's retrieval-grounded loop. Every supported or contradicted verdict is tied to the exact source sentence that backs it, or returns insufficient. (~10–20s)
                        </p>
                        <button style={{ ...S.btnFilled, display: "inline-flex", alignItems: "center", gap: 7 }} onClick={runGroundedVerification}>
                          <ShieldCheck size={12} /> Verify with sources
                        </button>
                      </div>
                    )}
                    {verifying && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 0", color: P.accent, fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em" }}>
                        <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> GROUNDING CLAIMS AGAINST LIVE SOURCES…
                      </div>
                    )}
                    {!verifying && verifyError && (
                      <div>
                        <div style={{ fontSize: 13, color: P.red, marginBottom: 12, lineHeight: 1.5, wordBreak: "break-word" }}>{verifyError}</div>
                        <button style={{ ...S.btnFilled, display: "inline-flex", alignItems: "center", gap: 7 }} onClick={runGroundedVerification}>
                          <RefreshCw size={12} /> Retry
                        </button>
                      </div>
                    )}
                    {!verifying && groundedVerdicts && groundedVerdicts.length === 0 && (
                      <p style={{ color: P.muted, fontSize: 14 }}>No claims were verified.</p>
                    )}
                    {!verifying && groundedVerdicts && groundedVerdicts.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                        {groundedVerdicts.map((gv, i) => {
                          const conf = Math.round((gv.confidence || 0) * 100);
                          const hard = gv.label === "SUPPORTED" || gv.label === "CONTRADICTED";
                          return (
                            <div key={i} style={{ borderLeft: `3px solid ${P.accent}`, paddingLeft: 14 }}>
                              <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.12em", color: P.muted, marginBottom: 6 }}>Finding {String(i + 1).padStart(2, "0")} · Claim under review</div>
                              <p style={{ fontFamily: SLAB, fontWeight: 600, fontSize: 16, color: P.text, marginBottom: 10, lineHeight: 1.35 }}>{gv.claim_text}</p>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", marginBottom: 8 }}>
                                <VerdictBadge verdict={gv.label} />
                                {hard && <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", color: P.muted }}>{conf}% CONFIDENCE</span>}
                                {gv.low_confidence && (
                                  <span style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 600, letterSpacing: "0.06em", color: P.muted, border: `1px solid ${P.border}`, padding: "1px 6px" }}>LOW CONFIDENCE</span>
                                )}
                              </div>
                              {gv.reasoning && (
                                <p style={{ fontSize: 13.5, color: P.text2, lineHeight: 1.55, marginBottom: gv.evidence?.length ? 10 : 0 }}>{gv.reasoning}</p>
                              )}
                              {gv.evidence && gv.evidence.length > 0 && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                  {gv.evidence.map((ev, j) => (
                                    <div key={j} style={{ background: P.panel, border: `1px solid ${P.border}`, padding: "8px 10px" }}>
                                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 5 }}>
                                        <TierBadge tier={ev.tier} trusted={ev.trusted} />
                                        <a href={ev.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: MONO, fontSize: 9.5, color: P.accent, textDecoration: "underline", textUnderlineOffset: 2, letterSpacing: "0.04em" }}>
                                          {hostOf(ev.url)}
                                        </a>
                                      </div>
                                      <p style={{ fontSize: 14, color: P.text2, lineHeight: 1.6, margin: 0, fontStyle: "italic" }}>“{ev.sentence}”</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <button onClick={runGroundedVerification} style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", color: P.accent, fontFamily: MONO, fontSize: 10, letterSpacing: "0.06em", cursor: "pointer", padding: 0 }}>
                          <RefreshCw size={11} /> Re-run
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick-pass claim findings as a ruled table */}
                <div style={S.card}>
                  <div style={S.cardHd}><span>Checkable claims (quick pass)</span></div>
                  {claims.length === 0 ? (
                    <div style={{ padding: 16, fontFamily: MONO, fontSize: 11, color: P.faint, letterSpacing: "0.06em" }}>NO VERIFIABLE CLAIMS EXTRACTED</div>
                  ) : (
                    <div>
                      {claims.map((c, i) => {
                        const v = c.verification?.verdict || "insufficient";
                        const citationIds = c.citation_ids || [];
                        return (
                          <div key={i} style={{ display: "grid", gridTemplateColumns: "120px 1fr", borderTop: `1px solid ${P.border}` }} className="finding-row">
                            <div style={{ background: P.panel, borderRight: `1px solid ${P.border}`, padding: 14 }}>
                              <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: 12, color: P.accent, letterSpacing: "0.04em", marginBottom: 9 }}>Finding {String(i + 1).padStart(2, "0")}</div>
                              <VerdictBadge verdict={v} />
                            </div>
                            <div style={{ padding: 14 }}>
                              <p style={{ fontFamily: SLAB, fontWeight: 600, fontSize: 16, color: P.text, lineHeight: 1.35, margin: "0 0 8px" }}>
                                {c.text}
                                {citationIds.length > 0 && (
                                  <span style={{ marginLeft: 6, display: "inline-flex", gap: 4, verticalAlign: "baseline" }}>
                                    {citationIds.slice(0, 6).map(idx => {
                                      const s = sources[idx];
                                      if (!s) return null;
                                      const tip = `${s.hostname}${s.published_date ? " · " + s.published_date : ""}${s.relevance_snippet ? "\n\n" + s.relevance_snippet : ""}`;
                                      return (
                                        <a key={idx} href="#sources" title={tip}
                                          onClick={() => { setExpandedSrc(idx); }}
                                          style={{ display: "inline-flex", alignItems: "center", fontFamily: MONO, fontSize: 10, fontWeight: 600, color: P.accent, border: `1px solid ${P.accent}`, padding: "0 5px", cursor: "pointer", letterSpacing: "0.02em", lineHeight: 1.4, textDecoration: "none" }}>
                                          {idx + 1}
                                        </a>
                                      );
                                    })}
                                  </span>
                                )}
                              </p>
                              {c.verification?.explanation && <p style={{ fontSize: 14, color: P.text2, lineHeight: 1.55, margin: 0 }}>{c.verification.explanation}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <p style={{ fontFamily: MONO, fontSize: 11, color: P.muted, letterSpacing: "0.04em", marginTop: 12, lineHeight: 1.6, fontStyle: "italic" }}>
                  Note: source tier reflects proximity to the primary record, not editorial agreement.
                </p>
              </section>

              {/* ───────── 3.0 APPENDIX / DETAILS ───────── */}
              <section style={{ marginBottom: 26 }}>
                <SectionHead title="Appendix" kicker="Layer 3 · details" />
                <div style={{ border: `1px solid ${P.border}` }}>

                  {/* 3.1 Persuasion techniques */}
                  <details open style={{ borderTop: "none" }}>
                    <summary style={{ listStyle: "none", cursor: "pointer", display: "flex", alignItems: "baseline", gap: 14, padding: "13px 16px", userSelect: "none" }}>
                      <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 12, color: P.accent, width: 34, flexShrink: 0 }}>3.1</span>
                      <span style={{ fontFamily: SLAB, fontWeight: 600, fontSize: 16, color: P.text }}>Persuasion techniques</span>
                      <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", color: P.muted }}>{techniques.length} found</span>
                    </summary>
                    <div style={{ padding: "4px 16px 16px 64px", borderTop: `1px solid ${P.border}`, background: P.panel }}>
                      {techniques.length === 0
                        ? <p style={{ fontFamily: MONO, fontSize: 11, color: P.faint, padding: "10px 0", letterSpacing: "0.06em" }}>NONE DETECTED</p>
                        : techniques.map((t, i) => (
                          <div key={i} style={{ borderTop: i > 0 ? `1px solid ${P.border}` : "none", padding: "11px 0" }}>
                            <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: P.accent, marginBottom: 4 }}>{t.technique.replace(/_/g, " ")}</div>
                            {t.span && <p style={{ fontSize: 14, color: P.text2, fontStyle: "italic", lineHeight: 1.5, margin: "0 0 4px" }}>“{t.span}”</p>}
                            {t.explanation && <p style={{ fontSize: 14, color: P.text, lineHeight: 1.5, margin: 0 }}>{t.explanation}</p>}
                          </div>
                        ))}
                    </div>
                  </details>

                  {/* 3.2 Emotional framing */}
                  {Object.keys(emotionScores).length > 0 && (
                    <details style={{ borderTop: `1px solid ${P.border}` }}>
                      <summary style={{ listStyle: "none", cursor: "pointer", display: "flex", alignItems: "baseline", gap: 14, padding: "13px 16px", userSelect: "none" }}>
                        <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 12, color: P.accent, width: 34, flexShrink: 0 }}>3.2</span>
                        <span style={{ fontFamily: SLAB, fontWeight: 600, fontSize: 16, color: P.text }}>Emotional framing</span>
                      </summary>
                      <div style={{ padding: "14px 16px 16px 64px", borderTop: `1px solid ${P.border}`, background: P.panel }}>
                        <EmotionBars scores={emotionScores} />
                      </div>
                    </details>
                  )}

                  {/* 3.3 Missing context */}
                  <details style={{ borderTop: `1px solid ${P.border}` }}>
                    <summary style={{ listStyle: "none", cursor: "pointer", display: "flex", alignItems: "baseline", gap: 14, padding: "13px 16px", userSelect: "none" }}>
                      <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 12, color: P.accent, width: 34, flexShrink: 0 }}>3.3</span>
                      <span style={{ fontFamily: SLAB, fontWeight: 600, fontSize: 16, color: P.text }}>Missing context</span>
                      <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", color: P.muted }}>{gaps.length} gap{gaps.length !== 1 ? "s" : ""}</span>
                    </summary>
                    <div style={{ padding: "4px 16px 16px 64px", borderTop: `1px solid ${P.border}`, background: P.panel }}>
                      {gaps.length === 0
                        ? <p style={{ fontFamily: MONO, fontSize: 11, color: P.faint, padding: "10px 0", letterSpacing: "0.06em" }}>NO GAPS FLAGGED</p>
                        : gaps.map((g, i) => (
                          <div key={i} style={{ borderTop: i > 0 ? `1px solid ${P.border}` : "none", padding: "11px 0" }}>
                            <p style={{ fontSize: 14.5, color: P.text, lineHeight: 1.5, margin: "0 0 4px" }}>{g.gap}</p>
                            {g.why_it_matters && <p style={{ fontSize: 14, color: P.text2, lineHeight: 1.5, margin: 0 }}><span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.06em", color: P.muted }}>Why it matters · </span>{g.why_it_matters}</p>}
                          </div>
                        ))}
                    </div>
                  </details>

                  {/* 3.4 AI & source-reliability checks */}
                  <details style={{ borderTop: `1px solid ${P.border}` }}>
                    <summary style={{ listStyle: "none", cursor: "pointer", display: "flex", alignItems: "baseline", gap: 14, padding: "13px 16px", userSelect: "none" }}>
                      <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 12, color: P.accent, width: 34, flexShrink: 0 }}>3.4</span>
                      <span style={{ fontFamily: SLAB, fontWeight: 600, fontSize: 16, color: P.text }}>AI &amp; source-reliability checks</span>
                    </summary>
                    <div style={{ padding: "14px 16px 16px 64px", borderTop: `1px solid ${P.border}`, background: P.panel }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }} className="meta-grid">
                        {([
                          ["Source language",  result.source_language || "English"],
                          ["Bias orientation",  result.bias_orientation || "Unknown"],
                          ["AI authorship",     result.ai_detection?.verdict?.toUpperCase() || "Unknown"],
                          ["AI score",          `${syntheticPct}%`],
                          ["Source-reliability flag", result.fake_detection?.verdict?.toUpperCase() || "Unknown"],
                        ] as [string, string][]).map(([k, v]) => (
                          <div key={k} style={{ borderBottom: `1px solid ${P.border}`, paddingBottom: 8 }}>
                            <div style={{ fontFamily: MONO, fontSize: 10, color: P.muted, letterSpacing: "0.1em", marginBottom: 3 }}>{k}</div>
                            <div style={{ fontFamily: MONO, fontSize: 13, color: P.text, fontWeight: 500 }}>{v}</div>
                          </div>
                        ))}
                      </div>
                      {result.fake_detection?.reasoning && <p style={{ fontSize: 14, color: P.text2, lineHeight: 1.6, marginBottom: 12 }}>{result.fake_detection.reasoning}</p>}
                      {(result.fake_detection?.red_flags || []).length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontFamily: MONO, fontSize: 10, color: P.red, letterSpacing: "0.1em", marginBottom: 6 }}>Red flags</div>
                          {result.fake_detection!.red_flags!.map((f, i) => <div key={i} style={{ fontSize: 13.5, color: P.text, padding: "2px 0", lineHeight: 1.5 }}>• {f}</div>)}
                        </div>
                      )}
                      {(result.fake_detection?.trust_signals || []).length > 0 && (
                        <div>
                          <div style={{ fontFamily: MONO, fontSize: 10, color: P.green, letterSpacing: "0.1em", marginBottom: 6 }}>Trust signals</div>
                          {result.fake_detection!.trust_signals!.map((f, i) => <div key={i} style={{ fontSize: 13.5, color: P.text, padding: "2px 0", lineHeight: 1.5 }}>• {f}</div>)}
                        </div>
                      )}
                      <p style={{ fontFamily: MONO, fontSize: 10.5, color: P.muted, letterSpacing: "0.02em", lineHeight: 1.6, marginTop: 12, fontStyle: "italic" }}>
                        The classifier reads publisher style, not truth; it is advisory only. Adjudication rests on the grounded citations above.
                      </p>
                    </div>
                  </details>

                  {/* 3.5 Reasoning trace */}
                  {result.reasoning_trace && (
                    <details style={{ borderTop: `1px solid ${P.border}` }}>
                      <summary style={{ listStyle: "none", cursor: "pointer", display: "flex", alignItems: "baseline", gap: 14, padding: "13px 16px", userSelect: "none" }}>
                        <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 12, color: P.accent, width: 34, flexShrink: 0 }}>3.5</span>
                        <span style={{ fontFamily: SLAB, fontWeight: 600, fontSize: 16, color: P.text }}>Reasoning trace</span>
                      </summary>
                      <div style={{ padding: "8px 16px 16px 64px", borderTop: `1px solid ${P.border}`, background: P.panel }}>
                        <pre style={{ fontFamily: MONO, fontSize: 12, color: P.text2, lineHeight: 1.7, whiteSpace: "pre-wrap", maxHeight: 320, overflowY: "auto", margin: 0 }}>{result.reasoning_trace}</pre>
                      </div>
                    </details>
                  )}

                  {/* 3.6 Sources & citations */}
                  <details id="sources" style={{ borderTop: `1px solid ${P.border}` }}>
                    <summary style={{ listStyle: "none", cursor: "pointer", display: "flex", alignItems: "baseline", gap: 14, padding: "13px 16px", userSelect: "none" }}>
                      <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 12, color: P.accent, width: 34, flexShrink: 0 }}>3.6</span>
                      <span style={{ fontFamily: SLAB, fontWeight: 600, fontSize: 16, color: P.text }}>Sources &amp; citations</span>
                      <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", color: P.muted }}>
                        {sources.length > 0 ? `${trustedCount} trusted / ${sources.length}` : "0 sources"}
                      </span>
                    </summary>
                    <div style={{ borderTop: `1px solid ${P.border}`, background: P.panel }}>
                      {sources.length === 0 ? (
                        <div style={{ padding: "16px 16px 16px 64px", fontFamily: MONO, fontSize: 11, color: P.faint, letterSpacing: "0.06em" }}>No sources retrieved. No corroborating pages found.</div>
                      ) : (
                        sources.map((s, i) => {
                          const expanded = expandedSrc === i;
                          const isTrusted = (s.tier ?? 0) > 0;
                          return (
                            <div key={i} style={{ padding: "14px 16px 14px 64px", borderTop: i > 0 ? `1px solid ${P.border}` : "none", borderLeft: isTrusted ? `3px solid ${P.accent}` : "3px solid transparent" }}>
                              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                                <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, color: P.accent, border: `1px solid ${P.accent}`, padding: "1px 6px", minWidth: 26, textAlign: "center", flexShrink: 0 }}>{i + 1}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: SLAB, color: P.text, textDecoration: "none", fontSize: 16, fontWeight: 600, lineHeight: 1.35, display: "block", marginBottom: 5 }}>
                                    {s.title || s.hostname || s.url}
                                  </a>
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 6 }}>
                                    <TierBadge tier={s.tier} trusted={s.trusted} />
                                    <span style={{ fontFamily: MONO, fontSize: 10, color: P.accent }}>{s.hostname || "unknown source"}</span>
                                    {s.published_date && <span style={{ fontFamily: MONO, fontSize: 10, border: `1px solid ${P.border}`, padding: "1px 6px", color: P.text2 }}>{s.published_date}</span>}
                                  </div>
                                  <div style={{ fontSize: 14, color: P.text2, lineHeight: 1.5 }}>
                                    <span style={{ fontFamily: MONO, fontSize: 10, color: P.muted, letterSpacing: "0.06em" }}>Supports: </span>
                                    {s.claim_supported}
                                  </div>
                                  {s.relevance_snippet && (
                                    <button onClick={() => setExpandedSrc(expanded ? null : i)}
                                      style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: P.accent, fontFamily: MONO, fontSize: 10, letterSpacing: "0.06em", cursor: "pointer", padding: 0 }}>
                                      {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                                      {expanded ? "Hide excerpt" : "Show excerpt"}
                                    </button>
                                  )}
                                  {expanded && s.relevance_snippet && (
                                    <p style={{ fontSize: 14, color: P.text2, lineHeight: 1.6, marginTop: 8, padding: "10px 12px", background: P.bg, borderLeft: `3px solid ${P.accent}`, fontStyle: "italic" }}>“{s.relevance_snippet}”</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </details>

                  {/* 3.7 Claim timeline - lazy-loaded */}
                  <details style={{ borderTop: `1px solid ${P.border}` }} onToggle={e => { if ((e.target as HTMLDetailsElement).open) setTimelineOpen(true); }}>
                    <summary style={{ listStyle: "none", cursor: "pointer", display: "flex", alignItems: "baseline", gap: 14, padding: "13px 16px", userSelect: "none" }}>
                      <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 12, color: P.accent, width: 34, flexShrink: 0 }}>3.7</span>
                      <span style={{ fontFamily: SLAB, fontWeight: 600, fontSize: 16, color: P.text }}>Claim timeline</span>
                      <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", color: P.muted }}>lazy</span>
                    </summary>
                    <div style={{ padding: "14px 16px 16px 64px", borderTop: `1px solid ${P.border}`, background: P.panel }}>
                      {!claimTimeline && !timelineLoading && (
                        <div>
                          <p style={{ fontSize: 14, color: P.text2, lineHeight: 1.6, marginBottom: 14 }}>Trace how this claim spread across outlets over time. Runs a deeper scrape (~6–10s).</p>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button style={S.btnFilled} onClick={buildClaimTimeline}>Build timeline</button>
                            <button style={S.btnOutline} onClick={() => setShowNarrativeModal(true)}>Open propagation map</button>
                          </div>
                        </div>
                      )}
                      {timelineLoading && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 0", color: P.accent, fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em" }}>
                          <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> TRACING NARRATIVE LINEAGE…
                        </div>
                      )}
                      {timelineError && <p style={{ fontSize: 13, color: P.red, lineHeight: 1.6 }}>{timelineError}</p>}
                      {gdeltCoverage && gdeltCoverage.article_count > 0 && (
                        <div style={{ border: `1px solid ${P.border}`, background: P.panel, padding: "10px 12px", marginBottom: 14 }}>
                          <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.14em", color: P.accent, marginBottom: 6 }}>
                            Coverage · GDELT global news index
                          </div>
                          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontFamily: MONO, fontSize: 11, color: P.text2 }}>
                            <span><b style={{ color: P.text }}>{gdeltCoverage.article_count}</b> articles</span>
                            <span><b style={{ color: P.text }}>{gdeltCoverage.distinct_outlets}</b> outlets</span>
                            {gdeltCoverage.first_seen && <span>{gdeltCoverage.first_seen} → {gdeltCoverage.last_seen}</span>}
                          </div>
                          {gdeltCoverage.outlets && gdeltCoverage.outlets.length > 0 && (
                            <div style={{ marginTop: 7, fontFamily: MONO, fontSize: 10, color: P.muted, lineHeight: 1.6 }}>
                              {gdeltCoverage.outlets.slice(0, 12).join(" · ")}{gdeltCoverage.distinct_outlets > 12 ? " · …" : ""}
                            </div>
                          )}
                          <div style={{ marginTop: 7, fontFamily: MONO, fontSize: 9, color: P.faint, letterSpacing: "0.04em", lineHeight: 1.5 }}>
                            Coverage breadth, not a truth signal; verdicts rest on the cited sources above.
                          </div>
                        </div>
                      )}
                      {claimTimeline && claimTimeline.length === 0 && !timelineLoading && (
                        <p style={{ fontFamily: MONO, fontSize: 11, color: P.faint, letterSpacing: "0.06em" }}>NO DATED EVIDENCE FOUND TO RECONSTRUCT TIMELINE</p>
                      )}
                      {claimTimeline && claimTimeline.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                          {claimTimeline.map((ct, ci) => (
                            <div key={ci}>
                              <div style={{ marginBottom: 10 }}>
                                <div style={{ fontFamily: MONO, fontSize: 10, color: P.muted, letterSpacing: "0.1em", marginBottom: 4 }}>Claim</div>
                                <p style={{ fontFamily: SLAB, fontSize: 15, color: P.text, lineHeight: 1.4, fontWeight: 600, margin: 0 }}>{ct.claim}</p>
                                {ct.first_reported && <div style={{ fontFamily: MONO, fontSize: 10, color: P.accent, marginTop: 6, letterSpacing: "0.04em" }}>FIRST REPORTED: {ct.first_reported}</div>}
                              </div>
                              <div style={{ position: "relative", paddingLeft: 18 }}>
                                <div style={{ position: "absolute", left: 4, top: 6, bottom: 6, width: 1, background: P.border }} />
                                {ct.timeline_entries.map((te, ti) => (
                                  <div key={ti} style={{ position: "relative", paddingBottom: 14 }}>
                                    <div style={{ position: "absolute", left: -17, top: 5, width: 8, height: 8, background: P.accent, border: `1px solid ${P.text}` }} />
                                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 3 }}>
                                      <span style={{ fontFamily: MONO, fontSize: 10, color: P.accent, fontWeight: 600, letterSpacing: "0.04em" }}>{te.date || "date unknown"}</span>
                                      <a href={te.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: MONO, fontSize: 10, color: P.accent, textDecoration: "underline", textUnderlineOffset: 2 }}>{te.hostname}</a>
                                    </div>
                                    <p style={{ fontSize: 14, color: P.text, lineHeight: 1.5, margin: 0 }}>{te.how_claim_changed}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </details>

                </div>
              </section>

              {/* ───────── 4.0 ASK A QUESTION (chat, secondary panel) ───────── */}
              <section style={{ marginBottom: 26 }}>
                <SectionHead title="Ask a question" kicker="Conversational follow-up" />
                <div style={S.card}>
                  <div style={S.cardHd}>
                    <span>Assistant</span>
                    <button onClick={() => setChatMessages([])} style={S.btnGhost} title="Clear conversation">
                      <RefreshCw size={11} /> Clear
                    </button>
                  </div>

                  {chatMode === "conspiracy" && (
                    <div style={{ margin: "12px 16px 0", padding: "8px 12px", background: P.panel, border: `1px solid ${P.red}`, fontFamily: MONO, fontSize: 11, color: P.red, display: "flex", alignItems: "center", gap: 8, letterSpacing: "0.02em" }}>
                      <AlertTriangle size={13} />
                      Speculative mode: alternative theories for critical thinking only.
                    </div>
                  )}

                  {suggestions.length > 0 && chatMessages.length === 0 && (
                    <div style={{ padding: "12px 16px 0", display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {suggestions.map((s, i) => (
                        <button key={i} onClick={() => sendChat(s)}
                          style={{ fontFamily: MONO, fontSize: 11, color: P.text2, background: P.panel, border: `1px solid ${P.border}`, padding: "6px 10px", cursor: "pointer", textAlign: "left", letterSpacing: "0.01em" }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  )}

                  <div style={{ padding: 16, maxHeight: 380, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
                    {chatMessages.length === 0 && (
                      <div style={{ fontFamily: MONO, fontSize: 11, color: P.faint, textAlign: "center", padding: "24px 0", letterSpacing: "0.04em" }}>
                        Ask a question about the analyzed source.
                      </div>
                    )}
                    {chatMessages.map((m, i) => (
                      <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
                        <div style={{ maxWidth: "85%", padding: "9px 13px", fontSize: 14.5, lineHeight: 1.6,
                          background: m.role === "user" ? P.panel : P.bg,
                          color: P.text,
                          border: `1px solid ${m.role === "user" ? P.text : P.border}`,
                        }}>
                          {m.content || (chatLoading && i === chatMessages.length - 1
                            ? <span style={{ display: "flex", alignItems: "center", gap: 6, color: P.muted, fontFamily: MONO, fontSize: 12 }}><Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> Thinking…</span>
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
                      placeholder="Ask a question about the source…"
                    />
                  </div>
                </div>
              </section>

              </>
            );
          })()}

          {/* ── Recent analyses ── */}
          {investigations.length > 0 && (
            <div style={{ marginTop: 30 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${P.border}`, paddingBottom: 8, marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: MONO, fontSize: 11, color: P.text, letterSpacing: "0.12em" }}>
                  <Clock size={12} /> Recent analyses
                </div>
                <button style={S.btnGhost} onClick={() => setShowArchives(true)}>View all</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }} className="recent-grid">
                {investigations.slice(0, 3).map(inv => {
                  const vs = verdictStyle(inv.verdict);
                  return (
                    <div key={inv.id} onClick={() => { setResult(inv.result); setActiveNav("neural"); setChatMessages([]); fetchSuggestions(inv.result); }}
                      style={{ ...S.card, padding: 14, cursor: "pointer" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <span style={{ fontFamily: MONO, fontSize: 10, color: P.muted }}>{inv.id}</span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: vs.color }}>
                          <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", border: `1.5px solid ${vs.color}`, background: vs.fill ? vs.color : "transparent" }} />
                          {verdictLabel(inv.verdict)}
                        </span>
                      </div>
                      <p style={{ fontSize: 14, color: P.text, lineHeight: 1.45, marginBottom: 10 }}>{inv.snippet}{inv.snippet.length >= 90 ? "…" : ""}</p>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontFamily: MONO, fontSize: 10, color: P.faint }}>{timeAgo(inv.timestamp)}</span>
                        <ArrowRight size={12} color={P.muted} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          </div> {/* /padded body */}
          </>}

          {/* ── Colophon ── */}
          <div style={{ padding: "20px 24px 28px", borderTop: `1px solid ${P.border}`, display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", fontFamily: SANS, fontSize: 13, letterSpacing: "0", color: P.muted }}>
            <span><span style={{ fontWeight: 600, color: P.text }}>GKIN</span> · Ground Knowledge</span>
            <span style={{ color: P.accent }}>Every verdict tied to a source sentence, or declared insufficient.</span>
          </div>
        </div> {/* /content */}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        details > summary::-webkit-details-marker { display: none; }
        details > summary:hover { background: ${P.panel}; }
        a:focus-visible, button:focus-visible, summary:focus-visible, textarea:focus-visible {
          outline: 2px solid ${P.accent}; outline-offset: 2px;
        }
        @media (max-width: 760px) {
          .verdict-grid { grid-template-columns: 1fr !important; }
          .gauge-cell { border-left: none !important; border-top: 1px solid ${P.border} !important; }
          .finding-row { grid-template-columns: 1fr !important; }
          .meta-grid { grid-template-columns: 1fr !important; }
          .recent-grid { grid-template-columns: 1fr !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }
      `}</style>
    </>
  );
}
