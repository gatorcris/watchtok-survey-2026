// WatchTok Survey RESULTS — registration, sign-in, tiered content.
// Security lives in Supabase (row-level security + private storage). This file only
// asks for content; the database decides what each account may receive.

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, SUPPORT_EMAIL } from "../src/config.js";

// Kept separate from the survey's anonymous session so the two never mix.
const AUTH_KEY = "watchtok-results-auth-v1";
const BUCKET = "results-content";
const MEMBER_TYPES = [
  ["brand", "Watch brand (marketing / sales)"],
  ["creator", "WatchTok creator"],
  ["team", "Founding WatchTok team"],
  ["other", "Other"]
];

const app = document.getElementById("results-app");
const bar = document.getElementById("account-bar");
// Where confirmation and password-reset emails send people back to (this page, no hash or query).
const RETURN_URL = `${location.origin}${location.pathname}`;

// ------------------------------------------------------------------ helpers

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function friendlyError(error) {
  const msg = error?.message || "Something went wrong.";
  if (/invalid login credentials/i.test(msg)) return "That email and password don't match an account.";
  if (/already registered|already been registered/i.test(msg)) return "An account with that email already exists. Try signing in.";
  if (/password should be at least/i.test(msg)) return "Please use a password of at least 8 characters.";
  if (/email not confirmed/i.test(msg)) return "Please confirm your email first, then sign in.";
  if (/rate limit/i.test(msg)) return "Too many attempts. Please wait a few minutes and try again.";
  if (/failed to fetch|network/i.test(msg)) return "Can't reach the server. Check your connection and try again.";
  return msg;
}

async function api(path, { method = "GET", body, token, headers = {} } = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const error = new Error(data?.msg || data?.message || data?.error_description || data?.error || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data;
}

// ------------------------------------------------------------------ session

function loadSession() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY)); } catch { return null; }
}
function saveSession(session) {
  try { localStorage.setItem(AUTH_KEY, JSON.stringify(session)); } catch { /* private mode: session lasts this tab only */ }
  current.session = session;
}
function clearSession() {
  try { localStorage.removeItem(AUTH_KEY); } catch { /* ignore */ }
  current.session = null;
}

const current = { session: null, member: null };

