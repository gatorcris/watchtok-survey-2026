if (process.env.RUN_LIVE_SMOKE !== "1") {
  console.error("Set RUN_LIVE_SMOKE=1 to create one clearly marked test response in Supabase.");
  process.exit(2);
}

const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key)
};

const { ensureAnonymousSession, loadRemoteResponse, saveRemoteResponse } = await import("../src/supabase.js");
const { COMPLETED_STATUS, SURVEY_VERSION } = await import("../src/survey.js");

const session = await ensureAnonymousSession(true);
const startedAt = new Date().toISOString();
const base = {
  owner_id: session.user.id,
  survey_version: SURVEY_VERSION,
  is_test: true,
  status: "partial",
  answers: { Q1: "SMOKE_TEST" },
  referral_code: "integration-smoke",
  last_question_id: "Q1",
  last_display_question: 1,
  started_at: startedAt,
  updated_at: startedAt,
  completed_at: null
};

const created = await saveRemoteResponse(session, base);
if (!created?.id) throw new Error("Supabase did not return the created test row.");

const loaded = await loadRemoteResponse(session, SURVEY_VERSION, true);
if (loaded?.id !== created.id || loaded?.answers?.Q1 !== "SMOKE_TEST") {
  throw new Error("The saved test response did not round-trip correctly.");
}

const completedAt = new Date().toISOString();
const completed = await saveRemoteResponse(session, {
  ...base,
  status: COMPLETED_STATUS,
  answers: { Q1: "SMOKE_TEST_COMPLETE" },
  updated_at: completedAt,
  completed_at: completedAt
});
if (completed?.status !== COMPLETED_STATUS) throw new Error("The test response did not complete.");

console.log(JSON.stringify({ ok: true, response_id: completed.id, is_test: completed.is_test, status: completed.status }));
