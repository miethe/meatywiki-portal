"use client";

/**
 * useGraphMotionDetail — reduce render detail during fast camera motion.
 *
 * Samples the sigma camera state on every `beforeRender` event, computes
 * a scalar speed from the (x, y, ratio) delta, and switches to low-detail
 * mode when speed exceeds SPEED_THRESHOLD (1.0 units/ms).
 *
 * Low-detail mode:
 *   - Sets `labelRenderedSizeThreshold` to an impossibly large value so no
 *     label passes the size test (universal label hide, works for any graph).
 *   - Sets `isMoving: true` in the returned state so the host can apply
 *     additional edge-rendering simplifications via a node/edge reducer.
 *
 * Detail is restored after IDLE_RESTORE_MS (220 ms) of camera stillness.
 *
 * SSR safety: the hook reads from the sigma context; it must be called
 * inside a SigmaContainer subtree. The sigma instance is never accessed on
 * the first render tick before the context is populated (React guarantees
 * effects run client-side only).
 *
 * Cleanup: the `beforeRender` listener and the idle timer are both torn down
 * in the useEffect return function so there are no leaks across React 19
 * Strict Mode double-mount cycles.
 *
 * v2.2 — vault graph motion-detail hook (P2-04).
 */

import { useEffect, useRef, useState } from "react";
import { useSigma } from "@react-sigma/core";
import type Sigma from "sigma";
import type { CameraState } from "sigma/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Camera speed (units/ms) above which low-detail mode activates. */
const SPEED_THRESHOLD = 1.0;

/** Ratio-delta weight factor K. Ratio changes are typically small in absolute
 *  terms but represent meaningful zoom events. K=10 makes a ratio change of
 *  0.1 units/ms contribute the same magnitude as an x/y translation of 1.0
 *  unit/ms, keeping the threshold symmetrical across pan and zoom. */
const RATIO_WEIGHT = 10;

/** Camera must be idle for this many milliseconds before detail is restored. */
const IDLE_RESTORE_MS = 220;

/** labelRenderedSizeThreshold value used in low-detail mode.
 *  Sigma's default is 6 (pixels); 1e6 ensures every label fails the test. */
const LABEL_THRESHOLD_LOW = 1_000_000;

/** labelRenderedSizeThreshold value used in full-detail mode.
 *  Matches the SigmaContainer default used elsewhere in the graph surfaces. */
const LABEL_THRESHOLD_FULL = 6;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Narrow snapshot of camera state sampled between beforeRender ticks. */
interface CameraSnapshot {
  x: number;
  y: number;
  ratio: number;
  /** Wall-clock time of the snapshot (performance.now() in ms). */
  ts: number;
}

/** Return type exposed to the host component. */
export interface GraphMotionDetailResult {
  /** True while camera speed > SPEED_THRESHOLD. */
  isMoving: boolean;
  /**
   * "low"  — camera is moving fast; hide labels + simplify edges.
   * "full" — camera is idle; render at full quality.
   */
  detailLevel: "low" | "full";
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Attach to a sigma instance (via SigmaContainer context) and return
 * `{ isMoving, detailLevel }` to drive motion-aware rendering optimisations.
 *
 * Must be called inside a SigmaContainer subtree.
 *
 * @example
 * ```tsx
 * function MotionController() {
 *   const { isMoving, detailLevel } = useGraphMotionDetail();
 *   // detailLevel drives edge-reducer flag exposed up to the host
 *   return null;
 * }
 * ```
 */
export function useGraphMotionDetail(): GraphMotionDetailResult {
  const sigma: Sigma = useSigma();

  const [isMoving, setIsMoving] = useState(false);

  // Refs avoid stale-closure issues in the event callback without creating
  // a new callback on every render.
  const prevSnapshot = useRef<CameraSnapshot | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMovingRef = useRef(false);

  useEffect(() => {
    // Guard: sigma may not be ready in SSR environments or during test setup.
    if (!sigma) return;

    /** Compute speed from consecutive camera snapshots. Returns 0 on first call. */
    function computeSpeed(prev: CameraSnapshot, next: CameraSnapshot): number {
      const dt = next.ts - prev.ts;
      if (dt <= 0) return 0;
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const dr = (next.ratio - prev.ratio) * RATIO_WEIGHT;
      return Math.sqrt(dx * dx + dy * dy + dr * dr) / dt;
    }

    /** Switch to low-detail mode and start the idle restore timer. */
    function enterLowDetail(): void {
      if (!isMovingRef.current) {
        isMovingRef.current = true;
        setIsMoving(true);
        sigma.setSetting("labelRenderedSizeThreshold", LABEL_THRESHOLD_LOW);
      }
      // Reset the idle window on every fast-motion frame.
      if (idleTimer.current !== null) {
        clearTimeout(idleTimer.current);
      }
      idleTimer.current = setTimeout(() => {
        idleTimer.current = null;
        isMovingRef.current = false;
        setIsMoving(false);
        sigma.setSetting("labelRenderedSizeThreshold", LABEL_THRESHOLD_FULL);
      }, IDLE_RESTORE_MS);
    }

    /** beforeRender callback — sample camera and update motion state. */
    function onBeforeRender(): void {
      const state: CameraState = sigma.getCamera().getState();
      const now = performance.now();
      const next: CameraSnapshot = {
        x: state.x,
        y: state.y,
        ratio: state.ratio,
        ts: now,
      };

      if (prevSnapshot.current !== null) {
        const speed = computeSpeed(prevSnapshot.current, next);
        if (speed > SPEED_THRESHOLD) {
          enterLowDetail();
        }
      }

      prevSnapshot.current = next;
    }

    sigma.on("beforeRender", onBeforeRender);

    return () => {
      sigma.off("beforeRender", onBeforeRender);
      if (idleTimer.current !== null) {
        clearTimeout(idleTimer.current);
        idleTimer.current = null;
      }
      // Restore label threshold on unmount so the next mount starts clean.
      // Catch silently: sigma may already be killed (React 19 Strict Mode).
      try {
        sigma.setSetting("labelRenderedSizeThreshold", LABEL_THRESHOLD_FULL);
      } catch {
        // sigma already destroyed — ignore
      }
      prevSnapshot.current = null;
      isMovingRef.current = false;
    };
  }, [sigma]);

  return {
    isMoving,
    detailLevel: isMoving ? "low" : "full",
  };
}
