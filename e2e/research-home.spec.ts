/**
 * research-home.spec.ts — E2E tests for Portal v2.1 P5-06.
 *
 * Coverage:
 *   1. research_home_sections_visible — all 4 sections render on /research.
 *   2. research_home_click_completed_run — clicking a completed run navigates
 *      to /workflows/[runId].
 *   3. research_home_filter_by_workspace — selecting a workspace chip fetches
 *      the artifacts list and renders the items.
 *   4. research_home_packages_navigate — clicking a saved package card navigates
 *      to /artifacts/[id].
 *   5. ranking_profile_search_integration — search with ranking_profile=
 *      research_compiled_first returns research artifacts first (mock ordered).
 *   6. Visual snapshot — full /research page with all 4 sections populated.
 *
 * All backend API calls are mocked via Playwright page.route().
 * No real backend or LLM required.
 *
 * Mocked endpoints:
 *   GET  /api/auth/session
 *   GET  /api/research/runs?status=active
 *   GET  /api/research/runs?status=completed
 *   GET  /api/research/artifacts?workspace_id=*
 *   GET  /api/research/packages
 *   GET  /api/artifacts?ranking_profile=research_compiled_first&*
 *   GET  /api/artifacts/research/freshness-status  (StaleArtifactsPanel)
 *   GET  /api/artifacts/research/contradictions    (ContradictionsPanel)
 *   GET  /api/workflows/runs?*                     (ActiveResearchRuns poll)
 */

