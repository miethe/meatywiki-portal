"use client";

/**
 * useGraphIdle — pause/resume the FA2 layout worker based on graph activity.
 *
 * Pause strategy:
 *   FA2LayoutSupervisor (graphology-layout-forceatlas2/worker) exposes only
 *   `isRunning()`, `start()`, `stop()`, and `kill()`. The `getLayoutState()`
 *   speed-proxy described in the task contract does NOT exist on v0.10.1, so
 *   this hook uses the 3000ms wall-clock fallback exclusively.
 *
 * Pause condition:
 *   After `idleMs` milliseconds with no resume-triggering events the layout
 *   is stopped and sigma is refreshed to commit final positions.
 *
 * Resume triggers:
 *   - mousedown on the sigma container (pointer interaction)
 *   - touchstart on the sigma container (mobile interaction)
 *   - sigma camera "updated" event (pan / zoom from any source)
 *
 * Cleanup:
 *   All event listeners and the idle timer are removed in the useEffect
 *   return to prevent leaks across remounts or sigma instance changes.
 *
 * Covers task P2-03 (Portal v2.2 Graph Explorer Phase 2).
 */

import { useEffect, useRef } from "react";
import type FA2LayoutSupervisor from "graphology-layout-forceatlas2/worker";
import type Sigma from "sigma";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseGraphIdleOptions {
  /** Milliseconds of inactivity before pausing the layout. Default: 3000. */
  idleMs?: number;
  /** If false the hook is a no-op (useful for conditional enabling). Default: true. */
  enabled?: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * useGraphIdle — attaches pause/resume logic to a sigma instance + FA2 worker.
 *
 * Both handles are accepted as-ref values (or null/undefined) so callers can
 * pass `sigmaRef.current` and `fa2Ref.current` without needing extra wrappers.
 * The hook re-runs whenever either reference changes identity.
 *
 * @param sigma  - sigma instance (or null/undefined while mounting)
 * @param fa2    - FA2LayoutSupervisor handle (or null/undefined while mounting)
 * @param options - idleMs, enabled
 */
export function useGraphIdle(
  sigma: Sigma | null | undefined,
  fa2: FA2LayoutSupervisor | null | undefined,
  options: UseGraphIdleOptions = {},
): void {
  const { idleMs = 3000, enabled = true } = options;

  // Store idleMs in a ref so the effect closure picks up the latest value
  // without needing to re-register listeners on every options change.
  const idleMsRef = useRef(idleMs);
  useEffect(() => {
    idleMsRef.current = idleMs;
  }, [idleMs]);

  useEffect(() => {
    if (!enabled) return;
    if (!sigma || !fa2) return;

    // Capture non-null references so TypeScript can narrow them in closures.
    const sigmaInst = sigma;
    const fa2Inst = fa2;

    // ------------------------------------------------------------------
    // Idle timer — schedule a pause after idleMs of no activity.
    // ------------------------------------------------------------------

    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    function clearIdleTimer(): void {
      if (idleTimer !== null) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
    }

    function scheduleIdle(): void {
      clearIdleTimer();
      idleTimer = setTimeout(() => {
        idleTimer = null;
        if (fa2Inst.isRunning()) {
          fa2Inst.stop();
          sigmaInst.refresh();
        }
      }, idleMsRef.current);
    }

    // ------------------------------------------------------------------
    // Resume helper — start the layout and reschedule the idle timer.
    // ------------------------------------------------------------------

    function resume(): void {
      if (!fa2Inst.isRunning()) {
        fa2Inst.start();
      }
      scheduleIdle();
    }

    // ------------------------------------------------------------------
    // DOM event handlers (attached to the sigma container element).
    // ------------------------------------------------------------------

    const container = sigmaInst.getContainer();

    function onPointerDown(): void {
      resume();
    }

    container.addEventListener("mousedown", onPointerDown);
    container.addEventListener("touchstart", onPointerDown, { passive: true });

    // ------------------------------------------------------------------
    // Sigma camera "updated" event — fires on pan and zoom.
    // ------------------------------------------------------------------

    const camera = sigmaInst.getCamera();

    function onCameraUpdated(): void {
      resume();
    }

    camera.on("updated", onCameraUpdated);

    // ------------------------------------------------------------------
    // Start the idle countdown immediately so a freshly-loaded graph that
    // receives no interaction still pauses after idleMs.
    // ------------------------------------------------------------------

    scheduleIdle();

    // ------------------------------------------------------------------
    // Cleanup — remove all listeners and the pending timer.
    // ------------------------------------------------------------------

    return () => {
      clearIdleTimer();
      container.removeEventListener("mousedown", onPointerDown);
      container.removeEventListener("touchstart", onPointerDown);
      camera.off("updated", onCameraUpdated);
    };
  }, [sigma, fa2, enabled]);
}
