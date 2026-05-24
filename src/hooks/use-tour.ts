'use client';

/**
 * use-tour — hooks for product tour orchestration and first-run offer UX.
 *
 * useTour(tourId)
 *   Binds a component to a specific tour. Delegates start/stop to TourContext
 *   (supplied by TourProvider, built in P3-03). Safe to call outside of
 *   TourProvider — context-absent calls are no-ops.
 *
 * useFirstRunOffer(tourId)
 *   Drives the "would you like a tour?" banner. Evaluates whether to show the
 *   offer based on completion state and per-tour dismissed flag in localStorage.
 *   dismiss() persists the flag; accept() dismisses + starts the tour.
 *
 * localStorage key for dismissed flag:
 *   meatywiki:tour:v1:{tourId}:dismissed  →  "1"
 */

import { useCallback, useEffect, useState } from 'react';
import { useTourContext } from '@/components/tour/tour-context';
import { getTourState } from '@/lib/storage/tour-state';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DISMISSED_SUFFIX = ':dismissed';

function dismissedKey(tourId: string): string {
  return `meatywiki:tour:v1:${tourId}${DISMISSED_SUFFIX}`;
}

function isDismissedInStorage(tourId: string): boolean {
  try {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(dismissedKey(tourId)) === '1';
  } catch {
    return false;
  }
}

function persistDismissed(tourId: string): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(dismissedKey(tourId), '1');
  } catch {
    // quota exceeded or storage blocked — silently ignore
  }
}

// ---------------------------------------------------------------------------
// useTour
// ---------------------------------------------------------------------------

export interface UseTourResult {
  /** Starts this tour. No-op when TourContext is not mounted. */
  start: () => void;
  /** Stops the active tour. No-op when TourContext is not mounted. */
  stop: () => void;
  /** True when this tour has been marked completed in localStorage. */
  isComplete: boolean;
  /** True when this tour is the currently active tour in TourContext. */
  isRunning: boolean;
}

export function useTour(tourId: string): UseTourResult {
  const ctx = useTourContext();
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    setIsComplete(getTourState(tourId)?.completed ?? false);
  }, [tourId]);

  const start = useCallback(() => {
    ctx?.start(tourId);
  }, [ctx, tourId]);

  const stop = useCallback(() => {
    ctx?.stop();
  }, [ctx]);

  const isRunning = ctx?.currentTour === tourId;

  return { start, stop, isComplete, isRunning };
}

// ---------------------------------------------------------------------------
// useFirstRunOffer
// ---------------------------------------------------------------------------

export interface UseFirstRunOfferResult {
  /**
   * True when the offer banner should be shown — the tour is neither complete
   * nor dismissed by the user.
   */
  shouldOffer: boolean;
  /** Persist the dismissed flag so the banner no longer appears. */
  dismiss: () => void;
  /** Dismiss the banner AND start the tour immediately. */
  accept: () => void;
}

export function useFirstRunOffer(tourId: string): UseFirstRunOfferResult {
  const { start, isComplete } = useTour(tourId);

  const [dismissed, setDismissed] = useState<boolean>(() =>
    isDismissedInStorage(tourId),
  );

  // Re-sync dismissed flag when tourId changes (e.g. component reuse across tours).
  useEffect(() => {
    setDismissed(isDismissedInStorage(tourId));
  }, [tourId]);

  const shouldOffer = !isComplete && !dismissed;

  const dismiss = useCallback(() => {
    persistDismissed(tourId);
    setDismissed(true);
  }, [tourId]);

  const accept = useCallback(() => {
    persistDismissed(tourId);
    setDismissed(true);
    start();
  }, [tourId, start]);

  return { shouldOffer, dismiss, accept };
}