async function validSession() {
  let session = current.session || loadSession();
  if (!session?.access_token) return null;
  const fresh = Number(session.expires_at || 0) > Math.floor(Date.now() / 1000) + 60;
  if (fresh) { current.session = session; return session; }
  try {
    session = await api("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: session.refresh_token } });
    saveSession(session);
    return session;
  } catch {
    clearSession();
    return null;
  }
}

async function token() {
  const session = await validSession();
  if (!session) throw new Error("Your session has ended. Please sign in again.");
  return session.access_token;
}

async function loadMember() {
  const rows = await api(`/rest/v1/results_members?select=email,full_name,organization,member_type,tier&user_id=eq.${current.session.user.id}`, { token: await token() });
  current.member = rows?.[0] || null;
  return current.member;
}

function logEvent(event, detail = null) {
  token()
    .then((t) => api("/rest/v1/results_events", { method: "POST", token: t, headers: { Prefer: "return=minimal" }, body: { user_id: current.session.user.id, event, detail } }))
    .catch(() => { /* usage logging must never block reading */ });
}

// ------------------------------------------------------------------ views

function brandBlock() {
  return `<div class="gate-brand"><img src="../assets/watchtok-research-mark.svg" alt="" /> WATCHTOK SURVEY · RESULTS</div>`;
}

function memberTypeOptions(selected = "") {
  return `<option value="" disabled ${selected ? "" : "selected"}>Choose one</option>` +
    MEMBER_TYPES.map(([v, l]) => `<option value="${v}" ${v === selected ? "selected" : ""}>${esc(l)}</option>`).join("");
}

function setBusy(form, busy) {
  form.querySelectorAll("button, input, select").forEach((el) => { el.disabled = busy; });
}

function showMsg(form, text, kind = "error") {
  let el = form.querySelector(".gate-msg");
  if (!el) {
    el = document.createElement("p");
    el.setAttribute("role", "status");
    form.prepend(el);
  }
  el.className = `gate-msg ${kind}`;
  el.textContent = text;
}

function renderGate(mode = "register", notice = "", kind = "ok") {
  bar.hidden = true;
  if (mode === "forgot") return renderForgot(notice, kind);
  const isRegister = mode === "register";
  app.innerHTML = `
    <div class="gate-shell">
      <section class="gate-card" aria-labelledby="gate-title">
        ${brandBlock()}
        <h1 id="gate-title">The 2026 WatchTok Enthusiast Survey results</h1>
        <p class="gate-sub">Five buyer personas, market sizing, and what they mean for your brand. Free registration unlocks the preview; collaborators with a passcode get the full report.</p>
        <div class="gate-tabs" role="tablist">
          <button type="button" role="tab" data-mode="register" aria-selected="${isRegister}">Create account</button>
          <button type="button" role="tab" data-mode="signin" aria-selected="${!isRegister}">Sign in</button>
        </div>
        ${isRegister ? `
        <form class="gate-form" id="register-form" novalidate>
          <label>Full name<input name="full_name" autocomplete="name" required maxlength="120" /></label>
          <label>Email<input name="email" type="email" autocomplete="email" required /></label>
          <label>Password <span class="hint">At least 8 characters</span><input name="password" type="password" autocomplete="new-password" minlength="8" required /></label>
          <label>Brand or organization <span class="hint">Optional</span><input name="organization" autocomplete="organization" maxlength="160" /></label>
          <label>I am a…<select name="member_type" required>${memberTypeOptions()}</select></label>
          <label>Collaborator passcode <span class="hint">Only if you were given one</span><input name="passcode" autocomplete="off" autocapitalize="characters" spellcheck="false" /></label>
          <button class="gate-btn" type="submit">Create account</button>
        </form>` : `
        <form class="gate-form" id="signin-form" novalidate>
          <label>Email<input name="email" type="email" autocomplete="email" required /></label>
          <label>Password<input name="password" type="password" autocomplete="current-password" required /></label>
          <button class="gate-btn" type="submit">Sign in</button>
        </form>
        <p class="gate-fine"><a href="#" id="forgot-link">Forgot your password?</a></p>`}
        <p class="gate-fine">We use your details only to manage access to these results. Survey responses are shown only as anonymous totals. <a href="../privacy.html">Privacy Statement</a></p>
      </section>
    </div>`;

  app.querySelectorAll("[data-mode]").forEach((btn) => btn.addEventListener("click", () => renderGate(btn.dataset.mode)));
  app.querySelector("#forgot-link")?.addEventListener("click", (e) => { e.preventDefault(); renderGate("forgot"); });
  const form = app.querySelector("form");
  if (notice) showMsg(form, notice, kind);
  form.addEventListener("submit", isRegister ? onRegister : onSignIn);
  form.querySelector("input")?.focus();
}

function renderForgot(notice = "", kind = "ok") {
  app.innerHTML = `
    <div class="gate-shell">
      <section class="gate-card" aria-labelledby="gate-title">
        ${brandBlock()}
        <h1 id="gate-title">Reset your password</h1>
        <p class="gate-sub">Enter the email you registered with and we'll send you a link to choose a new password.</p>
        <form class="gate-form" id="forgot-form" novalidate>
          <label>Email<input name="email" type="email" autocomplete="email" required /></label>
          <button class="gate-btn" type="submit">Send reset link</button>
          <button class="gate-btn secondary" type="button" id="back-signin">Back to sign in</button>
        </form>
        <p class="gate-fine">No email after a few minutes? Check your spam folder, or write to <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>
      </section>
    </div>`;
  const form = app.querySelector("form");
  if (notice) showMsg(form, notice, kind);
  form.addEventListener("submit", onForgot);
  app.querySelector("#back-signin").addEventListener("click", () => renderGate("signin"));
  form.querySelector("input")?.focus();
}

function renderNewPassword(notice = "") {
  bar.hidden = true;
  app.innerHTML = `
    <div class="gate-shell">
      <section class="gate-card" aria-labelledby="gate-title">
        ${brandBlock()}
        <h1 id="gate-title">Choose a new password</h1>
        <form class="gate-form" id="newpw-form" novalidate>
          <label>New password <span class="hint">At least 8 characters</span><input name="password" type="password" autocomplete="new-password" minlength="8" required /></label>
          <label>Type it again<input name="password2" type="password" autocomplete="new-password" minlength="8" required /></label>
          <button class="gate-btn" type="submit">Save password</button>
        </form>
      </section>
    </div>`;
  const form = app.querySelector("form");
  if (notice) showMsg(form, notice, "error");
  form.addEventListener("submit", onNewPassword);
  form.querySelector("input")?.focus();
}

function renderProfileForm(notice = "") {
  // After an email confirmation, prefill what the person already typed when they signed up.
  const meta = current.session?.user?.user_metadata || {};
  bar.hidden = true;
  app.innerHTML = `
    <div class="gate-shell">
      <section class="gate-card">
        ${brandBlock()}
        <h1>Finish your registration</h1>
        <p class="gate-sub">A few details before we open the results.</p>
        <form class="gate-form" id="profile-form" novalidate>
          <label>Full name<input name="full_name" autocomplete="name" required maxlength="120" value="${esc(meta.full_name)}" /></label>
          <label>Brand or organization <span class="hint">Optional</span><input name="organization" maxlength="160" value="${esc(meta.organization)}" /></label>
          <label>I am a…<select name="member_type" required>${memberTypeOptions(meta.member_type || "")}</select></label>
          <label>Collaborator passcode <span class="hint">Only if you were given one</span><input name="passcode" autocomplete="off" spellcheck="false" /></label>
          <button class="gate-btn" type="submit">Continue</button>
          <button class="gate-btn secondary" type="button" id="profile-signout">Sign out</button>
        </form>
      </section>
    </div>`;
  const form = app.querySelector("form");
  if (notice) showMsg(form, notice, "error");
  form.addEventListener("submit", onProfile);
  app.querySelector("#profile-signout").addEventListener("click", signOut);
}

function renderAccountBar() {
  const m = current.member;
  const label = m.tier === "sample" ? "Preview access" : m.tier === "admin" ? "Admin" : "Full access";
  bar.innerHTML = `<span>${esc(m.full_name)} · ${esc(m.email)}</span><span class="tier-pill">${label}</span><button type="button" id="signout-btn">Sign out</button>`;
  bar.hidden = false;
  bar.querySelector("#signout-btn").addEventListener("click", signOut);
}

// ------------------------------------------------------------------ actions

function readForm(form) {
  return Object.fromEntries([...new FormData(form).entries()].map(([k, v]) => [k, String(v).trim()]));
}

async function register(profile) {
  return api("/rest/v1/rpc/results_register", {
    method: "POST",
    token: await token(),
    body: {
      p_full_name: profile.full_name,
      p_organization: profile.organization || null,
      p_member_type: profile.member_type,
      p_passcode: profile.passcode || null
    }
  });
}

function missingProfileField(v) {
  if (!v.full_name) return "Please enter your name.";
  if (!v.member_type) return "Please choose what best describes you.";
  return "";
}

async function onRegister(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const v = readForm(form);
  const problem = missingProfileField(v) || (!/^\S+@\S+\.\S+$/.test(v.email) ? "Please enter a valid email." : "") || (v.password.length < 8 ? "Please use a password of at least 8 characters." : "");
  if (problem) return showMsg(form, problem);

  setBusy(form, true);
  try {
    const result = await api(`/auth/v1/signup?redirect_to=${encodeURIComponent(RETURN_URL)}`, {
      method: "POST",
      body: { email: v.email, password: v.password, data: { full_name: v.full_name, organization: v.organization, member_type: v.member_type } }
    });
    if (!result?.access_token) {
      setBusy(form, false);
      const pc = v.passcode ? " If you have a collaborator passcode, you'll enter it after confirming." : "";
      renderGate("signin", `Almost there. We sent a confirmation link to ${v.email}. Click it to open the results (check spam if you don't see it).${pc}`);
      return;
    }
    saveSession(result);
    const reg = await register(v);
    await enter(reg?.passcode && !reg.passcode.ok ? `${reg.passcode.message} You can try another passcode below.` : "");
  } catch (error) {
    setBusy(form, false);
    showMsg(form, friendlyError(error));
  }
}

async function onSignIn(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const v = readForm(form);
  if (!v.email || !v.password) return showMsg(form, "Enter your email and password.");
  setBusy(form, true);
  try {
    const session = await api("/auth/v1/token?grant_type=password", { method: "POST", body: { email: v.email, password: v.password } });
    saveSession(session);
    await enter();
    logEvent("login");
  } catch (error) {
    setBusy(form, false);
    showMsg(form, friendlyError(error));
  }
}

async function onForgot(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const v = readForm(form);
  if (!/^\S+@\S+\.\S+$/.test(v.email)) return showMsg(form, "Please enter a valid email.");
  setBusy(form, true);
  try {
    await api(`/auth/v1/recover?redirect_to=${encodeURIComponent(RETURN_URL)}`, { method: "POST", body: { email: v.email } });
    renderForgot(`If ${v.email} has an account, a reset link is on its way. It works once and expires after a while.`);
  } catch (error) {
    setBusy(form, false);
    showMsg(form, friendlyError(error));
  }
}

async function onNewPassword(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const v = readForm(form);
  if (v.password.length < 8) return showMsg(form, "Please use a password of at least 8 characters.");
  if (v.password !== v.password2) return showMsg(form, "The two passwords don't match.");
  setBusy(form, true);
  try {
    await api("/auth/v1/user", { method: "PUT", token: await token(), body: { password: v.password } });
    await enter();
  } catch (error) {
    setBusy(form, false);
    showMsg(form, friendlyError(error));
  }
}

async function onProfile(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const v = readForm(form);
  const problem = missingProfileField(v);
  if (problem) return showMsg(form, problem);
  setBusy(form, true);
  try {
    const reg = await register(v);
    await enter(reg?.passcode && !reg.passcode.ok ? reg.passcode.message : "");
  } catch (error) {
    setBusy(form, false);
    showMsg(form, friendlyError(error));
  }
}

async function onRedeem(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const v = readForm(form);
  if (!v.passcode) return showMsg(form, "Enter your passcode.");
  setBusy(form, true);
  try {
    const result = await api("/rest/v1/rpc/results_redeem_passcode", { method: "POST", token: await token(), body: { p_code: v.passcode } });
    if (result?.ok) return enter();
    setBusy(form, false);
    showMsg(form, result?.message || "That passcode is not valid.");
  } catch (error) {
    setBusy(form, false);
    showMsg(form, friendlyError(error));
  }
}

async function signOut() {
  const session = current.session;
  clearSession();
  current.member = null;
  if (session?.access_token) api("/auth/v1/logout", { method: "POST", token: session.access_token }).catch(() => {});
  renderGate("signin", "You're signed out.");
}

// ------------------------------------------------------------------ content

async function fetchBundle(tier) {
  const t = await token();
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/authenticated/${BUCKET}/${tier}/content.json`, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${t}` },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`The ${tier} results aren't available yet (${response.status}).`);
  return response.json();
}

