#!/usr/bin/env node
// Split the published results report into public code + private, tiered content.
//
// Usage:
//   node scripts/build-results-content.mjs <report-folder> --version V8 [--out build/results-content]
//
// <report-folder> must contain index.html (the report page) and assets/ (its images).
//
// Output (nothing here contains survey data except the two private folders):
//   results/report.css           -> committed to the repo (styling only)
//   results/report-lib.js        -> committed to the repo (chart drawing + tab code, no data)
//   <out>/sample/...             -> upload to Supabase Storage bucket "results-content"
//   <out>/full/...               -> upload to Supabase Storage bucket "results-content"

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Sections any registered viewer sees. Everything else is full-access only.
export const SAMPLE_SECTIONS = ["market", "personas"];

export function splitReport(html, { version = "draft", sampleSections = SAMPLE_SECTIONS } = {}) {
  const body = html.slice(html.indexOf("<body>") + 6);

  const styles = [...body.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");

  const hero = (body.match(/<header class="hero">[\s\S]*?<\/header>/) || [""])[0];
  const footer = (body.match(/<footer>[\s\S]*?<\/footer>/) || [""])[0];
  const navBlock = (body.match(/<nav class="top">[\s\S]*?<\/nav>/) || [""])[0];
  const navTitles = Object.fromEntries(
    [...navBlock.matchAll(/<a href="#([^"]+)">([^<]+)<\/a>/g)].map((m) => [m[1], m[2]])
  );

  const sections = [...body.matchAll(/<section\b[^>]*\bid="([^"]+)"[^>]*>[\s\S]*?<\/section>/g)].map((m) => ({
    id: m[1],
    title: navTitles[m[1]] || m[1],
    html: m[0],
    tier: sampleSections.includes(m[1]) ? "sample" : "full"
  }));
  if (!sections.length) throw new Error("No <section id=...> blocks found in the report.");
  for (const id of sampleSections) {
    if (!sections.some((s) => s.id === id)) throw new Error(`Sample section "${id}" not found in the report.`);
  }

  const scripts = [...body.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const uiScript = scripts.find((s) => s.includes("toggle-btn")) || "";
  const chartScript = scripts.find((s) => s.includes("WTCharts")) || "";
  const libEnd = chartScript.search(/\n\s*\/\/ ---- Populate|\ntry \{\s*\nWTCharts\./);
  const chartLib = libEnd > 0 ? chartScript.slice(0, libEnd) : "";
  const callSource = libEnd > 0 ? chartScript.slice(libEnd) : "";
  const calls = [...callSource.matchAll(/WTCharts\.\w+\(document\.getElementById\('([^']+)'\),[\s\S]*?\n\}\);/g)].map(
    (m) => ({ target: m[1], code: m[0] })
  );

  const chartsByTier = { sample: [], full: [] };
  for (const call of calls) {
    const owner = sections.find((s) => s.html.includes(`id="${call.target}"`));
    chartsByTier[owner ? owner.tier : "full"].push(call.code);
  }

  // Any other scripts (e.g. the appendix data + its renderer) may carry survey data.
  // They go to the sample tier only when every element they draw into is in a sample
  // section; otherwise (or when unsure) they are full-access only.
  const extraScripts = scripts.filter((s) => s !== uiScript && s !== chartScript && s.trim());
  // A data script with no drawing target (e.g. APPENDIX_SECTIONS) therefore lands in full.
  const extraByTier = { sample: [], full: [] };
  for (const code of extraScripts) {
    const targets = [...code.matchAll(/getElementById\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]);
    const owners = targets.map((id) => sections.find((s) => s.html.includes(`id="${id}"`)));
    const allSample = owners.length > 0 && owners.every((o) => o && o.tier === "sample");
    extraByTier[allSample ? "sample" : "full"].push(code);
  }
  for (const tier of ["sample", "full"]) {
    // One block per tier so a data script and its renderer share scope, in page order.
    if (extraByTier[tier].length) chartsByTier[tier].push(`{\n${extraByTier[tier].join("\n;\n")}\n}`);
  }

  const bundles = {};
  for (const tier of ["sample", "full"]) {
    const own = sections.filter((s) => s.tier === tier);
    const htmlParts = tier === "sample" ? [hero, ...own.map((s) => s.html)] : [...own.map((s) => s.html), footer];
    const chartJs = chartsByTier[tier].join("\n\n");
    bundles[tier] = {
      tier,
      version,
      builtAt: new Date().toISOString(),
      sections: own.map(({ id, title }) => ({ id, title })),
      html: htmlParts.join("\n"),
      charts: chartJs,
      assets: []
    };
  }
  // The sample bundle carries the full table of contents so locked sections can be listed by title.
  bundles.sample.toc = sections.map(({ id, title, tier }) => ({ id, title, tier }));

  // Assign each image to the lowest tier that uses it.
  const assetRefs = (text) => [...new Set([...text.matchAll(/assets\/([\w.-]+\.(?:png|jpe?g|svg|webp))/g)].map((m) => m[1]))];
  const sampleAssets = assetRefs(bundles.sample.html + bundles.sample.charts);
  const fullAssets = assetRefs(bundles.full.html + bundles.full.charts).filter((a) => !sampleAssets.includes(a));
  bundles.sample.assets = sampleAssets.map((a) => `sample/assets/${a}`);
  bundles.full.assets = [...sampleAssets.map((a) => `sample/assets/${a}`), ...fullAssets.map((a) => `full/assets/${a}`)];

  const publicLib = [
    "// Generated by scripts/build-results-content.mjs — drawing and interaction code only, no survey data.",
    chartLib.replace(/^\s*(const|let|var)\s+WTCharts\s*=/m, "window.WTCharts ="),
    "window.WTReportUI = function () {",
    uiScript,
    "};"
  ].join("\n");

  return { styles, publicLib, bundles, sampleAssets, fullAssets, calls };
}

function parseArgs(argv) {
  const args = { positional: [] };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith("--")) args[argv[i].slice(2)] = argv[i + 1], (i += 1);
    else args.positional.push(argv[i]);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const reportDir = args.positional[0];
  if (!reportDir || !args.version) {
    console.error("Usage: node scripts/build-results-content.mjs <report-folder> --version V8 [--out build/results-content]");
    process.exit(1);
  }
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const outDir = path.resolve(args.out || path.join(repoRoot, "build", "results-content"));
  const html = fs.readFileSync(path.join(reportDir, "index.html"), "utf8");
  const result = splitReport(html, { version: args.version });

  fs.writeFileSync(path.join(repoRoot, "results", "report.css"), `/* Generated from the report page. */\n${result.styles}`);
  fs.writeFileSync(path.join(repoRoot, "results", "report-lib.js"), result.publicLib);

  fs.rmSync(outDir, { recursive: true, force: true });
  for (const tier of ["sample", "full"]) {
    const dir = path.join(outDir, tier, "assets");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(outDir, tier, "content.json"), JSON.stringify(result.bundles[tier]));
    const own = tier === "sample" ? result.sampleAssets : result.fullAssets;
    for (const name of own) {
      const src = path.join(reportDir, "assets", name);
      if (!fs.existsSync(src)) throw new Error(`Missing image: ${src}`);
      fs.copyFileSync(src, path.join(dir, name));
    }
  }

  const s = result.bundles.sample;
  const f = result.bundles.full;
  console.log(`Built ${args.version}`);
  console.log(`  sample: ${s.sections.map((x) => x.id).join(", ")} | ${result.sampleAssets.length} images`);
  console.log(`  full:   ${f.sections.map((x) => x.id).join(", ")} | ${result.fullAssets.length} images`);
  console.log(`  charts: ${result.calls.length} total`);
  console.log(`Upload the "sample" and "full" folders in ${outDir} to the results-content bucket.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
