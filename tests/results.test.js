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

// Guard: the results site code on main has features that the report builder's
// pinned copy (builder/site-base, commit 793358f) does not. Replacing these files
// from that copy would silently remove them. If one of these fails, start from
// current main instead of regenerating results/app.js or results/results.css.
test("results site keeps the Request full access button and its styles", () => {
  const app = fs.readFileSync("results/app.js", "utf8");
  const css = fs.readFileSync("results/results.css", "utf8");
  assert.match(app, /id="request-access-btn"/, "Request full access button missing from results/app.js");
  assert.match(app, /results_request_access/, "request-access call missing from results/app.js");
  assert.match(app, /passcode-details/, "collapsed collaborator passcode missing from results/app.js");
  assert.match(css, /\.access-btn/, "button styles missing from results/results.css");
  assert.match(css, /\.locked-panel \.gate-fine a \{ color: var\(--gold\)/, "dark-mode link fix missing from results/results.css");
});

// Nov 2026 playbook layout: chart calls live in their own "Populate" script and are
// guarded with "document.getElementById('x') && ", the nav script has no toggle-btn,
// and the hero can carry its own small script.
const playbook = `<!doctype html><html><head></head><body>
<style>.x{color:red}</style>
<nav class="top"><div class="nav-links" id="navLinks"><a href="#community">How It Works</a><a href="#market">What It's Worth</a><a href="#personas">Who's There</a></div><button id="navToggle"></button></nav>
<header class="hero"><span id="heroCount">155K</span><a href="#personas">Who's there</a></header>
<section id="community"><p>Community</p></section>
<section class="alt" id="market"><div id="chart-a"></div><div id="chart-x"></div></section>
<section id="personas"><div id="chart-b"></div><p>PERSONA-SECRET</p></section>
<footer><p>Foot</p></footer>
<script>(function(){ var t=document.getElementById('navToggle'); })();</script>
<script>
const WTCharts = (function () {
  function hbar() {}
  return { hbar };
})();
</script>
<script>
// ---- Populate every live chart panel with real survey data ----
try {
document.getElementById('chart-a') && WTCharts.hbar(document.getElementById('chart-a'), {
  bars: [{value: 11}]
});
document.getElementById('chart-b') && WTCharts.hbar(document.getElementById('chart-b'), {
  bars: [{value: 535353}]
});
} catch(e) {}
</script>
<script>(function(){var el=document.getElementById('heroCount'); var to=155;})();</script>
<script>// ---- Scroll-in animations ----
(function(){ document.querySelectorAll('.live-chart-panel'); })();</script>
<script>(function(){ var host=document.getElementById('chart-x'); var micro=[47,62]; })();</script>
</body></html>`;

test("playbook layout: guarded chart calls split by tier; hero and sample scripts stay in sample", () => {
  const { bundles, publicLib, calls } = splitReport(playbook, { version: "T2", sampleSections: ["community", "market"] });
  assert.equal(calls.length, 2);
  assert.deepEqual(bundles.sample.sections.map((s) => s.id), ["community", "market"]);
  assert.ok(bundles.sample.charts.includes("chart-a") && !bundles.sample.charts.includes("535353"));
  assert.ok(bundles.full.charts.includes("535353"));
  assert.ok(bundles.sample.charts.includes("var to=155") && bundles.sample.charts.includes("micro=[47,62]"));
  assert.ok(!bundles.sample.html.includes("PERSONA-SECRET"));
  assert.ok(publicLib.includes("window.WTCharts =") && publicLib.includes("navToggle") && publicLib.includes("Scroll-in animations"));
  assert.ok(!publicLib.includes("535353") && !publicLib.includes("var to=155") && !publicLib.includes("micro=[47"));
});
