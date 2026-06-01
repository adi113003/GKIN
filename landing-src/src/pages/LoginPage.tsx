import { useState, useEffect } from "react";

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
        throw new Error(
          d.detail || (mode === "login" ? "Sign in failed" : "Registration failed"),
        );
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

  const inputCls =
    "w-full border border-ink bg-paper px-3 py-[10px] font-serif text-[15px] text-ink placeholder:text-ink-soft/70 focus:outline-none focus:border-navy";

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      {/* navy utility strip */}
      <nav className="flex items-center justify-between border-b-[1.5px] border-ink bg-navy px-4 py-[9px] sm:px-[26px]">
        <a
          href="/"
          className="font-mono text-[11px] uppercase tracking-[0.12em] text-paper no-underline hover:underline hover:underline-offset-[3px]"
        >
          ← GKIN
        </a>
        <a
          href="/app"
          className="font-mono text-[11px] uppercase tracking-[0.12em] text-paper no-underline hover:underline hover:underline-offset-[3px]"
        >
          Go to app →
        </a>
      </nav>

      <div className="flex flex-1 items-start justify-center px-4 py-12">
        <div className="w-full max-w-[400px] border-[1.5px] border-ink bg-paper">
          {/* nameplate header */}
          <div className="border-b-[1.5px] border-ink px-6 py-6 text-center">
            <div
              className="font-slab font-bold leading-none text-ink"
              style={{
                fontSize: "40px",
                letterSpacing: "0.16em",
                textIndent: "0.16em",
              }}
            >
              GKIN
            </div>
            <div className="mt-3 inline-block border-t border-rule-soft pt-[10px] font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
              {mode === "login" ? "Sign in" : "Create account"}
            </div>
          </div>

          <div className="px-6 py-6">
            {/* Google OAuth */}
            <a
              href={`${API}/auth/google`}
              className="mb-4 flex w-full cursor-pointer items-center justify-center gap-[10px] border border-ink bg-paper px-3 py-[10px] font-mono text-[12px] uppercase tracking-[0.08em] text-ink no-underline hover:bg-paper-2"
            >
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </a>

            <div className="mb-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-rule-soft" />
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
                or
              </span>
              <div className="h-px flex-1 bg-rule-soft" />
            </div>

            <form onSubmit={submit} className="flex flex-col gap-3">
              <input
                className={inputCls}
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />

              {mode === "register" && (
                <input
                  className={inputCls}
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              )}

              <input
                className={inputCls}
                type="password"
                placeholder={mode === "register" ? "Password (min 6 chars)" : "Password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
              />

              {error && (
                <div className="border-l-[3px] border-contradicted bg-paper-2 px-3 py-2 font-mono text-[12px] text-contradicted">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-1 w-full cursor-pointer border-[1.5px] border-ink bg-navy px-3 py-[11px] font-mono text-[12px] font-semibold uppercase tracking-[0.1em] text-paper hover:bg-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? "…" : mode === "login" ? "Sign in" : "Create account"}
              </button>
            </form>

            <p className="mt-5 text-center font-mono text-[12px] text-ink-soft">
              {mode === "login" ? "No account? " : "Already have one? "}
              <button
                type="button"
                className="cursor-pointer text-navy underline underline-offset-[3px]"
                onClick={() => switchMode(mode === "login" ? "register" : "login")}
              >
                {mode === "login" ? "Create account" : "Sign in"}
              </button>
            </p>
          </div>

          <p className="border-t border-rule-soft px-6 py-4 text-center font-mono text-[10px] uppercase tracking-[0.08em] text-ink-soft">
            By continuing you agree to GKIN's terms of service.
          </p>
        </div>
      </div>
    </div>
  );
}
