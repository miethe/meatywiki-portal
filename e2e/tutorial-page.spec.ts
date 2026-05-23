/**
 * tutorial-page.spec.ts — Interactive E2E tests for the /tutorial page (P3-09).
 *
 * Extends the static checks in tutorial-page-static.spec.ts with tests that
 * exercise tour state, CompletionBadge visibility, the reset flow, and nav
 * anchor scrolling.
 *
 * Coverage:
 *   - 8 FlowCards render with correct titles (desktop + mobile)
 *   - TutorialNav sticky sidebar renders with anchor links (desktop only)
 *   - Nav anchor click scrolls the matching card into view
 *   - "Open page" deep-link buttons navigate to the correct routes
 *   - "Start tour" button is enabled for cards with a tourId
 *   - "Start tour" button is disabled for the projects-workspace card (tourId null)
 *   - CompletionBadge appears on a card after seeding completed tour state
 *   - "Reset tutorial state" button clears all completion badges and shows toast
 *   - axe-clean accessibility check (desktop + mobile)
 *
 * Mocking strategy:
 *   The tutorial page is fully static — it renders FLOW_CARDS with no backend
 *   calls. The portal_session cookie is set so the layout shell does not
 *   redirect to /login. No API routes are intercepted.
 *
 * Viewports:
 *   Desktop: 1280×800  (lg breakpoint — TutorialNav visible)
 *   Mobile:  390×844   (iPhone 12 — TutorialNav hidden, single-column grid)
 */

import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type Page } from "@playwright/test";
import {
  clearAllTourState,
  seedTourCompleted,
} from "./fixtures/tour-seed";

// ---------------------------------------------------------------------------
// Auth fixture — seed portal_session cookie to skip login redirect
// ---------------------------------------------------------------------------

const TEST_TOKEN =
  process.env.MEATYWIKI_PORTAL_TOKEN ?? "test-token-e2e";

const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ page, context }, use) => {
    await context.addCookies([
      {
        name: "portal_session",
        value: TEST_TOKEN,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      },
    ]);
    await use(page);
  },
});

// ---------------------------------------------------------------------------
// Data — mirrors FLOW_CARDS in src/lib/copy/tutorial.ts
// ---------------------------------------------------------------------------

const FLOW_CARDS = [
  { id: "intake-compile",     title: "Intake → Compile → File-back", href: "/inbox",     tourId: "inbox" },
  { id: "research-workflow",  title: "Research Workflow",             href: "/research",  tourId: "researchWizard" },
  { id: "decision-framework", title: "Decision Framework",           href: "/decisions", tourId: "decisions" },
  { id: "lens-scoring",       title: "Lens Scoring",                 href: "/library",   tourId: "lensScoring" },
  { id: "graph-exploration",  title: "Graph Exploration",            href: "/graph",     tourId: "graph" },
  { id: "projects-workspace", title: "Projects Workspace",           href: "/projects",  tourId: null },
  { id: "workflow-stages",    title: "Workflow OS Stages",           href: "/workflows", tourId: "workflowRun" },
  { id: "inbox-triage",       title: "Inbox Triage",                 href: "/inbox",     tourId: "inbox" },
] as const;

const TOTAL_CARDS = FLOW_CARDS.length;

// Cards that have a tour wired
const CARDS_WITH_TOUR = FLOW_CARDS.filter((c) => c.tourId !== null);
// Cards that explicitly have no tour (tourId === null)
const CARDS_WITHOUT_TOUR = FLOW_CARDS.filter((c) => c.tourId === null);

// ---------------------------------------------------------------------------
// Desktop suite — 1280×800
// ---------------------------------------------------------------------------

