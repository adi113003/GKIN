import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search } from "lucide-react";

type Mode = "login" | "register";

const API = import.meta.env.VITE_API_URL || window.location.origin;

export function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const user = params.get("username");
    if (token && user) {
      localStorage.setItem("gkin_token", token);
      localStorage.setItem("gkin_user", user);
      window.location.href = API + "/app";
      return;
    }
  }, []);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/login" : "/register";
      const body =
        mode === "login"
          ? { username, password }
          : { username, email, password };
      const r = await fetch(API + endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.detail || (mode === "login" ? "Login failed" : "Registration failed"));
      }
      const d = await r.json();
      localStorage.setItem("gkin_token", d.token);
      localStorage.setItem("gkin_user", d.username);
      window.location.href = API + "/app";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#050505] text-ink flex flex-col">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 py-3.5 bg-black/80 border-b border-white/[0.07] backdrop-blur-md">
        <div className="max-w-[1240px] mx-auto px-7 flex items-center justify-between">
          <a
            href="/"
            className="flex items-center gap-2.5 text-white font-semibold text-[15px] tracking-tight"
          >
            <span className="w-6 h-6 rounded-md bg-gradient-to-br from-white to-[#a8a8b0] flex items-center justify-center">
              <Search className="w-3.5 h-3.5 text-black" strokeWidth={2.6} />
            </span>
            GKIN
          </a>
          <a
            href="/app"
            className="text-ink-3 text-[13px] hover:text-white transition-colors"
          >
            Go to app →
          </a>
        </div>
      </nav>

      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full bg-brand-violet/[0.08] blur-[140px]" />
        <div className="absolute left-[30%] top-[60%] w-[400px] h-[300px] rounded-full bg-brand-cyan/[0.05] blur-[120px]" />
      </div>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center px-4 pt-16">
        <motion.div
          className="w-full max-w-[360px]"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.2, 0.7, 0.3, 1] }}
        >
          {/* Logo lockup */}
          <div className="flex flex-col items-center mb-7">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-white to-[#a8a8b0] flex items-center justify-center mb-3 shadow-lg">
              <Search className="w-5 h-5 text-black" strokeWidth={2.6} />
            </div>
            <h1 className="text-[22px] font-bold tracking-tight text-white">
              {mode === "login" ? "Welcome back" : "Create account"}
            </h1>
            <p className="text-ink-3 text-sm mt-1">
              {mode === "login"
                ? "Sign in to your GKIN account"
                : "Start analyzing with GKIN"}
            </p>
          </div>

          {/* Form card */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] backdrop-blur-sm p-7">
            {/* Google OAuth */}
            <a
              href={`${API}/auth/google`}
              className="flex items-center justify-center gap-2.5 w-full py-2.5 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.10] rounded-lg text-sm text-white font-medium transition-colors mb-4"
            >
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </a>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-white/[0.08]" />
              <span className="text-ink-4 text-[11px] uppercase tracking-widest">or</span>
              <div className="flex-1 h-px bg-white/[0.08]" />
            </div>

            <form onSubmit={submit} className="flex flex-col gap-2.5">
              <input
                className="w-full bg-white/[0.05] border border-white/[0.10] rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-ink-4 focus:outline-none focus:border-white/25 transition-colors"
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />

              <AnimatePresence>
                {mode === "register" && (
                  <motion.div
                    key="email-field"
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <input
                      className="w-full bg-white/[0.05] border border-white/[0.10] rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-ink-4 focus:outline-none focus:border-white/25 transition-colors"
                      type="email"
                      placeholder="Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      required
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <input
                className="w-full bg-white/[0.05] border border-white/[0.10] rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-ink-4 focus:outline-none focus:border-white/25 transition-colors"
                type="password"
                placeholder={mode === "register" ? "Password (min 6 chars)" : "Password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
              />

              <AnimatePresence>
                {error && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-brand-red text-xs bg-brand-red/10 border border-brand-red/20 rounded-lg px-3 py-2 overflow-hidden"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-white text-black text-sm font-semibold rounded-lg hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all mt-1"
              >
                {loading ? "…" : mode === "login" ? "Sign In" : "Create Account"}
              </button>
            </form>

            <p className="text-center text-ink-3 text-[12.5px] mt-5">
              {mode === "login" ? "No account? " : "Already have one? "}
              <button
                type="button"
                className="text-brand-cyan hover:underline"
                onClick={() => switchMode(mode === "login" ? "register" : "login")}
              >
                {mode === "login" ? "Create one" : "Sign in"}
              </button>
            </p>
          </div>

          <p className="text-center text-ink-4 text-[11px] mt-5">
            By continuing you agree to GKIN's terms of service.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
