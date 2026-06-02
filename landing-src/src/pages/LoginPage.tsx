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

          {/*
            Google OAuth button intentionally hidden for the public demo. It is NOT
            configured for gkin.app (GOOGLE_CLIENT_ID unset + GOOGLE_REDIRECT_URI
            defaults to localhost), so it dead-ends in a raw 503 / redirect_uri_mismatch.
            Email/password below works without it. To re-enable: set GOOGLE_CLIENT_ID,
            GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI=https://gkin.app/auth/google/callback,
            FRONTEND_URL=https://gkin.app on the server, register that redirect URI in the
            Google console, then restore the <a href={`${API}/auth/google`}> button.
          */}

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
