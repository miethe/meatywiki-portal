/**
 * Research Journey 1 — Synthesis Builder (P4-02).
 *
 * Covers: /research/synthesis → select sources → submit → in-flight tracker →
 *         workflow_completed event → link to new synthesis artifact.
 *
 * All HTTP + SSE is stubbed via research-mocks.ts; no live backend required.
 */

import { test, expect } from "../../support/fixtures";
import {
  installResearchMocks,
  setupSSE,
  ARTIFACT_A_ID,
  ARTIFACT_B_ID,
  SYNTHESIS_RUN_ID,
  NEW_SYNTH_ARTIFACT_ID,
} from "../../support/research-mocks";

test.describe("Research: Synthesis Builder journey", () => {
  test("launches synthesis, shows in-flight tracker, completes with artifact link", async ({
    authenticatedPage: page,
  }) => {
    await installResearchMocks(page, {
      synthesizeResponse: {
        run_id: SYNTHESIS_RUN_ID,
        status: "queued",
        created_at: "2026-04-17T12:00:00Z",
      },
    });

    // Queue the SSE script the app will consume when it opens the stream
    await setupSSE(page, [
      {
        delayMs: 50,
        id: "1",
        data: {
          type: "stage_started",
          event_id: "1",
          run_id: SYNTHESIS_RUN_ID,
          timestamp: "2026-04-17T12:00:01Z",
          stage: "gathering",
        },
      },
      {
        delayMs: 50,
        id: "2",
        data: {
          type: "stage_completed",
          event_id: "2",
          run_id: SYNTHESIS_RUN_ID,
          timestamp: "2026-04-17T12:00:02Z",
          stage: "gathering",
        },
      },
      {
        delayMs: 50,
        id: "3",
        data: {
          type: "stage_started",
          event_id: "3",
          run_id: SYNTHESIS_RUN_ID,
          timestamp: "2026-04-17T12:00:03Z",
          stage: "synthesizing",
        },
      },
      {
        delayMs: 100,
        id: "4",
        data: {
          type: "workflow_completed",
          event_id: "4",
          run_id: SYNTHESIS_RUN_ID,
          timestamp: "2026-04-17T12:00:05Z",
          artifact_id: NEW_SYNTH_ARTIFACT_ID,
        },
      },
    ]);

    await page.goto("/research/synthesis");

    // Heading + form visible
    await expect(
      page.getByRole("heading", { name: /Synthesis Builder/i, level: 1 }),
    ).toBeVisible();

    const form = page.getByRole("form", { name: /Synthesis Builder/i });
    await expect(form).toBeVisible();

    // Enter two source IDs (one per line)
    const sources = page.getByLabel(/Source artifacts/i);
    await sources.fill(`${ARTIFACT_A_ID}\n${ARTIFACT_B_ID}`);

    // Submit
    await page.getByRole("button", { name: /Launch synthesis/i }).click();

    // In-flight — shows "Synthesizing…" header and the run_id
    await expect(page.getByText(/Synthesizing/i)).toBeVisible({
      timeout: 5_000,
    });
    await expect(
      page.getByText(new RegExp(`run_id:\\s*${SYNTHESIS_RUN_ID}`)),
    ).toBeVisible();

    // Eventually transitions to the complete state
    await expect(
      page.getByText(/Synthesis complete/i),
    ).toBeVisible({ timeout: 10_000 });

    // "View synthesis artifact" link points at the new artifact
    const link = page.getByRole("link", { name: /View synthesis artifact/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute(
      "href",
      `/research/pages/${NEW_SYNTH_ARTIFACT_ID}`,
    );
  });

  test("validation: blocks submission when sources are empty", async ({
    authenticatedPage: page,
  }) => {
    await installResearchMocks(page, {});
    await setupSSE(page, []); // no connection expected

    await page.goto("/research/synthesis");

    // Click without filling sources
    await page.getByRole("button", { name: /Launch synthesis/i }).click();

    // Inline validation alert visible
    await expect(
      page.getByRole("alert").filter({ hasText: /at least one source/i }),
    ).toBeVisible();

    // Still on the form phase (no "Synthesizing…" header)
    await expect(page.getByText(/^Synthesizing/i)).not.toBeVisible();
  });
});