test.describe("Tutorial page — interactive, desktop (1280×800)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ authedPage }) => {
    // Always start from a clean tour state so localStorage doesn't bleed
    // between tests. Navigate to the page after clearing to let React hydrate
    // against the blank state.
    await authedPage.goto("/tutorial");
    await authedPage.waitForLoadState("domcontentloaded");
    await clearAllTourState(authedPage);
    // Reload to pick up the cleared state before each test.
    await authedPage.reload();
    await authedPage.waitForLoadState("domcontentloaded");
  });

  // -------------------------------------------------------------------------
  // Structural: 8 FlowCards with correct titles
  // -------------------------------------------------------------------------

  test(`renders ${TOTAL_CARDS} FlowCard articles`, async ({ authedPage: page }) => {
    const cards = page.locator("article");
    await expect(cards).toHaveCount(TOTAL_CARDS);
  });

  test("each FlowCard renders its title", async ({ authedPage: page }) => {
    for (const { title } of FLOW_CARDS) {
      await expect(
        page.getByRole("heading", { name: title }),
        `Card title "${title}" should be visible`,
      ).toBeVisible();
    }
  });

  // -------------------------------------------------------------------------
  // TutorialNav — sticky sidebar visible at lg+
  // -------------------------------------------------------------------------

  test("TutorialNav renders anchor links on desktop", async ({
    authedPage: page,
  }) => {
    // TutorialNav renders inside <nav> or <aside> with links to #card-id.
    // At lg+ the element is visible (hidden lg:block removes the hidden class).
    const navAnchors = page.locator("nav a[href^='#'], aside a[href^='#']");
    const count = await navAnchors.count();
    // Expect at least as many nav anchors as cards
    expect(
      count,
      `Expected ≥${TOTAL_CARDS} nav anchors, got ${count}`,
    ).toBeGreaterThanOrEqual(TOTAL_CARDS);
  });

  test("nav anchor click scrolls matching card into viewport", async ({
    authedPage: page,
  }) => {
    // Use the last card anchor so we can confirm actual scrolling occurred.
    const targetCard = FLOW_CARDS[FLOW_CARDS.length - 1];
    const navLink = page
      .locator(`a[href="#${targetCard.id}"]`)
      .first();

    // The link may not be visible if the nav is off-screen initially; use force.
    await navLink.click({ force: true });

    // After click the target card should be visible in the viewport.
    const card = page.locator(`#${targetCard.id}`);
    await expect(card).toBeInViewport({ timeout: 3_000 });
  });

  // -------------------------------------------------------------------------
  // Deep-link buttons
  // -------------------------------------------------------------------------

  test("Open page link navigates to the correct route", async ({
    authedPage: page,
  }) => {
    // Test the first card as a representative.
    const firstCard = FLOW_CARDS[0];
    const openLink = page
      .locator(`#${firstCard.id}`)
      .getByRole("link", { name: /Open .+ page/i });
    await expect(openLink).toBeVisible();

    // Verify the href attribute rather than actually navigating away so we
    // don't need to handle the auth state on the destination page.
    const href = await openLink.getAttribute("href");
    expect(href).toBe(firstCard.href);
  });

  test("every unique deep-link href is present in the DOM", async ({
    authedPage: page,
  }) => {
    const uniqueHrefs = [...new Set(FLOW_CARDS.map((c) => c.href))];
    for (const href of uniqueHrefs) {
      const link = page.locator(`a[href="${href}"]`).first();
      await expect(
        link,
        `Expected at least one link with href="${href}"`,
      ).toBeAttached();
    }
  });

  // -------------------------------------------------------------------------
  // Start tour button states
  // -------------------------------------------------------------------------

  test("Start tour button is enabled for cards with a tourId", async ({
    authedPage: page,
  }) => {
    // Verify the first card that has a tour is not disabled.
    const firstWithTour = CARDS_WITH_TOUR[0];
    const card = page.locator(`#${firstWithTour.id}`);
    const startBtn = card.getByRole("button", { name: /Start tour/i });

    await expect(startBtn).toBeVisible();
    // The button should neither be disabled nor aria-disabled
    const isDisabled = await startBtn.isDisabled();
    const ariaDisabled = await startBtn.getAttribute("aria-disabled");
    expect(
      isDisabled || ariaDisabled === "true",
      `Start tour button for "${firstWithTour.title}" should be enabled`,
    ).toBe(false);
  });

  test("Start tour button is disabled for projects-workspace (tourId null)", async ({
    authedPage: page,
  }) => {
    const noTourCard = CARDS_WITHOUT_TOUR[0]; // projects-workspace
    const card = page.locator(`#${noTourCard.id}`);
    const startBtn = card.getByRole("button", { name: /Start tour/i });

    await expect(startBtn).toBeVisible();
    const isDisabled = await startBtn.isDisabled();
    const ariaDisabled = await startBtn.getAttribute("aria-disabled");
    expect(
      isDisabled || ariaDisabled === "true",
      `Start tour button for "${noTourCard.title}" should be disabled`,
    ).toBe(true);
  });

  // -------------------------------------------------------------------------
  // CompletionBadge
  // -------------------------------------------------------------------------

  test("CompletionBadge appears on a card whose tour is seeded as completed", async ({
    authedPage: page,
  }) => {
    // Seed the inbox tour as completed, then reload so React hydrates against
    // the populated state.
    const targetCard = FLOW_CARDS[0]; // intake-compile, tourId: "inbox"
    await seedTourCompleted(page, targetCard.tourId as string);
    await page.reload();
    await page.waitForLoadState("domcontentloaded");

    const card = page.locator(`#${targetCard.id}`);
    // CompletionBadge renders a span[role="img"][aria-label="Completed"]
    const badge = card.getByRole("img", { name: "Completed" });
    await expect(badge, "CompletionBadge should be visible after tour completion").toBeVisible();
  });

  test("CompletionBadge is absent on a card with no completed tour state", async ({
    authedPage: page,
  }) => {
    // No seeding — all tours are in clean state.
    const card = page.locator(`#${FLOW_CARDS[0].id}`);
    const badge = card.getByRole("img", { name: "Completed" });
    await expect(badge).not.toBeAttached();
  });

  // -------------------------------------------------------------------------
  // Reset tutorial state
  // -------------------------------------------------------------------------

  test('"Reset tutorial state" clears all CompletionBadges and shows toast', async ({
    authedPage: page,
  }) => {
    // Seed multiple tours as completed.
    for (const card of CARDS_WITH_TOUR.slice(0, 3)) {
      await seedTourCompleted(page, card.tourId as string);
    }
    await page.reload();
    await page.waitForLoadState("domcontentloaded");

    // Verify at least one badge is visible before reset.
    const badges = page.getByRole("img", { name: "Completed" });
    const countBefore = await badges.count();
    // We seeded 3 tours but some tourIds are shared (inbox × 2 cards), so
    // expect at least 2 rendered badges.
    expect(countBefore, "Expected CompletionBadges before reset").toBeGreaterThan(0);

    // Click the reset button.
    const resetBtn = page.getByRole("button", { name: /Reset tutorial/i });
    await expect(resetBtn).toBeVisible();
    await resetBtn.click();

    // Toast should appear.
    await expect(
      page.getByText(/Tutorial progress reset/i),
      "Expected success toast after reset",
    ).toBeVisible({ timeout: 5_000 });

    // All CompletionBadges should be gone.
    await expect(
      page.getByRole("img", { name: "Completed" }),
      "All CompletionBadges should be cleared after reset",
    ).toHaveCount(0);
  });

  // -------------------------------------------------------------------------
  // Accessibility
  // -------------------------------------------------------------------------

  test("axe accessibility scan passes at desktop viewport", async ({
    authedPage: page,
  }) => {
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .exclude('[aria-disabled="true"]')
      .analyze();

    expect(
      results.violations,
      `Axe found ${results.violations.length} violation(s):\n${results.violations
        .map((v) => `  [${v.impact}] ${v.id}: ${v.description}`)
        .join("\n")}`,
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Mobile suite — iPhone 12 (390×844)
// ---------------------------------------------------------------------------

test.describe("Tutorial page — interactive, iPhone 12 (390×844)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ authedPage }) => {
    await authedPage.goto("/tutorial");
    await authedPage.waitForLoadState("domcontentloaded");
    await clearAllTourState(authedPage);
    await authedPage.reload();
    await authedPage.waitForLoadState("domcontentloaded");
  });

  test(`renders ${TOTAL_CARDS} FlowCard articles on mobile`, async ({
    authedPage: page,
  }) => {
    const cards = page.locator("article");
    await expect(cards).toHaveCount(TOTAL_CARDS);
  });

  test("Start tour button disabled for projects-workspace on mobile", async ({
    authedPage: page,
  }) => {
    const noTourCard = CARDS_WITHOUT_TOUR[0];
    const card = page.locator(`#${noTourCard.id}`);
    const startBtn = card.getByRole("button", { name: /Start tour/i });
    const isDisabled = await startBtn.isDisabled();
    const ariaDisabled = await startBtn.getAttribute("aria-disabled");
    expect(isDisabled || ariaDisabled === "true").toBe(true);
  });

  test("Start tour button enabled for cards with tourId on mobile", async ({
    authedPage: page,
  }) => {
    const cardWithTour = CARDS_WITH_TOUR[0];
    const card = page.locator(`#${cardWithTour.id}`);
    const startBtn = card.getByRole("button", { name: /Start tour/i });
    await expect(startBtn).toBeVisible();
    const isDisabled = await startBtn.isDisabled();
    const ariaDisabled = await startBtn.getAttribute("aria-disabled");
    expect(isDisabled || ariaDisabled === "true").toBe(false);
  });

  test("CompletionBadge renders after seeding completed state on mobile", async ({
    authedPage: page,
  }) => {
    const targetCard = FLOW_CARDS[0];
    await seedTourCompleted(page, targetCard.tourId as string);
    await page.reload();
    await page.waitForLoadState("domcontentloaded");

    const card = page.locator(`#${targetCard.id}`);
    const badge = card.getByRole("img", { name: "Completed" });
    await expect(badge).toBeVisible();
  });

  test("axe accessibility scan passes at mobile viewport", async ({
    authedPage: page,
  }) => {
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .exclude('[aria-disabled="true"]')
      .analyze();

    expect(
      results.violations,
      `Axe found ${results.violations.length} violation(s):\n${results.violations
        .map((v) => `  [${v.impact}] ${v.id}: ${v.description}`)
        .join("\n")}`,
    ).toHaveLength(0);
  });
});