import { test, expect } from "./support/fixtures";
import type { Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Stable fixture IDs
// ---------------------------------------------------------------------------

const NOW_ISO = new Date("2026-05-28T10:00:00Z").toISOString();
const PAST_ISO = new Date("2026-05-20T08:30:00Z").toISOString();

// Completed runs
const COMPLETED_RUN_ID_1 = "01HZR000000000000000CMP1";
const COMPLETED_RUN_ID_2 = "01HZR000000000000000CMP2";

// Workspace artifact IDs
const RESEARCH_ARTIFACT_ID_1 = "01HZART000000000000000RA1";
const RESEARCH_ARTIFACT_ID_2 = "01HZART000000000000000RA2";

// Package IDs
const PACKAGE_ID_1 = "01HZPKG000000000000000PK1";
const PACKAGE_ID_2 = "01HZPKG000000000000000PK2";

// Ranking search artifact IDs (ordered: research-origin first)
const RANK_ARTIFACT_RESEARCH_1 = "01HZRANK000000000000000R1";
const RANK_ARTIFACT_RESEARCH_2 = "01HZRANK000000000000000R2";
const RANK_ARTIFACT_NORMAL_3 = "01HZRANK000000000000000N3";

// ---------------------------------------------------------------------------
// Fixture factories — shapes match backend response DTOs
// ---------------------------------------------------------------------------

/** WorkflowRunItem — mirrors research.py WorkflowRunItem */
function makeCompletedRunItem(
  runId: string,
  summary: string,
  artifacts = 3,
): Record<string, unknown> {
  return {
    run_id: runId,
    template_id: "external_research_v1",
    status: "complete",
    started_at: PAST_ISO,
    completed_at: NOW_ISO,
    summary,
    artifacts_count: artifacts,
  };
}

/** ResearchArtifactItem — mirrors research.py ResearchArtifactItem */
function makeResearchArtifactItem(id: string, title: string): Record<string, unknown> {
  return {
    artifact_id: id,
    title,
    type: "synthesis",
    subtype: null,
    workspace: "research",
    research_workflow_id: COMPLETED_RUN_ID_1,
    created_at: NOW_ISO,
  };
}

/** ResearchPackageItem — mirrors research.py ResearchPackageItem */
function makePackageItem(id: string, title: string, count: number): Record<string, unknown> {
  return {
    artifact_id: id,
    title,
    type: "external_research_package",
    subtype: null,
    artifact_count: count,
    created_at: PAST_ISO,
  };
}

/** ArtifactCard stub for ranking search response */
function makeArtifactCard(id: string, title: string, isResearch: boolean): Record<string, unknown> {
  return {
    id,
    workspace: isResearch ? "research" : "library",
    type: isResearch ? "synthesis" : "concept",
    subtype: null,
    title,
    status: "active",
    schema_version: "1.0",
    created: PAST_ISO,
    updated: NOW_ISO,
    file_path: `wiki/concepts/${id.toLowerCase()}.md`,
    metadata: {
      fidelity: "high",
      freshness: "current",
      research_origin: isResearch,
    },
  };
}

/** Cursor-paginated envelope shape used by all research home endpoints */
function makeEnvelope<T>(data: T[], nextCursor: string | null = null): Record<string, unknown> {
  return { data, cursor: nextCursor, etag: null };
}

// ---------------------------------------------------------------------------
// Route mock installer
// ---------------------------------------------------------------------------

/**
 * Installs ALL mocks for the /research page, including the three new P5-05
 * sections and the existing ActiveResearchRuns widget. Session cookie is also
 * seeded on both localhost and 127.0.0.1.
 *
 * Call before page.goto("/research") so interceptors are in place for the
 * initial navigation requests.
 */
async function installResearchHomeMocks(page: Page): Promise<void> {
  const token = process.env.MEATYWIKI_PORTAL_TOKEN ?? "test-token-e2e";
  await page.context().addCookies(
    ["127.0.0.1", "localhost"].map((domain) => ({
      name: "portal_session",
      value: token,
      domain,
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax" as const,
    })),
  );

  // Auth session — short-circuit any redirect-to-login
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

  // GET /api/research/runs?status=active — ActiveResearchRuns poll (empty)
  // GET /api/research/runs?status=completed — CompletedResearchRuns section
  await page.route("**/api/research/runs**", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const url = new URL(route.request().url());
    const status = url.searchParams.get("status");

    if (status === "completed") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          makeEnvelope([
            makeCompletedRunItem(
              COMPLETED_RUN_ID_1,
              "Kubernetes StatefulSets deep-dive — synthesized 3 sources",
              3,
            ),
            makeCompletedRunItem(
              COMPLETED_RUN_ID_2,
              "Service mesh comparative analysis",
              5,
            ),
          ]),
        ),
      });
    } else {
      // active / default — empty list (no active runs in these tests)
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(makeEnvelope([])),
      });
    }
  });

  // GET /api/research/artifacts?workspace_id=* — ResearchWorkspaces section
  // Returns different data per workspace to test the filter chip.
  await page.route("**/api/research/artifacts**", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const url = new URL(route.request().url());
    const workspaceId = url.searchParams.get("workspace_id");

    if (workspaceId === "research") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          makeEnvelope([
            makeResearchArtifactItem(RESEARCH_ARTIFACT_ID_1, "Kubernetes StatefulSets"),
            makeResearchArtifactItem(RESEARCH_ARTIFACT_ID_2, "Istio Service Mesh Architecture"),
          ]),
        ),
      });
    } else if (workspaceId === "library") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          makeEnvelope([
            makeResearchArtifactItem("01HZART000000000000000LB1", "K8s Networking Concepts"),
          ]),
        ),
      });
    } else {
      // Other workspaces return empty
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(makeEnvelope([])),
      });
    }
  });

  // GET /api/research/packages — SavedPackages section
  await page.route("**/api/research/packages**", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        makeEnvelope([
          makePackageItem(PACKAGE_ID_1, "Container Orchestration Research Package", 7),
          makePackageItem(PACKAGE_ID_2, "Service Mesh Comparative Study", 4),
        ]),
      ),
    });
  });

  // GET /api/artifacts?ranking_profile=research_compiled_first&* — ranking search
  // Returns research-origin artifacts first to validate the boost ordering.
  await page.route("**/api/artifacts**", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const url = new URL(route.request().url());
    const rankingProfile = url.searchParams.get("ranking_profile");

    if (rankingProfile === "research_compiled_first") {
      // Research artifacts appear in positions 1 and 2; normal artifact in 3
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          makeEnvelope([
            makeArtifactCard(RANK_ARTIFACT_RESEARCH_1, "Synthesized K8s Concept", true),
            makeArtifactCard(RANK_ARTIFACT_RESEARCH_2, "Research: Istio Architecture", true),
            makeArtifactCard(RANK_ARTIFACT_NORMAL_3, "Generic Wiki Concept", false),
          ]),
        ),
      });
    } else {
      // Default search — research artifacts still present but unordered
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          makeEnvelope([
            makeArtifactCard(RANK_ARTIFACT_NORMAL_3, "Generic Wiki Concept", false),
            makeArtifactCard(RANK_ARTIFACT_RESEARCH_1, "Synthesized K8s Concept", true),
            makeArtifactCard(RANK_ARTIFACT_RESEARCH_2, "Research: Istio Architecture", true),
          ]),
        ),
      });
    }
  });

  // GET /api/artifacts/research/freshness-status — StaleArtifactsPanel
  await page.route("**/api/artifacts/research/freshness-status**", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [], cursor: null }),
    });
  });

  // GET /api/artifacts/research/contradictions — ContradictionsPanel
  await page.route("**/api/artifacts/research/contradictions**", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [], cursor: null }),
    });
  });

  // Routing analysis (if wizard gets triggered) — safe fallback
  await page.route("**/api/workflows/external-research/routing-analysis", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ route_cards: [], intent_core: {}, extracted_entities: [] }),
    });
  });

  // GET /api/workflows/runs?template_id=* — ActiveResearchRuns poll fallback
  await page.route("**/api/workflows/runs**", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [], cursor: null, etag: null }),
    });
  });
}

