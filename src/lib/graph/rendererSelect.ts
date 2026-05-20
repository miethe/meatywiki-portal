/**
 * rendererSelect — threshold-based renderer selector for the vault graph.
 *
 * Determines whether to use sigma.js (WebGL + graphology, adequate for N≤15K)
 * or cosmos.gl (GPU-accelerated GPU particles, required for N>15K).
 *
 * The threshold constant is intentionally exported for reuse:
 *   - P2-08: VaultGraphPageClient lazy-load wiring
 *   - P2-11: WebGL context coexistence test
 *   - Any future surface that needs to branch on graph scale
 *
 * Mutual exclusion rule (enforced at the call site in VaultGraphPageClient):
 *   sigma and cosmos.gl MUST NOT mount simultaneously. The caller is responsible
 *   for destroying the active renderer before mounting the other. Violating this
 *   can exhaust the browser's WebGL context budget (typically 8–16 contexts).
 *
 * @module rendererSelect
 */

/** Node count above which the cosmos.gl GPU renderer activates. */
export const EXTREME_SCALE_THRESHOLD = 15_000;

/** The two possible renderer backends. */
export type GraphRenderer = "sigma" | "cosmos";

/**
 * Select which renderer to use based on the current total node count.
 *
 * @param nodeCount - The total number of nodes in the vault graph (not the
 *   currently-loaded page count, but the full `total_node_count` from the API).
 * @returns "cosmos" when nodeCount >= EXTREME_SCALE_THRESHOLD, "sigma" otherwise.
 *
 * @example
 * const renderer = selectRenderer({ nodeCount: 20000 }); // → "cosmos"
 * const renderer = selectRenderer({ nodeCount: 5000 });  // → "sigma"
 */
export function selectRenderer({ nodeCount }: { nodeCount: number }): GraphRenderer {
  return nodeCount >= EXTREME_SCALE_THRESHOLD ? "cosmos" : "sigma";
}
