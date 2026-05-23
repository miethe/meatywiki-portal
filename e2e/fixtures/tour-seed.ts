/**
 * tour-seed.ts — shared localStorage helpers for tour-related E2E tests.
 *
 * Constants and helpers are kept in this file so every spec that exercises
 * tour or FirstRunOffer behaviour can share identical key formats without
 * duplicating the storage schema from src/lib/storage/tour-state.ts.
 *
 * Key formats (must stay in sync with the runtime modules):
 *   Completion state: meatywiki:tour:v1:{tourId}          → JSON TourState
 *   Dismissed flag:   meatywiki:tour:v1:{tourId}:dismissed → "1"
 */

import type { Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Key format helpers — mirrors src/lib/storage/tour-state.ts
// ---------------------------------------------------------------------------

export const TOUR_STORAGE_PREFIX = "meatywiki:tour:v1:";

export function tourStateKey(tourId: string): string {
  return `${TOUR_STORAGE_PREFIX}${tourId}`;
}

export function tourDismissedKey(tourId: string): string {
  return `${TOUR_STORAGE_PREFIX}${tourId}:dismissed`;
}

// ---------------------------------------------------------------------------
// Clear helpers
// ---------------------------------------------------------------------------

/**
 * Removes all localStorage keys that start with the meatywiki:tour:v1: prefix.
 * Call this in test.beforeEach to guarantee a clean first-run state.
 */
export async function clearAllTourState(page: Page): Promise<void> {
  await page.evaluate((prefix) => {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key !== null && key.startsWith(prefix)) {
        toRemove.push(key);
      }
    }
    for (const k of toRemove) {
      localStorage.removeItem(k);
    }
  }, TOUR_STORAGE_PREFIX);
}

/**
 * Removes only the state + dismissed keys for a single tourId.
 */
export async function clearTourState(page: Page, tourId: string): Promise<void> {
  await page.evaluate(
    ([stateKey, dismissedKey]) => {
      localStorage.removeItem(stateKey);
      localStorage.removeItem(dismissedKey);
    },
    [tourStateKey(tourId), tourDismissedKey(tourId)],
  );
}

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

/**
 * Seeds a completed tour state for `tourId` so the CompletionBadge renders
 * and the FirstRunOffer banner does not appear.
 */
export async function seedTourCompleted(page: Page, tourId: string): Promise<void> {
  const state = JSON.stringify({
    completed: true,
    lastStepIndex: 0,
    completedAt: new Date().toISOString(),
  });
  await page.evaluate(
    ([key, value]) => {
      localStorage.setItem(key, value);
    },
    [tourStateKey(tourId), state],
  );
}

/**
 * Seeds the dismissed flag for `tourId` — the FirstRunOffer banner will not
 * appear even though the tour has never been completed.
 */
export async function seedTourDismissed(page: Page, tourId: string): Promise<void> {
  await page.evaluate(
    ([key]) => {
      localStorage.setItem(key, "1");
    },
    [tourDismissedKey(tourId)],
  );
}
