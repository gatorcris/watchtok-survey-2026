import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { splitReport } from "../scripts/build-results-content.mjs";

const page = `<!doctype html><html><head></head><body>
<style>.x{color:red}</style>
<nav class="top"><div class="nav-links"><a href="#market">What It's Worth</a><a href="#personas">Personas</a><a href="#price">Price Tier</a></div></nav>
<header class="hero"><h1>Hero</h1></header>
<section class="alt" id="market"><div id="chart-a"></div><img src="assets/shared.jpg"></section>
<section id="personas"><p>Personas</p></section>
<section id="price"><div id="chart-b"></div><img src="assets/secret.png"><p>PRICE-SECRET</p></section>
<footer><p>Foot</p></footer>
<script>(function(){ document.querySelectorAll('.toggle-btn'); })();</script>
<script>
const WTCharts = (function () {
  function bubble() {}
  return { bubble };
})();

// ---- Populate every live chart panel with real survey data ----
try {
WTCharts.bubble(document.getElementById('chart-a'), {
  points: [{x: 1}]
});

WTCharts.bubble(document.getElementById('chart-b'), {
  points: [{x: 424242}], avatar: 'assets/shared.jpg'
});
} catch(e) {}
</script>
</body></html>`;

test("sample bundle holds only sample sections, charts, and the full table of contents", () => {
  const { bundles } = splitReport(page, { version: "T1" });
  assert.deepEqual(bundles.sample.sections.map((s) => s.id), ["market", "personas"]);
  assert.ok(bundles.sample.html.includes("Hero"));
  assert.ok(!bundles.sample.html.includes("PRICE-SECRET"));
  assert.ok(bundles.sample.charts.includes("chart-a"));
  assert.ok(!bundles.sample.charts.includes("424242"));
  assert.deepEqual(bundles.sample.toc.map((s) => [s.id, s.tier]), [["market", "sample"], ["personas", "sample"], ["price", "full"]]);
  assert.deepEqual(bundles.sample.assets, ["sample/assets/shared.jpg"]);
});

test("full bundle holds locked sections, their charts, and images from both tiers", () => {
  const { bundles } = splitReport(page, { version: "T1" });
  assert.deepEqual(bundles.full.sections.map((s) => s.id), ["price"]);
  assert.ok(bundles.full.html.includes("PRICE-SECRET") && bundles.full.html.includes("Foot"));
  assert.ok(bundles.full.charts.includes("424242"));
  assert.deepEqual(bundles.full.assets.sort(), ["full/assets/secret.png", "sample/assets/shared.jpg"]);
});

test("public library carries drawing code but no survey data", () => {
  const { publicLib } = splitReport(page, { version: "T1" });
  assert.ok(publicLib.includes("window.WTCharts ="));
  assert.ok(publicLib.includes("window.WTReportUI"));
  assert.ok(!publicLib.includes("424242") && !publicLib.includes("points"));
});

test("extra data scripts (appendix) stay in the full tier only", () => {
  const withAppendix = page.replace(
    "<footer>",
    `<script>const APPENDIX = [{q:"Q1", v:777777}];</script>
<script>(function(){ var w=document.getElementById('chart-b'); APPENDIX.forEach(function(){}); })();</script>
<footer>`
  );
  const { bundles, publicLib } = splitReport(withAppendix, { version: "T1" });
  assert.ok(bundles.full.charts.includes("777777") && bundles.full.charts.includes("APPENDIX.forEach"));
  assert.ok(!bundles.sample.charts.includes("777777"));
  assert.ok(!publicLib.includes("777777"));
});

test("a missing sample section fails loudly instead of leaking or hiding content", () => {
  assert.throws(() => splitReport(page, { sampleSections: ["nope"] }), /not found/);
});

test("committed results files never contain report content", () => {
  for (const file of ["results/index.html", "results/app.js", "results/report-lib.js"]) {
    const text = fs.readFileSync(file, "utf8");
    assert.ok(!/\$158 million|Brand Backer|n=73/.test(text), `${file} contains report content`);
  }
});

test("built content is git-ignored", () => {
  assert.match(fs.readFileSync(".gitignore", "utf8"), /^build\/$/m);
});
