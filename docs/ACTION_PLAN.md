# GKIN — Hardening & Production-Readiness Action Plan

> Source: full production-readiness audit (8-reviewer pass + adversarial verification).
> Production-readiness scored **6/10** (≈8/10 as a graded course deliverable). Issues are
> demo-resilience / ops hardening, not functional breakage. The app works.

**Branch:** `redesign-dossier` · **Live deploy fires only on push to `main`** (DigitalOcean + pm2).
Nothing below reaches production until someone merges to `main`, so all "branch-safe" work is
risk-free to the live site.

---

## ✅ Step 0 — DONE (built, uncommitted on `redesign-dossier`)
- **SSRF guard** on all server-side URL fetches (`/fetch-url` + both scrapers) — blocks
  loopback / private / link-local / `169.254.169.254` cloud-metadata.
- **Friendly error messages** (frontend `friendlyError()` + backend `_llm_http_error()`),
  Groq quota / rate-limit mapped to a clean **429**; no more raw exception text on screen.
- **Truthful benchmark copy** on the landing page (`7.8` → `8.0`, honest "no cited source"
  phrasing) + honest startup log (dropped the misleading "97% accuracy").
- Both frontends rebuilt; `tsc` + Python compile/import verified.

**Files:** `server.py`, `landing/src/Analyzer.tsx`,
`landing-src/src/components/sections/Benchmarks.tsx`, rebuilt `static/` bundles.
**First action when ready:** commit these (exclude the pre-existing `benchmark/*` changes).

---

## 🔒 Needs a teammate or droplet access (the short list)

| # | Why it needs them | Action / owner |
|---|---|---|
| 1 | **Stable `SECRET_KEY`** on the droplet | Teammate sets it in the pm2 env **first**; then the fail-fast guard goes in `server.py:106`. Order matters or boot breaks. |
| 2 | **`git reset --hard` in deploy** wipes droplet hand-edits | Teammate confirms the droplet is a clean mirror of `main`. |
| 3 | **`deploy.yml` changes** affect everyone's pushes | I write, teammate reviews — joint sign-off. |
| 4 | Editing `Analyzer.tsx` / `deploy.yml` | Confirm nobody else is mid-edit (merge-conflict avoidance). |
| 5 | **Rate-limit thresholds** | Agree numbers (e.g. 10/min on `/analyze`) so you don't throttle your own demo. |
| 6 | **Merge `redesign-dossier` → `main`** triggers the live deploy | Joint decision — do it on a non-demo day. |
| 7 | `GROQ_API_KEY` + `MONGODB_URI` set on droplet | Teammate verifies on the box. |

---

## 🟠 Step 1 — Phase-0 criticals (before the demo)
1. **Rate limiter** — zero-dependency in-memory limiter keyed on JWT `sub` + IP (no new pip
   package). *Branch-safe; agree thresholds (#5).*
2. **`SECRET_KEY` fail-fast** in prod. ⚠️ needs #1 env set first.
3. **Deploy healthcheck** — `curl -fsS /health` after `pm2 restart`; fail loud on a boot crash. ⚠️ #2/#3.
4. **Build-staleness CI check** — fail CI if a source change didn't rebuild its bundle
   (the silent-stale-UI footgun). ⚠️ coordinate so it doesn't block in-progress pushes.

## 🟡 Step 2 — Phase-1 important (branch-safe — no coordination)
5. **Structured `logging`** — replace `print` / `except: pass` with real logs.
6. **Grounding negation fix** — `gkin/agentic/nodes.py` 80%-overlap gate accepts inverted
   citations; tighten + add a regression test.
7. **`requirements.lock`** — `pip freeze` on the working box; pin `groq` / `ddgs` / `fastapi` / `pydantic`.
8. **Run `gkin/agentic` tests in CI** before deploy.
9. **`aria-live` + focus-to-result** on completion (accessibility).
10. **`AbortController`** per scan/chat + wire the dead Stop button.
11. **`sha256_crypt` → `bcrypt`** (`deprecated="auto"` auto-upgrades on next login).
12. **OAuth `state` param** + stop putting the JWT in the URL.

## 🟢 Step 3 — Phase-2 polish (post-demo, branch-safe)
13. Decompose the 1622-line `Analyzer.tsx`.
14. Unify the two React apps (one Vite project, two entry points).
15. Repo cleanup — `git rm` `__MACOSX/`, `CLAUDE (1).md`, `gkin-extension.zip`, dedupe
    ` (1)` scripts; move the 91 MB dataset out of git history.
16. Add `ruff` + `eslint` / `prettier`.
17. A few FastAPI `TestClient` tests for `/register`, `/login`, `/me`, `/analyze`.

---

## 🚀 Safe deploy sequence (when you decide to go live)
1. Pick a **non-demo day**.
2. Teammate confirms `SECRET_KEY` / `GROQ_API_KEY` / `MONGODB_URI` on droplet (#1, #7) and a clean mirror (#2).
3. Merge `redesign-dossier` → `main` → deploy fires (`git pull` + restart + new `/health` gate).
4. Watch the Action go green **and** the healthcheck pass; click through `/` and `/app` once.
5. **Rollback:** previous good commit is one `git revert` + redeploy away — keep its hash handy.

---

## Decisions already locked
- **Keep the stack** (FastAPI + Groq + MongoDB + React/Vite). Only real over-complexity is the
  two divergent React apps — unify post-demo (#14), not before.
- **No Docker** at this scale.
- **Keep the ML classifier as advisory-only** (already excluded from the verdict). It is a
  teaching artifact (the WELFake leakage / OOD case study), not the product. The grounded
  LLM + retrieval loop is the defensible core.
