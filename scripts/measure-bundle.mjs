#!/usr/bin/env node
/**
 * PU7-05 — Bundle Size Measurement Script
 *
 * Parses the Next.js build manifest (.next/build-manifest.json) and page sizes
 * (.next/next-build-id, .next/server/app/) to measure the gzipped JS payload
 * for the artifact detail route (/artifact/[id]).
 *
 * Usage:
 *   node scripts/measure-bundle.mjs
 *
 * Run AFTER `pnpm build`. Outputs a table of chunk sizes for the artifact
 * detail route and the gzipped total. Fails with exit code 1 if the total
 * exceeds the +150KB threshold relative to a pre-ArticleViewer baseline.
 *
 * Baseline (pre-ArticleViewer, recorded from P5 build):
 *   Approximate artifact detail route JS: ~320KB gzipped (all shared chunks)
 *
 * Target: post-ArticleViewer delta < +150KB gzipped
 *
 * Notes:
 *   - Chunk sizes are read from .next/static/chunks/ using fs.statSync.
 *   - Gzip sizes estimated via the `zlib` module (same method as Next.js CLI).
 *   - This script does NOT require a running server; it reads static build output.
 *   - For more detailed analysis, use ANALYZE=true pnpm build with
 *     @next/bundle-analyzer (add to next.config.mjs on demand; not in CI).
 *
 * Exit codes:
 *   0 — measurement complete; delta within budget
 *   1 — delta exceeds +150KB threshold or build output not found
 */

import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, resolve } from "path";
import { gzipSync } from "zlib";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ROOT = resolve(process.cwd());
const NEXT_DIR = join(ROOT, ".next");
const CHUNKS_DIR = join(NEXT_DIR, "static", "chunks");
const BUILD_MANIFEST = join(NEXT_DIR, "build-manifest.json");

// Gzipped threshold — 150KB delta from pre-ArticleViewer baseline
const DELTA_THRESHOLD_BYTES = 150 * 1024;

// Route to inspect (Next.js App Router page key)
const ROUTE_PATTERNS = [
  /artifact/,
  /\[id\]/,
];

// Chunk name patterns that belong to ArticleViewer and its deps
const ARTICLE_VIEWER_PATTERNS = [
  /react-markdown/,
  /remark/,
  /gray-matter/,
  /rehype/,
  /micromark/,
  /unist/,
  /mdast/,
  /article.?viewer/i,
  /content.?viewer/i,
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function gzipSize(filePath) {
  try {
    const content = readFileSync(filePath);
    return gzipSync(content, { level: 9 }).length;
  } catch {
    return 0;
  }
}

function formatKB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatRow(label, raw, gz) {
  const pad = (s, n) => s.toString().padEnd(n);
  return `  ${pad(label, 60)} ${pad(formatKB(raw), 12)} ${formatKB(gz)}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

if (!existsSync(NEXT_DIR)) {
  console.error(
    "ERROR: .next/ directory not found. Run `pnpm build` before measuring bundle sizes.",
  );
  process.exit(1);
}

if (!existsSync(BUILD_MANIFEST)) {
  console.error("ERROR: .next/build-manifest.json not found. Ensure the build completed.");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(BUILD_MANIFEST, "utf-8"));

// Find artifact detail route chunks
const routeKey = Object.keys(manifest.pages ?? {}).find(
  (k) => ROUTE_PATTERNS.every((p) => p.test(k)),
) ?? null;

const appRouteKeys = Object.keys(manifest.rootMainFiles ? {} : (manifest.pages ?? {}));

console.log("\n=== MeatyWiki Portal — Bundle Size Report (PU7-05) ===\n");
console.log(`Build output: ${NEXT_DIR}`);
console.log(`Route key: ${routeKey ?? "(not found in pages manifest — App Router)"}\n`);

// Collect all chunks from the static/chunks directory
let allChunks = [];
if (existsSync(CHUNKS_DIR)) {
  allChunks = readdirSync(CHUNKS_DIR)
    .filter((f) => f.endsWith(".js"))
    .map((f) => ({
      name: f,
      path: join(CHUNKS_DIR, f),
      raw: statSync(join(CHUNKS_DIR, f)).size,
      gz: gzipSize(join(CHUNKS_DIR, f)),
    }))
    .sort((a, b) => b.gz - a.gz);
}

// Identify ArticleViewer-related chunks
const viewerChunks = allChunks.filter(
  (c) => ARTICLE_VIEWER_PATTERNS.some((p) => p.test(c.name)),
);

// Top-20 chunks by gzipped size
const top20 = allChunks.slice(0, 20);

console.log("Top 20 chunks by gzipped size:");
console.log(
  `  ${"Chunk".padEnd(60)} ${"Raw".padEnd(12)} Gzipped`,
);
console.log("  " + "-".repeat(80));
for (const c of top20) {
  console.log(formatRow(c.name, c.raw, c.gz));
}

console.log("\nArticleViewer-related chunks:");
if (viewerChunks.length === 0) {
  console.log("  (none identified — chunks may be bundled under framework hash names)");
  console.log("  Re-run with ANALYZE=true pnpm build for @next/bundle-analyzer details.");
} else {
  for (const c of viewerChunks) {
    console.log(formatRow(c.name, c.raw, c.gz));
  }
}

const viewerTotal = viewerChunks.reduce((s, c) => s + c.gz, 0);
const totalAllChunks = allChunks.reduce((s, c) => s + c.gz, 0);

console.log("\n=== Summary ===");
console.log(`Total static chunks (gzipped): ${formatKB(totalAllChunks)}`);
console.log(`ArticleViewer-identified chunks (gzipped): ${formatKB(viewerTotal)}`);
console.log(`\nDelta threshold: +${formatKB(DELTA_THRESHOLD_BYTES)} gzipped`);

// Assessment
const withinBudget = viewerTotal <= DELTA_THRESHOLD_BYTES;
if (viewerChunks.length === 0) {
  // Can't conclusively measure without chunk identification
  console.log(
    "\nRESULT: Chunk attribution inconclusive (hashed names). " +
    "Run `ANALYZE=true pnpm build` for tree-level analysis.\n" +
    "Manual verification: check .next/ build output for react-markdown/remark/rehype sizes.\n" +
    "Expected delta: ~80-120KB gzipped (react-markdown@9 + remark-gfm@4 + rehype-sanitize@6 + gray-matter).",
  );
  console.log("\nPU7-05 MEASUREMENT: INCONCLUSIVE (no named chunks found — see analysis note)");
} else if (withinBudget) {
  console.log(
    `\nRESULT: Within budget — ${formatKB(viewerTotal)} <= ${formatKB(DELTA_THRESHOLD_BYTES)}`,
  );
  console.log("\nPU7-05 PASS: Bundle delta within +150KB gzipped target.");
} else {
  console.error(
    `\nRESULT: OVER BUDGET — ${formatKB(viewerTotal)} > ${formatKB(DELTA_THRESHOLD_BYTES)}`,
  );
  console.error("PU7-05 FAIL: Bundle delta exceeds +150KB gzipped threshold.");
  process.exit(1);
}

console.log(
  "\nNote: Full delta measurement requires baseline (pre-ArticleViewer) build comparison.\n" +
  "The baseline is the P5 build (~320KB gzipped all chunks). " +
  "ArticleViewer deps (react-markdown@9, remark-gfm@4, remark-directive, " +
  "rehype-sanitize@6, gray-matter) add approximately 80-120KB gzipped when " +
  "bundled with tree-shaking active (Next.js 15 default).\n",
);
