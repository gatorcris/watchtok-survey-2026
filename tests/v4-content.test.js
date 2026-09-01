import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("V4 uses the approved welcome wording and public survey email", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const config = await readFile(new URL("../src/config.js", import.meta.url), "utf8");

  assert.match(app, /After completion, you may separately provide an email to be involved in future surveys\./);
  assert.match(config, /watchtoksurvey@gmail\.com/);
  assert.doesNotMatch(config, /bjelajac\.cristopher@gmail\.com/);
});

test("V4 header uses the independent-research logo asset", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const mark = await readFile(new URL("../assets/watchtok-research-mark.svg", import.meta.url), "utf8");

  assert.match(html, /watchtok-research-mark\.svg/);
  assert.match(html, /INDEPENDENT ENTHUSIAST RESEARCH/);
  assert.match(mark, /WatchTok independent research mark/);
});

test("V4 contact consent is future-surveys-only and disabled in Test Mode", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");

  assert.match(app, /Invite me to future WatchTok surveys\./);
  assert.match(app, /receive_report: false/);
  assert.match(app, /Optional email collection is disabled/);
  assert.doesNotMatch(app, /name="receive_report"/);
  assert.doesNotMatch(app, /Send me the published report/);
  assert.doesNotMatch(app, /receive the published report/);
});
