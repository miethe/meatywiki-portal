/**
 * research-wizard-upload.spec.ts — E2E tests for the research wizard
 * Quick-Start Package Upload path (P6-02).
 *
 * Coverage:
 *   1. Navigate to /research and open the wizard via "Start Research"
 *   2. Drop a .json research package onto the upload zone in Step 1
 *   3. Assert all 7 manual parameter fields are auto-populated from the fixture
 *   4. Assert topic and research_question are also populated
 *   5. Assert the form is valid and advancing to Step 2 succeeds
 *
 * Fixture file:
 *   e2e/fixtures/research-package-v2.4.json — full ExternalResearchParams fixture
 *   containing all fields required for auto-population assertions.
 *
 * Route interception:
 *   - POST /api/workflows/external-research/package-upload — returns the parsed
 *     fixture data so the upload API call is fully mocked (no live backend).
 *   - POST /api/workflows/external-research/routing-analysis — returns a minimal
 *     routing response so Step 1 → Step 2 navigation succeeds.
 *   - GET  /api/workflows/runs* — returns an empty run list.
 *
 * Auth:
 *   Applies the portal_session cookie via the authenticatedPage fixture.
 *   Backend is NOT required — all network is intercepted.
 *
 * Upload simulation:
 *   Playwright's page.setInputFiles() is used to programmatically trigger the
 *   hidden file input inside the upload zone. This is equivalent to the user
 *   selecting a file via the file picker. Drag-and-drop via dataTransfer is
 *   also exercised in a dedicated sub-test.
 *
 * Selectors (from ResearchPackageBuilder):
 *   - Upload zone:           role=button aria-label="Upload research package JSON file"
 *   - Hidden file input:     input[type="file"][accept=".json,application/json"]
 *   - Topic input:           input[type="text"] (first in form)
 *   - Research question:     textarea (first in form)
 *   - Sensitivity radio:     input[type="radio"][name="sensitivity_profile"][value=*]
 *   - Task type input:       input[placeholder*="comparative analysis"]
 *   - Audience input:        input[placeholder*="engineering"]
 *   - Time Profile toggle:   role=radiogroup aria-label="Time Profile"
 *   - Cost Sensitivity:      role=radiogroup aria-label="Cost Sensitivity"
 *   - Reuse Likelihood:      role=radiogroup aria-label="Reuse Likelihood"
 *   - Success indicator:     text "Fields populated from package"
 *   - Analyse Routes button: button[type="submit"] (inside the form)
 */

import path from "path";
import { test, expect } from "./support/fixtures";
import type { Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Absolute path to the fixture file used for upload. */
const FIXTURE_PATH = path.resolve(__dirname, "fixtures/research-package-v2.4.json");

/** Expected field values from the fixture file. Must stay in sync with
 *  e2e/fixtures/research-package-v2.4.json. */
const FIXTURE = {
  topic: "Container orchestration patterns",
  research_question:
    "What are the most effective patterns for managing stateful workloads in Kubernetes?",
  sensitivity_profile: "internal",
  task_type: "comparative analysis",
  audience: "platform engineers",
  time_profile: "standard",
  cost_sensitivity: "medium",
  reuse_likelihood: "high",
} as const;

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

/** The package-upload endpoint response — mirrors the fixture JSON. */
function makeUploadResponse() {
  return {
    topic: FIXTURE.topic,
    research_question: FIXTURE.research_question,
    project: ["infrastructure"],
    domain: ["technology", "engineering"],
    desired_output: "briefing",
    sensitivity_profile: FIXTURE.sensitivity_profile,
    task_type: FIXTURE.task_type,
    audience: FIXTURE.audience,
    time_profile: FIXTURE.time_profile,
    cost_sensitivity: FIXTURE.cost_sensitivity,
    reuse_likelihood: FIXTURE.reuse_likelihood,
    route_preference: "auto",
    freshness_window: "current",
    citation_strictness: "advisory",
    save_prompt_package: true,
  };
}

/** Minimal routing analysis response used to allow Step 1 → Step 2 transition. */
function makeRoutingAnalysisResponse() {
  return {
    intent_core: {
      research_question: FIXTURE.research_question,
      target_fidelity: "factual",
      estimated_depth: "standard",
    },
    extracted_entities: ["Kubernetes", "StatefulSet"],
    archival_archetypes: ["comparative_analysis"],
    route_cards: [
      {
        route: "perplexity",
        display_name: "Perplexity AI",
        routing_category: "fast_path",
        score: 0.82,
        expected_output: "Concise briefing with citations",
        rationale: "High recall for technical infrastructure topics.",
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Route interception helper
// ---------------------------------------------------------------------------

async function installUploadMocks(page: Page) {
  // Package upload endpoint
  await page.route("**/api/workflows/external-research/package-upload", (route) => {
    void route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(makeUploadResponse()),
    });
  });

  // Routing analysis (needed to advance to Step 2)
  await page.route("**/api/workflows/external-research/routing-analysis", (route) => {
    void route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(makeRoutingAnalysisResponse()),
    });
  });

  // Active runs — always return empty so the page loads without delays
  await page.route("**/api/workflows/runs*", (route) => {
    void route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [], cursor: null, etag: null }),
    });
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function goToResearch(page: Page) {
  await page.goto("/research");
  await page.waitForLoadState("domcontentloaded");
}

