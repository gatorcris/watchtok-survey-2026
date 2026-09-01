import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("V3 uses the approved follow-up wording and public survey email", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const config = await readFile(new URL("../src/config.js", import.meta.url), "utf8");

  assert.match(app, /After completion, you may separately provide an email to be involved in future surveys\./);
  assert.match(config, /watchtoksurvey@gmail\.com/);
  assert.doesNotMatch(config, /bjelajac\.cristopher@gmail\.com/);
});

test("V3 header uses the independent-research logo asset", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const mark = await readFile(new URL("../assets/watchtok-research-mark.svg", import.meta.url), "utf8");

  assert.match(html, /watchtok-research-mark\.svg/);
  assert.match(html, /INDEPENDENT ENTHUSIAST RESEARCH/);
  assert.match(mark, /WatchTok independent research mark/);
});
