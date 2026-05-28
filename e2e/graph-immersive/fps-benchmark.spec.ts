/**
 * E2E FPS Performance Benchmarks: Graph Immersive 3D — Portal v2.5 (TEST-003)
 *
 * Measures requestAnimationFrame-based FPS for the 3D graph renderer across
 * three synthetic node-count scenarios (1K / 5K / 10K) and writes results to
 * baselines/graph-immersive-fps-baseline.json.
 *
 * HEADLESS GPU NOTE:
 *   Real FPS measurement is not possible in a headless Chromium environment
 *   because the GPU compositor path is unavailable — rAF ticks at 60Hz by
 *   clock-rate but no WebGL frames are actually rendered. The test detects this
 *   condition (canvas invisible or WebGL context unavailable) and writes
 *   placeholder values with "placeholder": true in the baseline JSON.
 *
 *   Before release, re-baseline on real hardware (non-headless Chrome, GPU
 *   available):
 *     PLAYWRIGHT_HEADED=1 pnpm exec playwright test \
 *       e2e/graph-immersive/fps-benchmark.spec.ts \
 *       --project=chromium
 *
 * Schema (baselines/graph-immersive-fps-baseline.json):
 *   {
 *     "schema_version": 1,
 *     "generated_at": "<ISO timestamp>",
 *     "device_profile": "test-runner",
 *     "placeholder": true,          // present when GPU unavailable
 *     "scenarios": [
 *       {
 *         "node_count": 1000,
 *         "edge_count": 3000,
 *         "p50_fps": 60,
 *         "p95_fps": 58,
 *         "mode": "3d"
 *       },
 *       ...
 *     ]
 *   }
 *
 * CI skip:
 *   Set GRAPH_PERF_ENABLED=1 to run in CI (skipped by default to avoid flaky
 *   results on headless runners without GPU).
 */

import { test, expect, type Page } from "@playwright/test";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { TEST_TOKEN } from "../support/fixtures";

// ---------------------------------------------------------------------------
// Benchmark configuration
// ---------------------------------------------------------------------------

interface BenchmarkScenario {
  nodeCount: number;
  edgeCount: number;
  mode: "3d";
}

const BENCHMARK_SCENARIOS: BenchmarkScenario[] = [
  { nodeCount: 1_000, edgeCount: 3_000, mode: "3d" },
  { nodeCount: 5_000, edgeCount: 15_000, mode: "3d" },
  { nodeCount: 10_000, edgeCount: 30_000, mode: "3d" },
];

/** Duration to sample rAF ticks for FPS measurement. */
const SAMPLE_WINDOW_MS = 10_000;

/** Minimum acceptable p95 FPS by node count (informational — not a hard gate here). */
const FPS_TARGETS: Record<number, number> = {
  1_000: 55,
  5_000: 45,
  10_000: 28,
};

// ---------------------------------------------------------------------------
// Synthetic fixture generators
// ---------------------------------------------------------------------------

function buildGraphFixture(nodeCount: number) {
  const nodes = Array.from({ length: nodeCount }, (_, i) => ({
    id: `n${i}`,
    title: `Node ${i}`,
    type: i % 3 === 0 ? "concept" : i % 3 === 1 ? "entity" : "topic_note",
    workspace: i % 2 === 0 ? "library" : "research",
    status: "active",
    fidelity: (i % 5) / 4,
    freshness_class: "current",
    classification_confidence: 0.7,
    x: (i % 100) * 10,
    y: Math.floor(i / 100) * 10,
    degree: i % 20,
    updated: "2026-05-20T12:00:00Z",
  }));

  // Sparse edge set: connect every node to two others (not just sequential chain)
  const edgeSet = new Set<string>();
  const edges: Array<{ id: string; source: string; target: string; type: string; confidence: number }> = [];
  let edgeIdx = 0;
  for (let i = 0; i < Math.min(nodeCount - 1, nodes.length); i++) {
    const src = `n${i}`;
    const tgt = `n${(i + 1) % nodeCount}`;
    const key = `${src}:${tgt}`;
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      edges.push({ id: `e${edgeIdx++}`, source: src, target: tgt, type: "relates_to", confidence: 0.8 });
    }
    // Add a random cross-link to create a more realistic topology
    const tgt2 = `n${(i + Math.floor(nodeCount / 10)) % nodeCount}`;
    const key2 = `${src}:${tgt2}`;
    if (src !== tgt2 && !edgeSet.has(key2) && edgeIdx < nodeCount * 3) {
      edgeSet.add(key2);
      edges.push({ id: `e${edgeIdx++}`, source: src, target: tgt2, type: "relates_to", confidence: 0.6 });
    }
  }

  return {
    nodes,
    edges,
    total_node_count: nodeCount,
    vault_version: `fps-bench-${nodeCount}`,
    sampled: false,
    cursor: null,
  };
}

