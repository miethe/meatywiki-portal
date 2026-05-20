/**
 * createModuleForce — centroid-pull force for graphology graphs.
 *
 * Adapts the module-force pattern from codebase-map as a standalone graphology-
 * compatible force function. Each tick reads every node's `x`, `y`, and
 * `cluster_id` from graphology attributes, computes per-cluster centroids, then
 * applies an attractive force toward the centroid scaled by `strength * alpha`.
 *
 * Integration with FA2 (graphology-layout-forceatlas2/worker):
 *   FA2's Web Worker does NOT expose a mid-tick plugin-force API — there is no
 *   `additionalForces` hook in graphology-layout-forceatlas2. To avoid forking
 *   the worker, we run a separate requestAnimationFrame (RAF) loop that reads
 *   the graphology graph (which the FA2 worker writes through graphology's
 *   shared attribute store), applies centroid forces, then re-writes positions.
 *   The RAF loop runs while FA2 is active and self-terminates on stop/kill.
 *   This is documented in VaultGraphPageClient (FA2 force injection approach).
 *
 * Active modes: Only `workspace` and `project` grouping modes activate the
 * centroid force. Other modes: no-op.
 *
 * v2.2 — graph explorer P3-10 (centroid-pull force).
 */

import type Graph from "graphology";
import type { GroupingMode } from "@/lib/graph/groupingModes";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModuleForceOptions {
  /** Attraction strength: 0 = no pull, 1 = full collapse to centroid. */
  strength: number;
}

export interface RampedModuleForceOptions {
  /** Final strength after ramping (default 0.3). */
  targetStrength?: number;
  /** Duration of the ramp in ms (default 500). */
  rampMs?: number;
}

export interface RampedModuleForce {
  /** Apply one tick of centroid pull. Call from a RAF/timer loop. */
  tick: () => void;
  /** Start ramping strength from 0 to targetStrength over rampMs. */
  start: () => void;
  /** Stop the force (sets strength to 0; does not stop the caller's loop). */
  stop: () => void;
  /** Current effective strength (read-only snapshot). */
  readonly strength: number;
}

// ---------------------------------------------------------------------------
// Centroid computation
// ---------------------------------------------------------------------------

interface Centroid {
  x: number;
  y: number;
  count: number;
}

function computeCentroids(graph: Graph): Map<string, Centroid> {
  const centroids = new Map<string, Centroid>();

  graph.forEachNode((nodeId, attrs) => {
    const clusterId: string | null | undefined = attrs.cluster_id;
    // Skip nodes without a cluster assignment or with invalid positions.
    if (!clusterId) return;
    const x: number = attrs.x ?? 0;
    const y: number = attrs.y ?? 0;

    const existing = centroids.get(clusterId);
    if (existing) {
      existing.x += x;
      existing.y += y;
      existing.count += 1;
    } else {
      centroids.set(clusterId, { x, y, count: 1 });
    }
  });

  // Normalize to mean centroid.
  centroids.forEach((c) => {
    c.x /= c.count;
    c.y /= c.count;
  });

  return centroids;
}

// ---------------------------------------------------------------------------
// Core force function
// ---------------------------------------------------------------------------

/**
 * Create a single-tick centroid-pull force for a graphology graph.
 *
 * @param graph    - The graphology graph instance (must have x/y/cluster_id attrs).
 * @param options  - Force options; `strength` is multiplied by the caller's alpha.
 * @returns A function `(alpha: number) => void` — call once per simulation tick.
 */
export function createModuleForce(
  graph: Graph,
  options: ModuleForceOptions,
): (alpha: number) => void {
  return function tick(alpha: number) {
    if (options.strength <= 0 || alpha <= 0) return;

    const centroids = computeCentroids(graph);
    if (centroids.size === 0) return;

    graph.forEachNode((nodeId, attrs) => {
      const clusterId: string | null | undefined = attrs.cluster_id;
      if (!clusterId) return;

      const centroid = centroids.get(clusterId);
      if (!centroid) return;

      const x: number = attrs.x ?? 0;
      const y: number = attrs.y ?? 0;

      const dx = centroid.x - x;
      const dy = centroid.y - y;

      // Apply force: move node toward centroid scaled by strength * alpha.
      const force = options.strength * alpha;
      graph.setNodeAttribute(nodeId, "x", x + dx * force);
      graph.setNodeAttribute(nodeId, "y", y + dy * force);
    });
  };
}

// ---------------------------------------------------------------------------
// Ramped force (smooth activation)
// ---------------------------------------------------------------------------

/**
 * Create a centroid-pull force that ramps its strength from 0 → targetStrength
 * linearly over rampMs milliseconds using `performance.now()` deltas.
 *
 * The caller is responsible for calling `force.tick()` on each RAF frame while
 * FA2 is running, and `force.stop()` when FA2 settles or grouping mode changes.
 *
 * @example
 * const force = createRampedModuleForce(graph, { targetStrength: 0.3, rampMs: 500 });
 * force.start();
 * // In RAF loop while FA2 is running:
 * force.tick();
 */
export function createRampedModuleForce(
  graph: Graph,
  options: RampedModuleForceOptions = {},
): RampedModuleForce {
  const targetStrength = options.targetStrength ?? 0.3;
  const rampMs = options.rampMs ?? 500;

  let currentStrength = 0;
  let startTime: number | null = null;
  let active = false;

  const tick = () => {
    if (!active || currentStrength <= 0) return;

    // Ramp: update strength based on elapsed time since start.
    if (startTime !== null) {
      const elapsed = performance.now() - startTime;
      currentStrength = Math.min(targetStrength, (elapsed / rampMs) * targetStrength);
    }

    // Apply one tick with alpha = 1 (alpha simulation is implicit in strength).
    const forceFn = createModuleForce(graph, { strength: currentStrength });
    forceFn(1);
  };

  const start = () => {
    active = true;
    startTime = performance.now();
    currentStrength = 0;
  };

  const stop = () => {
    active = false;
    currentStrength = 0;
    startTime = null;
  };

  return {
    tick,
    start,
    stop,
    get strength() {
      return currentStrength;
    },
  };
}

// ---------------------------------------------------------------------------
// Grouping mode guard
// ---------------------------------------------------------------------------

/** Grouping modes that activate the centroid-pull force. */
const CENTROID_FORCE_MODES = new Set<GroupingMode>(["workspace", "project"]);

/**
 * Returns true when the given grouping mode should activate the centroid-pull
 * force. Only `workspace` and `project` are supported.
 */
export function isCentroidForceModeActive(mode: GroupingMode): boolean {
  return CENTROID_FORCE_MODES.has(mode);
}
