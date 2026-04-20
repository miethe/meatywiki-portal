/**
 * E2E: PWA Offline Queue — simulate offline submit and sync-on-reconnect.
 *
 * TODO (P4-04): Enable when e2e infrastructure is stable.
 *
 * This spec requires:
 *   1. Backend running at http://127.0.0.1:8787 with PORTAL_ENABLE_PWA=1
 *   2. Frontend built with NEXT_PUBLIC_PORTAL_ENABLE_PWA=1
 *   3. A valid auth session (cookie set before the test runs)
 *
 * Flow:
 *   a. Open the portal and navigate to Inbox.
 *   b. Simulate offline (context.setOffline(true)).
 *   c. Open Quick Add, submit a note.
 *   d. Assert "Queued (1)" badge appears and modal transitions to "Saved for later".
 *   e. Restore online (context.setOffline(false)).
 *   f. Wait for sync — OfflineQueueSync drains the queue.
 *   g. Assert the artifact appears in the Inbox within 10 seconds.
 *   h. Assert IndexedDB offline_queue is empty (via evaluate).
 *
 * Browser support note:
 *   Background Sync API is only available in Chromium. The test targets
 *   chromium (default Playwright project). On browsers without Background
 *   Sync, the client-side drain fallback triggers on the 'online' event.
 */

import { test, expect } from "@playwright/test";

test.describe("PWA Offline Queue", () => {
  test.skip(
    true,
    // TODO (P4-04): Unskip once backend is available in CI and e2e auth is wired.
    // Reference: phase-4-pwa-finalization.md P4-04 (a11y/perf audit + e2e).
    "Requires backend + auth; unskip in P4-04",
  );

  test("offline submit enqueues + syncs on reconnect", async ({ context, page }) => {
    // Navigate to portal (assumes auth cookie set by test fixture).
    await page.goto("/");

    // Step 1: go offline.
    await context.setOffline(true);

    // Step 2: open Quick Add modal.
    await page.click('[aria-label="Quick Add"]');
    await page.waitForSelector('[role="dialog"][aria-labelledby="quick-add-title"]');

    // Step 3: type a note and submit.
    await page.fill('textarea[placeholder*="note"]', "E2E offline test note");
    await page.click('button[type="submit"]:has-text("Add")');

    // Step 4: assert queued phase UI.
    await expect(page.getByText(/saved for later/i)).toBeVisible({ timeout: 3000 });

    // The "Queued (1)" badge should be visible in the header.
    await expect(page.getByText(/Queued \(1\)/)).toBeVisible({ timeout: 3000 });

    // Step 5: restore connectivity.
    await context.setOffline(false);

    // Step 6: wait for sync — drain fires via 'online' event.
    // Close the modal first so we can observe Inbox.
    await page.keyboard.press("Escape");

    // Step 7: wait for artifact to appear in Inbox.
    await expect(
      page.locator('[data-testid="inbox-artifact-list"] [data-testid="artifact-card"]').first(),
    ).toBeVisible({ timeout: 10_000 });

    // Step 8: verify offline_queue is empty in IndexedDB.
    const queuedCount = await page.evaluate(async () => {
      return await new Promise<number>((resolve) => {
        const req = indexedDB.open("meatywiki-portal-offline", 1);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("offline_queue", "readonly");
          const countReq = tx.objectStore("offline_queue").count();
          countReq.onsuccess = () => resolve(countReq.result);
        };
        req.onerror = () => resolve(-1);
      });
    });

    expect(queuedCount).toBe(0);
  });
});
