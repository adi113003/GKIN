// popup.js — GKIN Truth Navigator Chrome Extension

const DEFAULT_SERVER = "http://localhost:8000";

// ── Storage helpers ───────────────────────────────────────────────────────────
function getStorage(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}
function setStorage(obj) {
  return new Promise(resolve => chrome.storage.local.set(obj, resolve));
}

// ── DOM refs ──────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ── State ─────────────────────────────────────────────────────────────────────
let serverUrl = DEFAULT_SERVER;
let authToken = "";
let currentPageData = null;
let lastAnalysis = null;

// ── Init ──────────────────────────────────────────────────────────────────────
(async () => {
  const stored = await getStorage(["gkin_server", "gkin_token", "gkin_user"]);
  serverUrl = stored.gkin_server || DEFAULT_SERVER;
  authToken = stored.gkin_token || "";
  $("server-url").value = serverUrl;

  if (authToken) {
    // Verify token is still valid
    try {
      const r = await fetch(serverUrl + "/me", {
        headers: { "Authorization": "Bearer " + authToken }
      });
      if (!r.ok) throw new Error();
      const data = await r.json();
      showAnalyzeSection(data.username);
      loadCurrentPage();
    } catch {
      await setStorage({ gkin_token: "", gkin_user: "" });
      authToken = "";
      showAuthSection();
    }
  } else {
    showAuthSection();
  }
})();

// ── UI show/hide ──────────────────────────────────────────────────────────────
function showAuthSection() {
  $("auth-section").style.display = "block";
  $("analyze-section").style.display = "none";
}

function showAnalyzeSection(username) {
  $("auth-section").style.display = "none";
  $("analyze-section").style.display = "block";
  $("ext-username-display").textContent = username;
}

// ── Server settings ───────────────────────────────────────────────────────────
$("settings-toggle").addEventListener("click", () => {
  const box = $("settings-box");
  $("server-url").value = serverUrl;
  box.classList.toggle("show");
});

$("cancel-settings").addEventListener("click", () => {
  $("settings-box").classList.remove("show");
});

$("save-server").addEventListener("click", async () => {
  const val = $("server-url").value.trim().replace(/\/$/, "");
  if (!val) return;
  serverUrl = val;
  await setStorage({ gkin_server: val });
  $("settings-box").classList.remove("show");
});

// ── Auth tab switches ─────────────────────────────────────────────────────────
$("show-register").addEventListener("click", () => {
  $("login-form").style.display = "none";
  $("register-form").style.display = "block";
  $("auth-form-label").textContent = "Create account";
});

$("show-login").addEventListener("click", () => {
  $("register-form").style.display = "none";
  $("login-form").style.display = "block";
  $("auth-form-label").textContent = "Sign in";
});

// ── Login ─────────────────────────────────────────────────────────────────────
$("ext-login-btn").addEventListener("click", async () => {
  const username = $("ext-username").value.trim();
  const password = $("ext-password").value;
  if (!username || !password) { showExtError("ext-login-error", "Fill in all fields."); return; }

  $("ext-login-btn").disabled = true;
  try {
    const r = await fetch(serverUrl + "/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(d.detail || "Login failed");
    }
    const data = await r.json();
    authToken = data.token;
    await setStorage({ gkin_token: data.token, gkin_user: data.username });
    showAnalyzeSection(data.username);
    loadCurrentPage();
  } catch (e) {
    showExtError("ext-login-error", e.message);
  } finally {
    $("ext-login-btn").disabled = false;
  }
});

// ── Register ──────────────────────────────────────────────────────────────────
$("ext-register-btn").addEventListener("click", async () => {
  const username = $("ext-reg-username").value.trim();
  const email    = $("ext-reg-email").value.trim();
  const password = $("ext-reg-password").value;
  if (!username || !email || !password) { showExtError("ext-reg-error", "Fill in all fields."); return; }

  $("ext-register-btn").disabled = true;
  try {
    const r = await fetch(serverUrl + "/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password })
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(d.detail || "Registration failed");
    }
    const data = await r.json();
    authToken = data.token;
    await setStorage({ gkin_token: data.token, gkin_user: data.username });
    showAnalyzeSection(data.username);
    loadCurrentPage();
  } catch (e) {
    showExtError("ext-reg-error", e.message);
  } finally {
    $("ext-register-btn").disabled = false;
  }
});

// Allow Enter key in auth inputs
["ext-username", "ext-password"].forEach(id =>
  $(id)?.addEventListener("keydown", e => { if (e.key === "Enter") $("ext-login-btn").click(); })
);
["ext-reg-username", "ext-reg-email", "ext-reg-password"].forEach(id =>
  $(id)?.addEventListener("keydown", e => { if (e.key === "Enter") $("ext-register-btn").click(); })
);

