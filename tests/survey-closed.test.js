import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SURVEY_CLOSED } from "../src/config.js";

const app = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");

test("2026 survey is closed on the public site", () => {
  assert.equal(SURVEY_CLOSED, true);
  assert.match(app, /const surveyClosed = SURVEY_CLOSED && !isTest;/);
  assert.match(app, /The 2026 WatchTok survey is closed\./);
});

test("closed page collects 2027 emails and never loads the survey", () => {
  assert.match(app, /data-closed-form/);
  assert.match(app, /if \(surveyClosed\) return;\s*\n\s*if \(event\.target\.matches\("\[data-contact-form\]"\)\)/);
  assert.match(app, /Closed: no survey session, no loading or saving of responses\.\n\s*if \(surveyClosed\) return;/);
});

test("email sign-up uses double opt-in", () => {
  const confirmPage = readFileSync(new URL("../confirm.html", import.meta.url), "utf8");
  const confirmJs = readFileSync(new URL("../src/confirm.js", import.meta.url), "utf8");
  const sql = readFileSync(new URL("../supabase/015_contact_optin_confirm.sql", import.meta.url), "utf8");
  assert.match(app, /Check your inbox and click the link to confirm/);
  assert.match(confirmPage, /src\/confirm\.js/);
  assert.match(confirmJs, /rpc\/confirm_contact_optin/);
  assert.match(sql, /grant insert \(email, receive_report, future_research, consented_at\)/);
});

test("database refuses new real responses while closed", () => {
  const sql = readFileSync(new URL("../supabase/014_close_2026_survey.sql", import.meta.url), "utf8");
  assert.match(sql, /with check \(owner_id = \(select auth\.uid\(\)\) and is_test = true\)/);
});
