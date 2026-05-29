// popup.js — GKIN Truth Navigator Chrome Extension

const DEFAULT_SERVER = "https://gkin.app";
const CIRC = 163; // stroke-dasharray circumference

function getStorage(keys) { return new Promise(r => chrome.storage.local.get(keys, r)); }
function setStorage(obj)  { return new Promise(r => chrome.storage.local.set(obj, r)); }
const $ = id => document.getElementById(id);

let serverUrl = DEFAULT_SERVER;
let authToken  = "";
let currentPageData = null;
let lastAnalysis    = null;

// ── Init ──────────────────────────────────────────────────────────────────────
(async () => {
  const stored = await getStorage(["gkin_server","gkin_token","gkin_user","gkin_ext_theme", "gkin_pending_text"]);
  serverUrl  = stored.gkin_server || DEFAULT_SERVER;
  authToken  = stored.gkin_token  || "";

  // Clear badge text
  await chrome.action.setBadgeText({ text: "" });

  if (authToken) {
    try {
      const r = await fetch(serverUrl + "/me", { headers: {"Authorization":"Bearer "+authToken} });
      if (!r.ok) throw new Error();
      const d = await r.json();
      showAnalyzeSection(d.username);
      
      // Check for pending text from right-click context menu
      if (stored.gkin_pending_text) {
        currentPageData = { text: stored.gkin_pending_text, title: "Selected Text", url: "" };
        $("page-title-text").textContent = "Selected Text";
        $("chars-note").textContent = `${currentPageData.text.length.toLocaleString()} chars from selection`;
        $("analyze-btn").disabled = false;
        
        // Clear it from storage so it doesn't trigger again
        await setStorage({ gkin_pending_text: "" });
        
        // Auto-analyze
        $("analyze-btn").click();
      } else {
        loadCurrentPage();
      }
    } catch {
      await setStorage({gkin_token:"",gkin_user:""});
      authToken = "";
      showAuthSection();
    }
  } else {
    showAuthSection();
  }
})();

// ── UI helpers ────────────────────────────────────────────────────────────────
function showAuthSection()        { $("auth-section").style.display="block"; $("analyze-section").style.display="none"; }
function showAnalyzeSection(user) { $("auth-section").style.display="none"; $("analyze-section").style.display="block"; $("ext-username-display").textContent=user; }

// ── Server settings ───────────────────────────────────────────────────────────
$("settings-toggle").addEventListener("click", () => { $("server-url").value=serverUrl; $("settings-box").classList.toggle("show"); });
$("cancel-settings").addEventListener("click", () => $("settings-box").classList.remove("show"));
$("save-server").addEventListener("click", async () => {
  const v = $("server-url").value.trim().replace(/\/$/,"");
  if (!v) return;
  serverUrl = v;
  await setStorage({gkin_server:v});
  $("settings-box").classList.remove("show");
});

// ── Auth ──────────────────────────────────────────────────────────────────────
$("show-register").addEventListener("click", () => { $("login-form").style.display="none"; $("register-form").style.display="block"; $("auth-form-label").textContent="Create account"; });
$("show-login").addEventListener("click",    () => { $("register-form").style.display="none"; $("login-form").style.display="block"; $("auth-form-label").textContent="Sign in"; });