// ── Logout ────────────────────────────────────────────────────────────────────
$("ext-logout").addEventListener("click", async () => {
  authToken = "";
  await setStorage({ gkin_token: "", gkin_user: "" });
  $("result-box").classList.remove("show");
  showAuthSection();
});

// ── Load current page info ────────────────────────────────────────────────────
async function loadCurrentPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    // Inject content script if needed and get text
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // Inline extraction in case content script isn't ready
        const selectors = ["article", '[role="main"]', ".article-body", ".article-content",
          ".post-content", ".entry-content", ".story-body", "main"];
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) {
            const text = el.innerText.trim();
            if (text.length > 300) return { text, title: document.title, url: location.href };
          }
        }
        const paragraphs = Array.from(document.querySelectorAll("p"))
          .filter(p => p.offsetParent !== null)
          .map(p => p.innerText.trim())
          .filter(t => t.length > 80);
        return { text: paragraphs.join("\n\n"), title: document.title, url: location.href };
      }
    });

    currentPageData = results?.[0]?.result;
    if (currentPageData) {
      $("page-title-text").textContent = currentPageData.title || "Untitled page";
      const chars = currentPageData.text.length;
      $("chars-note").textContent = chars < 200
        ? `⚠ Only ${chars} chars extracted — may not have enough text`
        : `${chars.toLocaleString()} chars extracted`;
      $("analyze-btn").disabled = chars < 200;
    }
  } catch (e) {
    $("page-title-text").textContent = "Could not read page";
    $("chars-note").textContent = "Try on a page with article text";
    $("analyze-btn").disabled = true;
  }
}

// ── Analyze ───────────────────────────────────────────────────────────────────
$("analyze-btn").addEventListener("click", async () => {
  if (!currentPageData || currentPageData.text.length < 200) return;

  $("analyze-btn").disabled = true;
  $("status").classList.add("show");
  $("result-box").classList.remove("show");

  try {
    const r = await fetch(serverUrl + "/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + authToken
      },
      body: JSON.stringify({ article: currentPageData.text })
    });

    if (r.status === 401) {
      authToken = "";
      await setStorage({ gkin_token: "", gkin_user: "" });
      showAuthSection();
      return;
    }
    if (!r.ok) throw new Error(await r.text());

    lastAnalysis = await r.json();
    renderResult(lastAnalysis);
  } catch (e) {
    $("chars-note").textContent = "Error: " + e.message;
  } finally {
    $("analyze-btn").disabled = false;
    $("status").classList.remove("show");
  }
});

// ── Render result ─────────────────────────────────────────────────────────────
function renderResult(a) {
  const mi = a.manipulation_index || 0;
  const CIRC = 163;
  const fg = $("ext-gauge-fg");
  fg.style.strokeDashoffset = CIRC - (CIRC * mi / 100);

  let color = "#7cb342";
  if (mi >= 60) color = "#e85c4a";
  else if (mi >= 40) color = "#e8c547";
  else if (mi >= 20) color = "#f5e6a3";
  fg.style.stroke = color;

  let cur = 0;
  const step = Math.max(1, Math.ceil(mi / 20));
  const tick = setInterval(() => {
    cur += step; if (cur >= mi) { cur = mi; clearInterval(tick); }
    $("ext-gauge-num").textContent = cur;
  }, 30);
  $("ext-gauge-num").style.color = color;

  let label = "STRAIGHT REPORTING";
  if (mi >= 80) label = "BLATANT PROPAGANDA";
  else if (mi >= 60) label = "HEAVY MANIPULATION";
  else if (mi >= 40) label = "NOTICEABLE PERSUASION";
  else if (mi >= 20) label = "MILD FRAMING";

  const tag = $("ext-verdict-tag");
  tag.textContent = label;
  tag.style.background = color + "22";
  tag.style.color = color;
  $("ext-verdict-title").style.color = color;

  const cluster = a.narrative_cluster || "none";
  $("ext-cluster").textContent = "Narrative: " + cluster.replace(/_/g, " ").toUpperCase();

  const techs = (a.persuasion_techniques || []).slice(0, 3);
  $("ext-techniques").innerHTML = techs.length
    ? techs.map(t => `
        <div class="tech-item">
          <div class="tech-name">${t.technique.replace(/_/g," ")}</div>
          <div class="tech-span">${escapeShort(t.span, 60)}</div>
        </div>`).join("")
    : "";

  $("ext-conspiracy-note").classList.toggle("show", mi >= 60);
  $("result-box").classList.add("show");
}

// ── Open full analysis in app ─────────────────────────────────────────────────
$("open-full-btn").addEventListener("click", () => {
  chrome.tabs.create({ url: serverUrl + "/" });
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function showExtError(id, msg) {
  const el = $(id); el.textContent = msg; el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 5000);
}

function escapeShort(str, maxLen) {
  const s = String(str || "").slice(0, maxLen) + (str.length > maxLen ? "…" : "");
  return s.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":'&#39;'}[c]));
}
