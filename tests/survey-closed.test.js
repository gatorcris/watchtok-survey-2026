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