$("ext-login-btn").addEventListener("click", async () => {
  const username=$("ext-username").value.trim(), password=$("ext-password").value;
  if (!username||!password) { showErr("ext-login-error","Fill in all fields."); return; }
  $("ext-login-btn").disabled=true;
  try {
    const r=await fetch(serverUrl+"/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,password})});
    if (!r.ok) { const d=await r.json().catch(()=>({})); throw new Error(d.detail||"Login failed"); }
    const d=await r.json();
    authToken=d.token;
    await setStorage({gkin_token:d.token,gkin_user:d.username});
    showAnalyzeSection(d.username); loadCurrentPage();
  } catch(e) { showErr("ext-login-error",e.message); }
  finally { $("ext-login-btn").disabled=false; }
});

$("ext-register-btn").addEventListener("click", async () => {
  const username=$("ext-reg-username").value.trim(), email=$("ext-reg-email").value.trim(), password=$("ext-reg-password").value;
  if (!username||!email||!password) { showErr("ext-reg-error","Fill in all fields."); return; }
  $("ext-register-btn").disabled=true;
  try {
    const r=await fetch(serverUrl+"/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,email,password})});
    if (!r.ok) { const d=await r.json().catch(()=>({})); throw new Error(d.detail||"Registration failed"); }
    const d=await r.json();
    authToken=d.token;
    await setStorage({gkin_token:d.token,gkin_user:d.username});
    showAnalyzeSection(d.username); loadCurrentPage();
  } catch(e) { showErr("ext-reg-error",e.message); }
  finally { $("ext-register-btn").disabled=false; }
});

["ext-username","ext-password"].forEach(id => $(id)?.addEventListener("keydown", e => { if(e.key==="Enter") $("ext-login-btn").click(); }));
["ext-reg-username","ext-reg-email","ext-reg-password"].forEach(id => $(id)?.addEventListener("keydown", e => { if(e.key==="Enter") $("ext-register-btn").click(); }));

$("ext-logout").addEventListener("click", async () => {
  authToken="";
  await setStorage({gkin_token:"",gkin_user:""});
  $("result-card").classList.remove("show");
  showAuthSection();
});

// ── Load page info ────────────────────────────────────────────────────────────
async function loadCurrentPage() {
  try {
    const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
    if (!tab?.id) return;
    const results = await chrome.scripting.executeScript({
      target:{tabId:tab.id},
      func:() => {
        const selectors=["article",'[role="main"]',".article-body",".article-content",".post-content",".entry-content",".story-body","main"];
        for (const sel of selectors) {
          const el=document.querySelector(sel);
          if (el) { const t=el.innerText.trim(); if(t.length>300) return {text:t,title:document.title,url:location.href}; }
        }
        const paras=Array.from(document.querySelectorAll("p")).filter(p=>p.offsetParent!==null).map(p=>p.innerText.trim()).filter(t=>t.length>80);
        return {text:paras.join("\n\n"),title:document.title,url:location.href};
      }
    });
    currentPageData = results?.[0]?.result;
    if (currentPageData) {
      $("page-title-text").textContent = currentPageData.title||"Untitled page";
      const chars = currentPageData.text.length;
      $("chars-note").textContent = chars < 200 ? `⚠ Only ${chars} chars — may not be enough` : `${chars.toLocaleString()} chars extracted`;
      $("analyze-btn").disabled = chars < 200;
    }
  } catch {
    $("page-title-text").textContent = "Could not read page";
    $("chars-note").textContent = "Try on a page with article text";
    $("analyze-btn").disabled = true;
  }
}

// ── Analyze ───────────────────────────────────────────────────────────────────
$("analyze-btn").addEventListener("click", async () => {
  if (!currentPageData||currentPageData.text.length<200) return;
  $("analyze-btn").disabled=true;
  $("status").classList.add("show");
  $("result-card").classList.remove("show");
  try {
    const r=await fetch(serverUrl+"/analyze",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+authToken},body:JSON.stringify({article:currentPageData.text})});
    if (r.status===401) { authToken=""; await setStorage({gkin_token:"",gkin_user:""}); showAuthSection(); return; }
    if (!r.ok) throw new Error(await r.text());
    lastAnalysis = await r.json();
    renderResult(lastAnalysis);
  } catch(e) {
    $("chars-note").textContent = "Error: "+e.message;
  } finally {
    $("analyze-btn").disabled=false;
    $("status").classList.remove("show");
  }
});

// ── Render result ─────────────────────────────────────────────────────────────
function animateGauge(gaugeId, numId, value, color) {
  const fg = $(gaugeId);
  fg.style.stroke = color;
  fg.style.strokeDashoffset = CIRC - (CIRC * value / 100);
  const numEl = $(numId);
  numEl.style.color = color;
  let cur = 0; const step = Math.max(1, Math.ceil(value/20));
  const tick = setInterval(() => {
    cur += step; if (cur >= value) { cur = value; clearInterval(tick); }
    numEl.textContent = cur;
  }, 30);
}

