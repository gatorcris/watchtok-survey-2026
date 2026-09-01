import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config.js";
import { loadAuthSession, saveAuthSession } from "./storage.js";

const baseHeaders = {
  apikey: SUPABASE_PUBLISHABLE_KEY,
  "Content-Type": "application/json"
};

async function request(path, options = {}, accessToken = null) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      ...baseHeaders,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(body?.message || body?.msg || body?.error_description || `Request failed (${response.status})`);
    error.status = response.status;
    error.details = body;
    throw error;
  }
  return body;
}

function sessionIsFresh(session) {
  return session?.access_token && Number(session.expires_at || 0) > Math.floor(Date.now() / 1000) + 60;
}

export async function ensureAnonymousSession(isTest = false) {
  let session = loadAuthSession(isTest);
  if (sessionIsFresh(session)) return session;
  if (session?.refresh_token) {
    try {
      session = await request("/auth/v1/token?grant_type=refresh_token", {
        method: "POST",
        body: JSON.stringify({ refresh_token: session.refresh_token })
      });
      saveAuthSession(session, isTest);
      return session;
    } catch {
      // A revoked or expired refresh token falls through to a new anonymous identity.
    }
  }
  session = await request("/auth/v1/signup", { method: "POST", body: "{}" });
  saveAuthSession(session, isTest);
  return session;
}

export async function loadRemoteResponse(session, surveyVersion, isTest) {
  const query = new URLSearchParams({
    select: "*",
    owner_id: `eq.${session.user.id}`,
    survey_version: `eq.${surveyVersion}`,
    is_test: `eq.${isTest}`,
    limit: "1"
  });
  const rows = await request(`/rest/v1/survey_responses?${query}`, { method: "GET" }, session.access_token);
  return rows?.[0] || null;
}

export async function saveRemoteResponse(session, payload) {
  const query = new URLSearchParams({ on_conflict: "owner_id,survey_version,is_test" });
  const rows = await request(`/rest/v1/survey_responses?${query}`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(payload)
  }, session.access_token);
  return rows?.[0] || null;
}

export async function submitContactOptIn(session, payload) {
  return request("/rest/v1/contact_optins", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(payload)
  }, session.access_token);
}
