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
    "w-full rounded-lg border border-hairline bg-white px-4 py-3 text-[15px] text-ink placeholder:text-muted focus:outline-none focus:border-ink";

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      {/* minimal top bar */}
      <nav className="flex items-center justify-between border-b border-hairline bg-white px-5 py-4 sm:px-8">
        <a
          href="/"
          className="text-[15px] text-ink-soft no-underline transition-colors hover:text-ink"
        >
          ← GKIN
        </a>
        <a
          href="/app"
          className="text-[15px] text-ink-soft no-underline transition-colors hover:text-ink"
        >
          Go to app →
        </a>
      </nav>

      <div className="flex flex-1 items-start justify-center px-4 py-16">
        <div className="w-full max-w-[400px] rounded-card border border-hairline-soft bg-white p-8 shadow-card">
          {/* wordmark header */}
          <div className="mb-7 text-center">
            <div className="text-[28px] font-extrabold leading-none tracking-tight text-ink">
              GKIN<span className="text-rausch">.</span>
            </div>
            <div className="mt-2 text-[15px] text-ink-soft">
              {mode === "login" ? "Sign in" : "Create account"}
            </div>
          </div>

          {/* Google OAuth (configured for gkin.app — /auth/google redirects to Google) */}
          <a
            href={`${API}/auth/google`}
            className="mb-5 flex w-full cursor-pointer items-center justify-center gap-3 rounded-lg border border-hairline bg-white px-4 py-3 text-[15px] font-medium text-ink no-underline transition-colors hover:bg-surface-soft"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </a>

          <div className="mb-5 flex items-center gap-4">
            <div className="h-px flex-1 bg-hairline" />
            <span className="text-[13px] text-muted">or</span>
            <div className="h-px flex-1 bg-hairline" />
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
              <div className="rounded-lg border-l-[3px] border-contradicted bg-[#fbeaec] px-4 py-3 text-[14px] text-contradicted">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full cursor-pointer rounded-lg bg-rausch py-3 text-[15px] font-semibold text-white transition-colors hover:bg-rausch-active disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "…" : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-[14px] text-ink-soft">
            {mode === "login" ? "No account? " : "Already have one? "}
            <button
              type="button"
              className="cursor-pointer font-medium text-rausch hover:underline"
              onClick={() => switchMode(mode === "login" ? "register" : "login")}
            >
              {mode === "login" ? "Create account" : "Sign in"}
            </button>
          </p>

          <p className="mt-6 text-center text-[13px] text-muted">
            By continuing you agree to GKIN's terms of service.
          </p>
        </div>
      </div>
    </div>
  );
}
