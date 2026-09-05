import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("V9 uses the approved welcome wording and public survey email", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const config = await readFile(new URL("../src/config.js", import.meta.url), "utf8");

  assert.match(app, /After completion, you may separately provide an email to be involved in future surveys\./);
  assert.match(config, /watchtoksurvey@gmail\.com/);
  assert.doesNotMatch(config, /bjelajac\.cristopher@gmail\.com/);
});

test("V9 header uses the WATCHTOK SURVEY brand and independent-research logo", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const mark = await readFile(new URL("../assets/watchtok-research-mark.svg", import.meta.url), "utf8");

  assert.match(html, /watchtok-research-mark\.svg/);
  assert.match(html, /WATCHTOK SURVEY/);
  assert.match(html, /INDEPENDENT ENTHUSIAST RESEARCH/);
  assert.match(mark, /WATCHTOK SURVEY independent research mark/);
  assert.doesNotMatch(html, /prototype-badge/);
});

test("V9 contact consent is future-surveys-only and disabled in Test Mode", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");

  assert.match(app, /Invite me to future WatchTok surveys\./);
  assert.match(app, /receive_report: false/);
  assert.match(app, /Optional email collection is disabled/);
  assert.doesNotMatch(app, /name="receive_report"/);
  assert.doesNotMatch(app, /Send me the published report/);
  assert.doesNotMatch(app, /receive the published report/);
});

test("V9 publishes the canonical URL and remains intentionally unindexed before launch", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  const robots = await readFile(new URL("../robots.txt", import.meta.url), "utf8");

  assert.match(readme, /https:\/\/watchtoksurvey\.com\//);
  assert.match(html, /noindex,nofollow/);
  assert.match(robots, /Disallow: \/$/m);
});

test("V9 has creator-neutral social sharing metadata", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const socialImage = await readFile(new URL("../assets/watchtok-survey-social.png", import.meta.url));
  const qrImage = await readFile(new URL("../assets/watchtok-survey-qr-mobile.png", import.meta.url));

  assert.match(html, /rel="canonical" href="https:\/\/watchtoksurvey\.com\/"/);
  assert.match(html, /property="og:site_name" content="WATCHTOK SURVEY"/);
  assert.match(html, /watchtok-survey-social\.png/);
  assert.ok(socialImage.length > 10_000);
  assert.ok(qrImage.length > 10_000);
});

test("the distributed QR builder encodes only the canonical untagged URL", async () => {
  const qrBuilder = await readFile(new URL("../scripts/build-qr-card.py", import.meta.url), "utf8");

  assert.match(qrBuilder, /URL = "https:\/\/watchtoksurvey\.com\/"/);
  assert.doesNotMatch(qrBuilder, /\?ref=/);
  assert.doesNotMatch(qrBuilder, /gatorcris/i);
});