async function signAssets(paths) {
  if (!paths.length) return {};
  const rows = await api(`/storage/v1/object/sign/${BUCKET}`, { method: "POST", token: await token(), body: { expiresIn: 3600, paths } });
  const map = {};
  for (const row of rows || []) {
    if (row.signedURL && row.path) map[row.path.split("/").pop()] = `${SUPABASE_URL}/storage/v1${row.signedURL}`;
  }
  return map;
}

function withAssets(text, urls) {
  return text.replace(/assets\/([\w.-]+\.(?:png|jpe?g|svg|webp))/g, (match, name) => urls[name] || match);
}

function buildNav(toc, unlocked) {
  const links = toc.map((s) => {
    const open = unlocked.has(s.id);
    return `<a href="#${open ? esc(s.id) : "locked"}" class="${open ? "" : "locked"}">${esc(s.title)}</a>`;
  }).join("");
  return `
    <nav class="top">
      <div class="inner">
        <span class="brand">WatchTok Report</span>
        <div class="nav-links" id="navLinks">${links}</div>
        <button class="nav-toggle" id="navToggle" aria-expanded="false" aria-controls="navLinks">Sections ▾</button>
        <div class="nav-fade" id="navFade"></div>
      </div>
    </nav>`;
}

function lockedPanel(toc, unlocked, notice) {
  const locked = toc.filter((s) => !unlocked.has(s.id));
  if (!locked.length) return "";
  return `
    <section class="locked-panel" id="locked">
      <div class="wrap">
        <div class="locked-card">
          <div class="kicker">Full report</div>
          <h2 class="section-title">There's more behind this preview</h2>
          <p class="lead-text">Full access adds:</p>
          <ul>${locked.map((s) => `<li>${esc(s.title)}</li>`).join("")}</ul>
          <form class="gate-form" id="redeem-form" novalidate>
            <label>Have a collaborator passcode?<input name="passcode" autocomplete="off" spellcheck="false" /></label>
            <button class="gate-btn" type="submit">Unlock full report</button>
          </form>
          <p class="gate-fine">Brand access options are coming soon. Questions: <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
        </div>
      </div>
    </section>`;
}

