/**
 * autoDegrade — device speed detection and graph render-mode matrix.
 *
 * P5-03: Implements the auto-degrade matrix from interaction spec §14.
 *
 * Two concerns:
 *   1. `measureDeviceSpeed()` — single RAF timing pass, cached per-session.
 *   2. `chooseGraphMode()` — deterministic matrix lookup from device class +
 *      node count, returning one of four render outcomes.
 *
 * This module is deliberately side-effect-free aside from the session cache
 * stored in `_cachedSpeed`. It can be imported in any client component.
 *
 * Note: this matrix runs BEFORE the cosmos.gl threshold check from P2-07/P2-08.
 * If the matrix returns `'list-only'`, the caller must show DegradedFallback
 * without ever mounting SigmaContainer or CosmosGraphWrapper.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The four possible render outcomes from the auto-degrade matrix (§14). */
export type GraphRenderMode =
  | "full"           // graph available, static or dynamic at user's discretion
  | "static-forced"  // graph available, FA2 disabled, label cap applied
  | "opt-in-warning" // graph available but slow — show warning banner first
  | "list-only";     // graph not available — show DegradedFallback list view

/** Label cap: max number of node labels rendered for each matrix row. */
export interface DegradeConfig {
  mode: GraphRenderMode;
  /** Maximum labels to render. `null` means use the full sigma budget (420). */
  labelCap: number | null;
  /** Whether convex-hull cluster halos should be shown. */
  clusterHalos: boolean;
  /** Whether FA2 simulation is permitted. */
  fa2Permitted: boolean;
}

// ---------------------------------------------------------------------------
// Device speed detection (interaction spec §14)
// ---------------------------------------------------------------------------

/** Result of a single RAF timing measurement. */
export type DeviceSpeed = "fast" | "slow";

/** Module-level cache: undefined = not yet measured. */
let _cachedSpeed: DeviceSpeed | undefined;

/**
 * Measure device render speed via a single RAF timing pass.
 *
 * Spec: "fast" if RAF delta ≤50ms; "slow" if >50ms.
 * Touch-fast threshold is <33ms per §14 (Touch fast = RAF <33ms);
 * the general fast/slow boundary for desktop is 50ms.
 * We expose both from the returned promise for the caller to apply.
 *
 * Result is cached in module scope — only one measurement per browser session.
 *
 * @returns A promise resolving to the RAF delta in milliseconds.
 */
export function measureDeviceSpeed(): Promise<number> {
  if (_cachedSpeed !== undefined) {
    // Return a resolved promise matching the cached bucket.
    // We store the raw ms in a second variable for full fidelity.
    return Promise.resolve(_cachedSpeedMs ?? (_cachedSpeed === "fast" ? 16 : 60));
  }

  return new Promise((resolve) => {
    const t0 = performance.now();
    requestAnimationFrame(() => {
      const dt = performance.now() - t0;
      // Cache for both the typed bucket and the raw value.
      _cachedSpeed = dt > 50 ? "slow" : "fast";
      _cachedSpeedMs = dt;
      resolve(dt);
    });
  });
}

/** Raw millisecond cache (needed to distinguish fast-but-not-very-fast). */
let _cachedSpeedMs: number | undefined;

// ---------------------------------------------------------------------------
// Matrix lookup
// ---------------------------------------------------------------------------

export interface ChooseGraphModeInput {
  /** Total node count reported by the server (not just loaded pages). */
  nodeCount: number;
  /** True when navigator.maxTouchPoints > 0. */
  touch: boolean;
  /** RAF delta in milliseconds from measureDeviceSpeed(). */
  rafMs: number;
}

/**
 * Deterministic auto-degrade matrix from interaction spec §14.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ Device class    │ Node count  │ mode            │ labelCap │ halos  │ FA2│
 * ├─────────────────┼─────────────┼─────────────────┼──────────┼────────┼───┤
 * │ Desktop fast    │ any         │ full            │ 420      │ SVG    │ Y  │
 * │ Desktop slow    │ any         │ static-forced   │ 70       │ No     │ N  │
 * │ Touch fast      │ ≤1K         │ full            │ 80       │ No     │ Y  │
 * │ Touch fast      │ 1K–2K       │ static-forced   │ 40       │ No     │ N  │
 * │ Touch fast      │ 2K–5K       │ opt-in-warning  │ 20       │ No     │ N  │
 * │ Touch fast      │ >5K         │ list-only       │ N/A      │ N/A    │ N/A│
 * │ Touch slow      │ ≤500        │ static-forced   │ 20       │ No     │ N  │
 * │ Touch slow      │ >500        │ list-only       │ N/A      │ N/A    │ N/A│
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * "Desktop slow" = maxTouchPoints=0, RAF >50ms
 * "Touch fast"   = maxTouchPoints>0, RAF <33ms
 * "Touch slow"   = maxTouchPoints>0, RAF ≥50ms
 *
 * N.B. This check runs FIRST — before the cosmos.gl N>15K path from P2-07.
 * If mode===`list-only`, the caller must NOT proceed to cosmos.gl activation.
 */
export function chooseGraphMode({
  nodeCount,
  touch,
  rafMs,
}: ChooseGraphModeInput): DegradeConfig {
  if (!touch) {
    // ── Desktop ──────────────────────────────────────────────────────────
    if (rafMs <= 50) {
      // Desktop fast: full budget, cluster halos allowed, FA2 permitted.
      return { mode: "full", labelCap: 420, clusterHalos: true, fa2Permitted: true };
    }
    // Desktop slow (RAF >50ms): static, label cap 70, no halos, no FA2.
    return { mode: "static-forced", labelCap: 70, clusterHalos: false, fa2Permitted: false };
  }

  // ── Touch device ─────────────────────────────────────────────────────
  const touchFast = rafMs < 33;

  if (touchFast) {
    if (nodeCount <= 1_000) {
      return { mode: "full", labelCap: 80, clusterHalos: false, fa2Permitted: true };
    }
    if (nodeCount <= 2_000) {
      return { mode: "static-forced", labelCap: 40, clusterHalos: false, fa2Permitted: false };
    }
    if (nodeCount <= 5_000) {
      return { mode: "opt-in-warning", labelCap: 20, clusterHalos: false, fa2Permitted: false };
    }
    // >5K
    return { mode: "list-only", labelCap: null, clusterHalos: false, fa2Permitted: false };
  }

  // Touch slow (RAF ≥50ms — using ≥33ms for the non-fast branch)
  if (nodeCount <= 500) {
    return { mode: "static-forced", labelCap: 20, clusterHalos: false, fa2Permitted: false };
  }
  // >500
  return { mode: "list-only", labelCap: null, clusterHalos: false, fa2Permitted: false };
}

// ---------------------------------------------------------------------------
// Banner copy (interaction spec §14, exact wording)
// ---------------------------------------------------------------------------

/**
 * Build the warning banner copy for the `opt-in-warning` mode.
 * Returns the two CTA labels and the body message exactly as specified.
 */
export function buildOptInWarningCopy(nodeCount: number): {
  message: string;
  ctaList: string;
  ctaGraph: string;
} {
  return {
    message: `Graph view may be slow on this device (${nodeCount.toLocaleString()} nodes)`,
    ctaList: "Show list view — recommended",
    ctaGraph: "Try graph view anyway",
  };
}