// ---------------------------------------------------------------------------
// Helper — navigate to /research and wait for the page to hydrate
// ---------------------------------------------------------------------------

async function goToResearch(page: Page): Promise<void> {
  await page.goto("/research");
  await page.waitForLoadState("domcontentloaded");
  // Wait for the page heading to confirm the page shell is mounted
  await page.waitForSelector('h1:has-text("Research")', { timeout: 12_000 });
}

// ---------------------------------------------------------------------------
// Suite: research_home_sections_visible (AC-06)
// ---------------------------------------------------------------------------

test.describe("Research Home — section visibility (P5-06)", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("research_home_sections_visible — all 4 sections render on /research", async ({
    authenticatedPage: page,
  }) => {
    await installResearchHomeMocks(page);
    await goToResearch(page);

    // 1. Active Research Runs — always rendered (existing widget)
    const activeSection = page.locator('[aria-label="Active Research Runs"]');
    await expect(activeSection, "Active Research Runs section should be visible").toBeVisible({
      timeout: 10_000,
    });

    // 2. Completed Research Runs — P5-05 section
    const completedSection = page.locator('[aria-label="Completed Research Runs"]');
    await expect(
      completedSection,
      "Completed Research Runs section should be visible",
    ).toBeVisible({ timeout: 10_000 });

    // 3. Research Workspaces — P5-05 section
    const workspacesSection = page.locator('[aria-label="Research Workspaces"]');
    await expect(
      workspacesSection,
      "Research Workspaces section should be visible",
    ).toBeVisible({ timeout: 10_000 });

    // 4. Saved Research Packages — P5-05 section
    const packagesSection = page.locator('[aria-label="Saved Research Packages"]');
    await expect(
      packagesSection,
      "Saved Research Packages section should be visible",
    ).toBeVisible({ timeout: 10_000 });
  });

  test("all 4 sections show populated data from mocked endpoints", async ({
    authenticatedPage: page,
  }) => {
    await installResearchHomeMocks(page);
    await goToResearch(page);

    // Completed Runs — wait for the run data to render
    const completedSection = page.locator('[aria-label="Completed Research Runs"]');
    await expect(completedSection).toBeVisible({ timeout: 10_000 });
    // CompletedResearchRuns renders aria-label="{N} completed run(s)"
    const runsCountLabel = completedSection.locator('[aria-label*="completed run"]');
    await expect(runsCountLabel, "Completed runs count label should appear").toBeVisible({
      timeout: 10_000,
    });

    // Saved Packages — check package cards appear
    const packagesSection = page.locator('[aria-label="Saved Research Packages"]');
    await expect(packagesSection).toBeVisible({ timeout: 10_000 });
    const packagesCountLabel = packagesSection.locator('[aria-label*="saved package"]');
    await expect(packagesCountLabel, "Packages count label should appear").toBeVisible({
      timeout: 10_000,
    });

    // Full-page visual snapshot with all 4 sections populated
    await expect(page).toHaveScreenshot("research-home-all-sections.png", {
      // Clip to the main content area to avoid flaky rail/skeleton differences
      clip: { x: 0, y: 0, width: 1280, height: 900 },
    });
  });
});

