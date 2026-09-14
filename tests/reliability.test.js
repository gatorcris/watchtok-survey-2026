import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { classifySyncFailure, createRecoverySnapshot, createSerialQueue } from "../src/reliability.js";

test("sync failures receive useful non-sensitive references", () => {
  assert.equal(classifySyncFailure({ status: 401 }), "SESSION-401");
  assert.equal(classifySyncFailure({ status: 403 }), "PERMISSION-403");
  assert.equal(classifySyncFailure({ status: 503 }), "SERVICE-503");
  assert.equal(classifySyncFailure({}), "NETWORK");
});

test("recovery copies contain survey state but no authentication tokens", () => {
  const snapshot = createRecoverySnapshot({
    status: "partial",
    currentQuestionId: "Q20",
    startedAt: "2026-09-14T20:00:00.000Z",
    updatedAt: "2026-09-14T20:10:00.000Z",
    referral: "direct",
    answers: { Q1: "2", Q20: ["2", "3"] }
  }, "V9", "2026-09-14T20:11:00.000Z");
  assert.equal(snapshot.survey_version, "V9");
  assert.deepEqual(snapshot.answers.Q20, ["2", "3"]);
  assert.equal("access_token" in snapshot, false);
  assert.equal("auth" in snapshot, false);
});

test("remote saves execute in the order they were queued", async () => {
  const enqueue = createSerialQueue();
  const order = [];
  const first = enqueue(async () => {
    await new Promise((resolve) => setTimeout(resolve, 15));
    order.push("partial");
  });
  const second = enqueue(async () => order.push("completed"));
  await Promise.all([first, second]);
  assert.deepEqual(order, ["partial", "completed"]);
});

test("deployment SQL grants authenticated respondents update access", async () => {
  const sql = await readFile(new URL("../supabase/002_authenticated_client_grants.sql", import.meta.url), "utf8");
  assert.match(sql, /grant\s+select\s*,\s*insert\s*,\s*update\s+on\s+table\s+public\.survey_responses\s+to\s+authenticated/i);
});

test("the client cancels pending autosave before final completion", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(app, /clearTimeout\(saveTimer\);\s*saveTimer = null;\s*state\.pendingCompletion = true;\s*const submitted = await syncNow\(COMPLETED_STATUS\)/s);
  assert.match(app, /const retryStatus = state\.pendingCompletion \? COMPLETED_STATUS : state\.status/);
});