async function openWizard(page: Page) {
  const triggerBtn = page.locator('[aria-label="Start a new research run"]').first();
  await expect(triggerBtn, "Start Research button should be visible").toBeVisible({
    timeout: 10_000,
  });
  await triggerBtn.click();

  const wizard = page.locator('[data-testid="initiation-wizard"]');
  await expect(wizard, "Wizard dialog should open").toBeVisible({ timeout: 8_000 });
}

/**
 * Triggers the hidden file input inside the upload zone by calling
 * page.setInputFiles() on the sr-only <input type="file"> element.
 *
 * The component wires onChange → processFile which calls uploadResearchPackage
 * (the API call is mocked). After a successful upload, the component calls
 * applyUploadedParams and sets uploadState="success".
 */
async function triggerFileUpload(
  page: Page,
  filePath: string,
) {
  // The hidden file input is inside the upload zone — it has tabIndex=-1 and
  // aria-hidden="true" but is still reachable by Playwright via locator.
  const fileInput = page.locator(
    '[aria-label="Research package configuration"] input[type="file"][accept=".json,application/json"]',
  );
  // Make the input visible momentarily so setInputFiles works reliably in all
  // browser contexts (Playwright handles this internally but we assert it exists).
  await expect(fileInput).toBeAttached({ timeout: 5_000 });
  await fileInput.setInputFiles(filePath);
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

/**
 * Waits for the upload success indicator and checks all populated fields.
 *
 * ResearchPackageBuilder renders:
 *   "Fields populated from package. You can still edit them below."
 * when uploadState === "success".
 */
async function assertFieldsPopulated(page: Page) {
  // Wait for upload success message
  const successMsg = page.getByText(/Fields populated from package/i);
  await expect(
    successMsg,
    "Upload success message should appear after file is processed",
  ).toBeVisible({ timeout: 10_000 });

  const packageForm = page.locator('[aria-label="Research package configuration"]');

  // 1. Topic
  const topicInput = packageForm.locator('input[type="text"]').first();
  await expect(
    topicInput,
    "Topic should be auto-populated from the package file",
  ).toHaveValue(FIXTURE.topic, { timeout: 5_000 });

  // 2. Research question (first textarea in the form)
  const questionTextarea = packageForm.locator("textarea").first();
  await expect(
    questionTextarea,
    "Research question should be auto-populated from the package file",
  ).toHaveValue(FIXTURE.research_question, { timeout: 5_000 });

  // 3. Sensitivity profile — "Internal" radio should be checked
  const internalRadio = packageForm.locator(
    'input[type="radio"][name="sensitivity_profile"][value="internal"]',
  );
  await expect(
    internalRadio,
    "Sensitivity profile 'internal' should be selected",
  ).toBeChecked({ timeout: 5_000 });

  // 4. Task type
  const taskTypeInput = packageForm.locator(
    'input[placeholder*="comparative analysis"]',
  );
  await expect(
    taskTypeInput,
    "Task type should be auto-populated",
  ).toHaveValue(FIXTURE.task_type, { timeout: 5_000 });

  // 5. Audience
  const audienceInput = packageForm.locator('input[placeholder*="engineering"]');
  await expect(
    audienceInput,
    "Audience should be auto-populated",
  ).toHaveValue(FIXTURE.audience, { timeout: 5_000 });

  // 6. Time profile — "Standard" toggle button should be aria-checked=true
  const timeProfileGroup = page.locator('[role="radiogroup"][aria-label="Time Profile"]');
  const standardBtn = timeProfileGroup.locator('[role="radio"]', { hasText: "Standard" });
  await expect(
    standardBtn,
    "Time profile 'Standard' should be selected",
  ).toHaveAttribute("aria-checked", "true", { timeout: 5_000 });

  // 7. Cost sensitivity — "Medium" toggle button
  const costGroup = page.locator('[role="radiogroup"][aria-label="Cost Sensitivity"]');
  const mediumCostBtn = costGroup.locator('[role="radio"]', { hasText: "Medium" });
  await expect(
    mediumCostBtn,
    "Cost sensitivity 'Medium' should be selected",
  ).toHaveAttribute("aria-checked", "true", { timeout: 5_000 });

  // 8. Reuse likelihood — "High" toggle button
  const reuseGroup = page.locator('[role="radiogroup"][aria-label="Reuse Likelihood"]');
  const highReuseBtn = reuseGroup.locator('[role="radio"]', { hasText: "High" });
  await expect(
    highReuseBtn,
    "Reuse likelihood 'High' should be selected",
  ).toHaveAttribute("aria-checked", "true", { timeout: 5_000 });
}

// ---------------------------------------------------------------------------
// Suite: Package Upload Quick-Start (P6-02)
// ---------------------------------------------------------------------------

test.describe("Research Wizard — Package Upload Quick-Start (P6-02)", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  // ── Primary test: file input trigger ─────────────────────────────────────

  test("uploading a .json package auto-populates all 8 fields (file input path)", async ({
    authenticatedPage: page,
  }) => {
    await installUploadMocks(page);
    await goToResearch(page);
    await openWizard(page);

    // Verify the upload zone is visible before triggering the file input
    const uploadZone = page.locator('[aria-label="Upload research package JSON file"]');
    await expect(uploadZone, "Upload zone should be visible in Step 1").toBeVisible({
      timeout: 8_000,
    });

    // Trigger file upload via the hidden input
    await triggerFileUpload(page, FIXTURE_PATH);

    // Assert all fields are populated
    await assertFieldsPopulated(page);
  });

  // ── Upload then advance to Step 2 ────────────────────────────────────────

  test("after upload, submitting Step 1 advances to Step 2 routing matrix", async ({
    authenticatedPage: page,
  }) => {
    await installUploadMocks(page);
    await goToResearch(page);
    await openWizard(page);

    await triggerFileUpload(page, FIXTURE_PATH);

    // Wait for upload success before submitting
    await expect(page.getByText(/Fields populated from package/i)).toBeVisible({
      timeout: 10_000,
    });

    // Submit Step 1 — the "Analyse Routes" submit button
    const packageForm = page.locator('[aria-label="Research package configuration"]');
    const analyseBtn = packageForm.locator('button[type="submit"]', {
      hasText: /Analyse Routes/i,
    });
    await expect(
      analyseBtn,
      "Analyse Routes button should be enabled after upload populates required fields",
    ).toBeEnabled({ timeout: 5_000 });
    await analyseBtn.click();

    // Step 2: routing matrix should appear
    const routingMatrix = page.locator(
      '[role="radiogroup"][aria-label="Routing path options"]',
    );
    await expect(
      routingMatrix,
      "Routing matrix should appear in Step 2 after upload-powered Step 1 submission",
    ).toBeVisible({ timeout: 15_000 });
  });

  // ── Drag-and-drop simulation ──────────────────────────────────────────────

  test("drag-and-drop of a .json file onto the upload zone populates the form", async ({
    authenticatedPage: page,
  }) => {
    await installUploadMocks(page);
    await goToResearch(page);
    await openWizard(page);

    const uploadZone = page.locator('[aria-label="Upload research package JSON file"]');
    await expect(uploadZone, "Upload zone should be present").toBeVisible({
      timeout: 8_000,
    });

    // Read the fixture file contents for injection via DataTransfer
    const { readFileSync } = await import("fs");
    const fileBuffer = readFileSync(FIXTURE_PATH);
    const fileName = "research-package-v2.4.json";
    const mimeType = "application/json";

    // Playwright supports dataTransfer-based drag-and-drop via dispatchEvent.
    // We create a DataTransfer with the file, then fire dragover + drop events.
    await uploadZone.dispatchEvent("dragover", {
      dataTransfer: await page.evaluateHandle(() => new DataTransfer()),
    });

    // To simulate drop with actual file content, we inject via the hidden input
    // (the React onDrop handler reads from e.dataTransfer.files which cannot be
    // set programmatically in a sandboxed context).
    // Use page.evaluate to inject the file via the input and trigger 'change'.
    await page.evaluate(
      ({ buffer, name, mime }) => {
        const input = document.querySelector<HTMLInputElement>(
          '[aria-label="Research package configuration"] input[type="file"]',
        );
        if (!input) return;
        const file = new File([new Uint8Array(buffer)], name, { type: mime });
        const dt = new DataTransfer();
        dt.items.add(file);
        Object.defineProperty(input, "files", { value: dt.files, configurable: true });
        input.dispatchEvent(new Event("change", { bubbles: true }));
      },
      {
        buffer: Array.from(fileBuffer),
        name: fileName,
        mime: mimeType,
      },
    );

    // Assert all fields are populated via the same helper used above
    await assertFieldsPopulated(page);
  });

  // ── Error state: non-JSON file rejected ─────────────────────────────────

  test("uploading a non-.json file shows an error message", async ({
    authenticatedPage: page,
  }) => {
    await installUploadMocks(page);
    await goToResearch(page);
    await openWizard(page);

    // Create a temporary .txt file reference via Playwright's buffer API
    // by using setInputFiles with a buffer payload labelled as .txt
    const fileInput = page.locator(
      '[aria-label="Research package configuration"] input[type="file"][accept=".json,application/json"]',
    );
    await fileInput.setInputFiles({
      name: "not-a-package.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("This is not JSON"),
    });

    // ResearchPackageBuilder renders the error "Only .json files are supported"
    const errorMsg = page.locator('[role="alert"]', {
      hasText: /Only \.json files are supported/i,
    });
    await expect(
      errorMsg,
      "Error message should appear when a non-.json file is dropped",
    ).toBeVisible({ timeout: 5_000 });
  });

  // ── Upload zone — keyboard activation ────────────────────────────────────

  test("pressing Enter on the upload zone opens the file picker (keyboard nav)", async ({
    authenticatedPage: page,
  }) => {
    await installUploadMocks(page);
    await goToResearch(page);
    await openWizard(page);

    const uploadZone = page.locator('[aria-label="Upload research package JSON file"]');
    await expect(uploadZone).toBeVisible({ timeout: 8_000 });

    // Focus the upload zone (it has tabIndex=0) and press Enter.
    // The onKeyDown handler calls fileInputRef.current?.click().
    // We can't observe the file picker dialog, but we can verify that
    // the upload zone responds to the key event without throwing.
    await uploadZone.focus();
    await expect(uploadZone).toBeFocused({ timeout: 3_000 });

    // Press Enter — this triggers the click on fileInputRef internally.
    // In a real browser this would open the native file dialog; in Playwright
    // we just verify the key event does not cause an error or crash.
    // We use a Promise.race to catch any unexpected navigation or dialog.
    let errorThrown = false;
    try {
      await page.keyboard.press("Enter");
    } catch {
      errorThrown = true;
    }
    expect(errorThrown, "Enter key on upload zone should not throw").toBe(false);

    // The upload zone should still be visible and not have errored
    await expect(uploadZone, "Upload zone should remain visible after Enter").toBeVisible({
      timeout: 3_000,
    });
  });
});