async function renderReport(notice = "") {
  renderAccountBar();
  app.innerHTML = `<div class="gate-shell"><p class="gate-loading">Opening the results…</p></div>`;
  const hasFull = current.member.tier === "full" || current.member.tier === "admin";

  const [sample, full] = await Promise.all([fetchBundle("sample"), hasFull ? fetchBundle("full") : Promise.resolve(null)]);
  const urls = await signAssets(hasFull && full ? full.assets : sample.assets);
  const toc = sample.toc || sample.sections;
  const unlocked = new Set([...sample.sections, ...(full?.sections || [])].map((s) => s.id));

  // Put sections back in report order.
  const holder = document.createElement("div");
  holder.innerHTML = withAssets(sample.html, urls) + (full ? withAssets(full.html, urls) : "");
  const hero = holder.querySelector("header.hero");
  const footer = holder.querySelector("footer");
  const ordered = toc.map((s) => holder.querySelector(`section#${CSS.escape(s.id)}`)).filter(Boolean);

  app.innerHTML = buildNav(toc, unlocked);
  if (hero) app.appendChild(hero);
  ordered.forEach((el) => app.appendChild(el));
  app.insertAdjacentHTML("beforeend", lockedPanel(toc, unlocked, notice));
  if (footer) app.appendChild(footer);
  app.insertAdjacentHTML("beforeend", `<p class="version-note">Results version ${esc((full || sample).version)}</p>`);

  const redeem = app.querySelector("#redeem-form");
  if (redeem) {
    redeem.addEventListener("submit", onRedeem);
    if (notice) showMsg(redeem, notice);
  }

  // Draw charts: the chart code comes from the private bundles, drawn with the public library.
  const chartCode = [sample.charts, full?.charts].filter(Boolean).map((c) => withAssets(c, urls)).join("\n");
  try {
    if (chartCode && window.WTCharts) new Function("WTCharts", chartCode)(window.WTCharts);
  } catch (error) {
    console.error("Chart drawing failed", error);
  }
  if (typeof window.WTReportUI === "function") window.WTReportUI();

  logEvent(hasFull ? "view_full" : "view_sample", (full || sample).version);
  // The report's nav highlighter can nudge the page on first paint; start at the top unless a section was linked.
  let target = null;
  try { target = location.hash && location.hash !== "#" ? document.querySelector(location.hash) : null; } catch { /* not a section link */ }
  setTimeout(() => (target ? target.scrollIntoView() : window.scrollTo(0, 0)), 150);
}