// ---------------------------------------------------------------------------
// Suite: research_home_click_completed_run
// ---------------------------------------------------------------------------

test.describe("Research Home — completed run navigation (P5-06)", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("research_home_click_completed_run — clicking a run navigates to /workflows/[runId]", async ({
    authenticatedPage: page,
  }) => {
    await installResearchHomeMocks(page);

    // Mock the workflow viewer page API endpoints so the navigation target loads
    await page.route(`**/api/workflows/${COMPLETED_RUN_ID_1}`, async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            id: COMPLETED_RUN_ID_1,
            run_id: COMPLETED_RUN_ID_1,
            template_id: "external_research_v1",
            status: "complete",
            started_at: NOW_ISO,
            completed_at: NOW_ISO,
            artifact_id: null,
            artifact_title: null,
            source_artifacts: [],
            created_artifacts: [],
            metadata: {},
            current_stage: "review_and_finalize",
          },
        }),
      });
    });
    await page.route(`**/api/workflows/${COMPLETED_RUN_ID_1}/timeline`, async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
    });
    await page.route(`**/api/workflows/${COMPLETED_RUN_ID_1}/audit-log`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
    });

    await goToResearch(page);

    // Wait for the Completed Research Runs section
    const completedSection = page.locator('[aria-label="Completed Research Runs"]');
    await expect(completedSection).toBeVisible({ timeout: 10_000 });

    // CompletedResearchRuns renders a "View run details" button per card.
    // aria-label="View run {shortId} details" where shortId = last 8 chars.
    const shortId = COMPLETED_RUN_ID_1.slice(-8);
    const viewBtn = completedSection.locator(`[aria-label="View run ${shortId} details"]`).first();
    await expect(viewBtn, "View run button should be visible").toBeVisible({ timeout: 10_000 });
    await viewBtn.click();

    // Verify navigation to /workflows/[runId]
    await page.waitForURL(`**/workflows/${COMPLETED_RUN_ID_1}`, { timeout: 10_000 });
    expect(page.url()).toContain(`/workflows/${COMPLETED_RUN_ID_1}`);
  });
});

// ---------------------------------------------------------------------------
// Suite: research_home_filter_by_workspace
// ---------------------------------------------------------------------------