function miColor(v) {
  if (v >= 60) return "#f43f5e"; // Rose
  if (v >= 40) return "#f59e0b"; // Amber
  if (v >= 20) return "#eab308"; // Yellow
  return "#10b981"; // Emerald
}
function trustColor(fc) {
  if (fc <= 20) return "#10b981"; // Emerald
  if (fc <= 40) return "#84cc16"; // Lime
  if (fc <= 60) return "#eab308"; // Yellow
  if (fc <= 80) return "#f97316"; // Orange
  return "#f43f5e"; // Rose
}
function aiColor(ac) {
  if (ac <= 20) return "#10b981"; // Emerald
  if (ac <= 40) return "#84cc16"; // Lime
  if (ac <= 60) return "#6366f1"; // Indigo
  if (ac <= 80) return "#8b5cf6"; // Violet
  return "#d946ef"; // Fuchsia
}

function renderResult(a) {
  // ── Manipulation ──
  const mi = a.manipulation_index || 0;
  const mc = miColor(mi);
  animateGauge("g-manip", "manip-num", mi, mc);
  let miLabel = "STRAIGHT REPORTING";
  if (mi>=80) miLabel="BLATANT PROPAGANDA";
  else if (mi>=60) miLabel="HEAVY MANIPULATION";
  else if (mi>=40) miLabel="NOTICEABLE PERSUASION";
  else if (mi>=20) miLabel="MILD FRAMING";
  $("manip-verdict").textContent = miLabel;
  $("manip-verdict").style.color = mc;
  setPill("manip-pill", miLabel, mc);

  // ── Authenticity (trust) ──
  const fd = a.fake_detection;
  if (fd) {
    const fc = fd.fake_confidence != null ? fd.fake_confidence : 50;
    const tr = 100 - fc;
    const tc = trustColor(fc);
    animateGauge("g-trust", "trust-num", tr, tc);
    const tv = fd.verdict || "UNCERTAIN";
    $("trust-verdict").textContent = tv;
    $("trust-verdict").style.color = tc;
    setPill("trust-pill", tv, tc);
  }

  // ── AI authorship ──
  const ad = a.ai_detection;
  if (ad) {
    const ac = ad.ai_confidence != null ? ad.ai_confidence : 50;
    const avc = aiColor(ac);
    animateGauge("g-ai", "ai-num", ac, avc);
    const av = ad.verdict || "UNCERTAIN";
    $("ai-verdict").textContent = av;
    $("ai-verdict").style.color = avc;
    setPill("ai-pill", av, avc);
  }

  // ── Cluster ──
  $("ext-cluster").textContent = "Narrative: " + (a.narrative_cluster||"none").replace(/_/g," ").toUpperCase();

  // ── Techniques (top 3) ──
  const techs = (a.persuasion_techniques||[]).slice(0,3);
  $("ext-techniques").innerHTML = techs.length
    ? techs.map(t=>`<div class="tech-item"><div class="tech-name">${t.technique.replace(/_/g," ")}</div><div class="tech-span">${esc(t.span,55)}</div></div>`).join("")
    : `<div style="color:#888899;font-size:12px;font-style:italic;">None detected.</div>`;

  // ── Conspiracy note ──
  $("ext-conspiracy-note").classList.toggle("show", mi >= 60);

  $("result-card").classList.add("show");
}

function setPill(id, label, color) {
  const el = $(id);
  el.textContent = label;
  el.style.background = color + "22";
  el.style.color = color;
  el.style.border = "1px solid " + color + "44";
}

// ── Open full app ─────────────────────────────────────────────────────────────
$("open-full-btn").addEventListener("click", () => chrome.tabs.create({url:serverUrl+"/"}));

// ── Helpers ───────────────────────────────────────────────────────────────────
function showErr(id, msg) {
  const el=$(id); el.textContent=msg; el.classList.add("show");
  setTimeout(()=>el.classList.remove("show"),5000);
}
function esc(str, max) {
  const s = String(str||"").slice(0,max) + (String(str||"").length>max?"…":"");
  return s.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":'&#39;'}[c]));
}