async function enter(notice = "") {
  try {
    const member = await loadMember();
    if (!member) return renderProfileForm(notice);
    await renderReport(notice);
  } catch (error) {
    if (/session has ended/i.test(error.message)) return renderGate("signin", "Please sign in again.");
    app.innerHTML = `<div class="gate-shell"><section class="gate-card">${brandBlock()}<h1>Something went wrong</h1><p class="gate-msg error">${esc(friendlyError(error))}</p><p class="gate-fine"><button class="gate-btn secondary" id="retry">Try again</button></p></section></div>`;
    app.querySelector("#retry").addEventListener("click", () => enter());
  }
}

// ------------------------------------------------------------------ start

// Links in confirmation and password-reset emails come back here with the result in the
// address (#access_token=...&type=signup|recovery, or #error=...). Sign the person in and
// clean the address so the tokens don't linger in history or get shared.
async function handleAuthRedirect() {
  const raw = location.hash.startsWith("#") ? location.hash.slice(1) : "";
  if (!/(^|&)(access_token|error|error_description)=/.test(raw)) return false;
  const p = new URLSearchParams(raw);
  history.replaceState(null, "", RETURN_URL);
  if (p.get("error") || p.get("error_description")) {
    const expired = /expired|invalid/i.test(`${p.get("error_code")} ${p.get("error_description")}`);
    renderGate("signin", expired
      ? "That link has expired or was already used. Sign in below, or use \"Forgot your password?\" to get a new link."
      : (p.get("error_description") || "That link didn't work. Please sign in."), "error");
    return true;
  }
  const expiresIn = Number(p.get("expires_in") || 3600);
  const session = {
    access_token: p.get("access_token"),
    refresh_token: p.get("refresh_token"),
    token_type: p.get("token_type") || "bearer",
    expires_in: expiresIn,
    expires_at: Number(p.get("expires_at") || Math.floor(Date.now() / 1000) + expiresIn)
  };
  try {
    session.user = await api("/auth/v1/user", { token: session.access_token });
  } catch {
    renderGate("signin", "That link didn't work. Please sign in, or use \"Forgot your password?\" to get a new link.", "error");
    return true;
  }
  saveSession(session);
  if (p.get("type") === "recovery") renderNewPassword();
  else await enter();
  return true;
}

(async function start() {
  // report-lib.js is deferred; make sure it has run before drawing.
  if (document.readyState === "loading") await new Promise((r) => document.addEventListener("DOMContentLoaded", r, { once: true }));
  if (await handleAuthRedirect()) return;
  const session = await validSession();
  if (session) await enter();
  else renderGate("register");
})();