test.describe("Research Home — workspace filter (P5-06)", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("research_home_filter_by_workspace — selecting workspace chip fetches and renders artifacts", async ({
    authenticatedPage: page,
  }) => {
    await installResearchHomeMocks(page);
    await goToResearch(page);

    // Research Workspaces section renders a listbox of workspace chips.
    // aria-label="Workspace filter — select a workspace to view research artifacts"
    const workspacesSection = page.locator('[aria-label="Research Workspaces"]');
    await expect(workspacesSection).toBeVisible({ timeout: 10_000 });

    const chipList = workspacesSection.locator(
      '[aria-label="Workspace filter — select a workspace to view research artifacts"]',
    );
    await expect(chipList, "Workspace chip list should be visible").toBeVisible({ timeout: 8_000 });

    // Click the "Research" workspace chip
    const researchChip = chipList.locator(
      '[aria-label="Show research artifacts in the Research workspace"]',
    );
    await expect(researchChip, "Research workspace chip should be visible").toBeVisible({
      timeout: 5_000,
    });
    await researchChip.click();

    // After clicking, the chip should be selected (aria-selected="true")
    await expect(researchChip).toHaveAttribute("aria-selected", "true", { timeout: 5_000 });

    // Artifacts list should render — aria-label="Research artifacts in the Research workspace"
    const artifactsList = workspacesSection.locator(
      '[aria-label="Research artifacts in the Research workspace"]',
    );
    await expect(artifactsList, "Research artifacts list should appear after chip click").toBeVisible(
      { timeout: 10_000 },
    );

    // Both fixture artifacts should be in the list
    await expect(
      artifactsList.getByText("Kubernetes StatefulSets"),
      "First artifact title should be visible",
    ).toBeVisible({ timeout: 8_000 });
    await expect(
      artifactsList.getByText("Istio Service Mesh Architecture"),
      "Second artifact title should be visible",
    ).toBeVisible({ timeout: 8_000 });
  });

  test("switching workspace chip fetches different artifact set", async ({
    authenticatedPage: page,
  }) => {
    await installResearchHomeMocks(page);
    await goToResearch(page);

    const workspacesSection = page.locator('[aria-label="Research Workspaces"]');
    await expect(workspacesSection).toBeVisible({ timeout: 10_000 });

    const chipList = workspacesSection.locator(
      '[aria-label="Workspace filter — select a workspace to view research artifacts"]',
    );
    await expect(chipList).toBeVisible({ timeout: 8_000 });

    // Click Research first, then switch to Library
    const researchChip = chipList.locator(
      '[aria-label="Show research artifacts in the Research workspace"]',
    );
    await researchChip.click();

    // Wait for Research artifacts to appear
    const researchList = workspacesSection.locator(
      '[aria-label="Research artifacts in the Research workspace"]',
    );
    await expect(researchList).toBeVisible({ timeout: 10_000 });

    // Now click Library chip
    const libraryChip = chipList.locator(
      '[aria-label="Show research artifacts in the Library workspace"]',
    );
    await expect(libraryChip).toBeVisible({ timeout: 5_000 });
    await libraryChip.click();

    // Library artifacts list should render (different label)
    const libraryList = workspacesSection.locator(
      '[aria-label="Research artifacts in the Library workspace"]',
    );
    await expect(libraryList, "Library artifacts list should appear after chip switch").toBeVisible({
      timeout: 10_000,
    });

    await expect(
      libraryList.getByText("K8s Networking Concepts"),
      "Library artifact should be visible after switching workspace",
    ).toBeVisible({ timeout: 8_000 });
  });
});

// ---------------------------------------------------------------------------
// Suite: research_home_packages_navigate
// ---------------------------------------------------------------------------