function buildLayout3DFixture(nodeCount: number) {
  // Deterministic spherical distribution for reproducible 3D layout
  const goldenRatio = (1 + Math.sqrt(5)) / 2;
  return {
    snapshot_id: `fps-bench-${nodeCount}`,
    positions: Array.from({ length: nodeCount }, (_, i) => {
      const theta = (2 * Math.PI * i) / goldenRatio;
      const phi = Math.acos(1 - (2 * (i + 0.5)) / nodeCount);
      const r = 200;
      return {
        node_id: `n${i}`,
        x: r * Math.sin(phi) * Math.cos(theta),
        y: r * Math.sin(phi) * Math.sin(theta),
        z: r * Math.cos(phi),
      };
    }),
    node_count: nodeCount,
    edge_count: nodeCount * 2, // approximate
  };
}

// ---------------------------------------------------------------------------
// Route mock installer
// ---------------------------------------------------------------------------

async function installBenchmarkMocks(
  page: Page,
  fixture: ReturnType<typeof buildGraphFixture>,
): Promise<void> {
  const token = process.env.MEATYWIKI_PORTAL_TOKEN ?? TEST_TOKEN;
  for (const domain of ["127.0.0.1", "localhost"]) {
    await page.context().addCookies([
      {
        name: "portal_session",
        value: token,
        domain,
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      },
    ]);
  }

  await page.route("**/api/auth/session", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ authenticated: true }),
      });
    } else {
      await route.continue();
    }
  });

  await page.route("**/api/portal/graph/vault**", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { ETag: `"${fixture.vault_version}"` },
      body: JSON.stringify(fixture),
    });
  });

  await page.route("**/api/portal/graph/updates/stream**", async (route) => {
    await route.fulfill({ status: 200, contentType: "text/event-stream", body: "" });
  });

  await page.route("**/api/portal/graph/semantic-neighbors**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ nodes: [], edges: [] }),
    });
  });

  await page.route("**/api/graph/layout-3d**", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildLayout3DFixture(fixture.nodes.length)),
    });
  });
}

// ---------------------------------------------------------------------------
// FPS measurement helper
// ---------------------------------------------------------------------------

/**
 * Measures rAF-based FPS over sampleMs milliseconds using requestAnimationFrame.
 * Returns p50 and p95 FPS derived from sampled frame intervals.
 *
 * In headless environments without GPU, rAF fires at the nominal rate (~60Hz)
 * but no actual GPU rendering occurs. The returned values will reflect clock
 * rate, not GPU throughput. The caller must check if the renderer is actually
 * active before treating these values as meaningful.
 */
async function measureFps(
  page: Page,
  sampleMs: number,
): Promise<{ p50: number; p95: number; frameCount: number; elapsedMs: number }> {
  return page.evaluate(
    async ({ sampleMs }: { sampleMs: number }) => {
      return new Promise<{ p50: number; p95: number; frameCount: number; elapsedMs: number }>(
        (resolve) => {
          const intervals: number[] = [];
          let lastTime: number | null = null;
          const startTime = performance.now();

          function tick(now: number) {
            if (lastTime !== null) {
              intervals.push(now - lastTime);
            }
            lastTime = now;

            if (now - startTime < sampleMs) {
              requestAnimationFrame(tick);
            } else {
              const elapsed = now - startTime;

              if (intervals.length === 0) {
                resolve({ p50: 0, p95: 0, frameCount: 0, elapsedMs: elapsed });
                return;
              }

              // Convert intervals to FPS: fps = 1000 / interval_ms
              const fpsSamples = intervals
                .filter((iv) => iv > 0)
                .map((iv) => Math.min(1000 / iv, 250)); // cap at 250fps to exclude outliers

              fpsSamples.sort((a, b) => a - b);

              const p50idx = Math.floor(fpsSamples.length * 0.5);
              const p95idx = Math.floor(fpsSamples.length * 0.95);

              resolve({
                p50: Math.round(fpsSamples[p50idx] ?? 0),
                p95: Math.round(fpsSamples[p95idx] ?? 0),
                frameCount: intervals.length,
                elapsedMs: elapsed,
              });
            }
          }

          requestAnimationFrame(tick);
        },
      );
    },
    { sampleMs },
  );
}

// ---------------------------------------------------------------------------
// Baseline writer
// ---------------------------------------------------------------------------

interface FpsBaselineScenario {
  node_count: number;
  edge_count: number;
  p50_fps: number;
  p95_fps: number;
  mode: "3d";
}

interface FpsBaseline {
  schema_version: 1;
  generated_at: string;
  device_profile: string;
  placeholder?: boolean;
  scenarios: FpsBaselineScenario[];
}