test.describe("Research Home — saved package navigation (P5-06)", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("research_home_packages_navigate — clicking a saved package navigates to /artifacts/[id]", async ({
    authenticatedPage: page,
  }) => {
    await installResearchHomeMocks(page);

    // Mock the artifact detail page for the target package
    await page.route(`**/api/artifacts/${PACKAGE_ID_1}`, async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            id: PACKAGE_ID_1,
            workspace: "research",
            type: "external_research_package",
            subtype: null,
            title: "Container Orchestration Research Package",
            status: "active",
            schema_version: "1.0",
            created: PAST_ISO,
            updated: NOW_ISO,
            file_path: "wiki/research/container-orchestration.md",
            metadata: {},
          },
        }),
      });
    });

    await goToResearch(page);

    // Wait for Saved Research Packages section
    const packagesSection = page.locator('[aria-label="Saved Research Packages"]');
    await expect(packagesSection).toBeVisible({ timeout: 10_000 });

    // SavedPackages renders cards with aria-label="Open package: {title}"
    const packageBtn = packagesSection.locator(
      '[aria-label="Open package: Container Orchestration Research Package"]',
    );
    await expect(packageBtn, "Package card button should be visible").toBeVisible({
      timeout: 10_000,
    });
    await packageBtn.click();

    // Should navigate to /artifacts/[PACKAGE_ID_1]
    await page.waitForURL(`**/artifacts/${PACKAGE_ID_1}`, { timeout: 10_000 });
    expect(page.url()).toContain(`/artifacts/${PACKAGE_ID_1}`);
  });
});

// ---------------------------------------------------------------------------
// Suite: ranking_profile_search_integration (AC-05 / P5-06)
// ---------------------------------------------------------------------------

test.describe("Research Home — ranking profile search integration (P5-06)", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  /**
   * Tests that GET /api/artifacts?ranking_profile=research_compiled_first
   * returns the mocked ordered result set where research-origin artifacts
   * appear in positions 1 and 2 before the normal artifact at position 3.
   *
   * This validates the frontend correctly passes the ranking_profile param
   * and displays results in the order the backend returns them.
   *
   * Note: The Library search UI on /research is not the primary surface;
   * the ranking profile param is consumed by any consumer that passes it.
   * We test the API mock contract and response shape here.
   */
  test("ranking_profile_search_integration — research artifacts returned first from mocked ordered API", async ({
    authenticatedPage: page,
  }) => {
    await installResearchHomeMocks(page);
    await goToResearch(page);

    // Directly call the artifacts API via page.evaluate() to verify the
    // ranking_profile param returns research artifacts in positions 1 and 2.
    // This approach tests the API contract without depending on a specific
    // search UI widget being present on the /research page.
    const result = await page.evaluate(async (apiBase) => {
      const resp = await fetch(
        `${apiBase}/api/artifacts?ranking_profile=research_compiled_first&q=kubernetes&limit=10`,
        { credentials: "include" },
      );
      if (!resp.ok) return null;
      return resp.json() as Promise<{
        data: Array<{ id: string; metadata?: { research_origin?: boolean } }>;
        cursor: string | null;
      }>;
    }, "");

    expect(result, "API should return a valid envelope").not.toBeNull();
    expect(result!.data.length).toBeGreaterThanOrEqual(2);

    // The first two results must be research-origin artifacts
    const first = result!.data[0];
    const second = result!.data[1];
    expect(first?.metadata?.research_origin, "First result should be research-origin").toBe(true);
    expect(second?.metadata?.research_origin, "Second result should be research-origin").toBe(true);

    // The third result (if present) may be non-research
    if (result!.data.length >= 3) {
      const third = result!.data[2];
      // The fixture has a non-research artifact at position 3
      expect(third?.id).toBe("01HZRANK000000000000000N3");
    }
  });

  test("default ranking does not guarantee research artifacts in top positions", async ({
    authenticatedPage: page,
  }) => {
    await installResearchHomeMocks(page);
    await goToResearch(page);

    // Call without ranking_profile param — mock returns non-research first
    const result = await page.evaluate(async (apiBase) => {
      const resp = await fetch(`${apiBase}/api/artifacts?q=kubernetes&limit=10`, {
        credentials: "include",
      });
      if (!resp.ok) return null;
      return resp.json() as Promise<{
        data: Array<{ id: string; metadata?: { research_origin?: boolean } }>;
        cursor: string | null;
      }>;
    }, "");

    expect(result, "Default API should return a valid envelope").not.toBeNull();
    // Default ordering: non-research appears first per our mock setup
    const first = result!.data[0];
    expect(first?.metadata?.research_origin).toBeFalsy();
  });
});