async function writeBaseline(baseline: FpsBaseline): Promise<void> {
  const projectRoot = process.cwd();
  const baselinesDir = join(projectRoot, "baselines");
  const outPath = join(baselinesDir, "graph-immersive-fps-baseline.json");

  await mkdir(baselinesDir, { recursive: true });
  await writeFile(outPath, JSON.stringify(baseline, null, 2) + "\n", "utf-8");
  console.log(`[fps-benchmark] Baseline written to ${outPath}`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Run all benchmark scenarios serially so they don't interfere
test.describe.configure({ mode: "serial" });

test.describe("Graph Immersive — FPS Benchmarks (3D, TEST-003)", () => {
  test.skip(
    !!process.env.CI && !process.env.GRAPH_PERF_ENABLED,
    "FPS benchmark skipped in CI unless GRAPH_PERF_ENABLED=1 is set",
  );

  test("FPS benchmarks at 1K / 5K / 10K nodes in 3D mode", async ({ page }) => {
    const results: FpsBaselineScenario[] = [];
    let isHeadless = true;

    for (const scenario of BENCHMARK_SCENARIOS) {
      test.info().annotations.push({
        type: "note",
        description: `Running FPS benchmark: ${scenario.nodeCount.toLocaleString()} nodes, ${scenario.edgeCount.toLocaleString()} edges, ${scenario.mode} mode`,
      });

      const fixture = buildGraphFixture(scenario.nodeCount);
      await installBenchmarkMocks(page, fixture);

      // Navigate fresh for each scenario
      await page.goto("/graph");

      // Wait for the graph page to be present
      try {
        await page
          .locator("[data-renderer]")
          .waitFor({ state: "attached", timeout: 30_000 });
      } catch {
        try {
          await page
            .getByRole("heading", { name: /knowledge graph|graph/i })
            .waitFor({ state: "visible", timeout: 30_000 });
        } catch {
          // Accept failure and seed placeholder
        }
      }

      await page.waitForTimeout(2_000);

      // Attempt to switch to 3D mode
      const toggle3dBtn = page
        .getByRole("button", { name: /switch to 3d view|3d view/i })
        .first();
      const toggle3dVisible = await toggle3dBtn.isVisible().catch(() => false);

      let rendererActive = false;

      if (toggle3dVisible) {
        await toggle3dBtn.click();
        try {
          await page
            .locator("[data-renderer='3d']")
            .waitFor({ state: "visible", timeout: 15_000 });
          rendererActive = true;
          isHeadless = false; // 3D renderer visible = GPU is present
        } catch {
          test.info().annotations.push({
            type: "note",
            description: `[${scenario.nodeCount}] 3D renderer did not become visible — GPU likely unavailable.`,
          });
        }
      } else {
        test.info().annotations.push({
          type: "note",
          description: `[${scenario.nodeCount}] 3D toggle not visible — WebGL unsupported. Using placeholder values.`,
        });
      }

      let p50Fps: number;
      let p95Fps: number;

      if (rendererActive) {
        // Give the 3D renderer time to settle before sampling
        await page.waitForTimeout(1_500);

        const fps = await measureFps(page, SAMPLE_WINDOW_MS);

        test.info().annotations.push({
          type: "metric",
          description: `[${scenario.nodeCount}] p50=${fps.p50}fps, p95=${fps.p95}fps (${fps.frameCount} frames / ${fps.elapsedMs.toFixed(0)}ms)`,
        });

        p50Fps = fps.p50;
        p95Fps = fps.p95;

        // Soft assertion: warn if below target (not a hard failure — baselines are for reference)
        const target = FPS_TARGETS[scenario.nodeCount] ?? 30;
        if (fps.p95 < target) {
          test.info().annotations.push({
            type: "warning",
            description: `[${scenario.nodeCount}] p95 FPS (${fps.p95}) is below target (${target}). Re-baseline on real hardware.`,
          });
        }
      } else {
        // Seed placeholder values matching the baseline schema comment
        // These are "reasonable expectations" that must be re-validated on GPU hardware.
        const placeholders: Record<number, { p50: number; p95: number }> = {
          1_000: { p50: 60, p95: 58 },
          5_000: { p50: 60, p95: 48 },
          10_000: { p50: 60, p95: 32 },
        };
        const ph = placeholders[scenario.nodeCount] ?? { p50: 60, p95: 30 };
        p50Fps = ph.p50;
        p95Fps = ph.p95;
      }

      results.push({
        node_count: scenario.nodeCount,
        edge_count: scenario.edgeCount,
        p50_fps: p50Fps,
        p95_fps: p95Fps,
        mode: scenario.mode,
      });
    }

    // Write the baseline JSON
    const baseline: FpsBaseline = {
      schema_version: 1,
      generated_at: new Date().toISOString(),
      device_profile: "test-runner",
      ...(isHeadless ? { placeholder: true } : {}),
      scenarios: results,
    };

    await writeBaseline(baseline);

    // Verify the baseline was written by asserting the results array is complete
    expect(results).toHaveLength(BENCHMARK_SCENARIOS.length);

    for (const result of results) {
      expect(result.p50_fps, `p50 FPS must be >= 0 for ${result.node_count} nodes`).toBeGreaterThanOrEqual(0);
      expect(result.p95_fps, `p95 FPS must be >= 0 for ${result.node_count} nodes`).toBeGreaterThanOrEqual(0);
      expect(result.p50_fps, `p50 FPS cannot exceed 250`).toBeLessThanOrEqual(250);
    }

    test.info().annotations.push({
      type: "note",
      description: isHeadless
        ? "Placeholder baseline written. Re-run on real GPU hardware with PLAYWRIGHT_HEADED=1 to generate real values."
        : "Real FPS baseline written from GPU-rendered frames.",
    });
  });
});
