/**
 * sigmaLifecycle — defensive helpers for detecting a killed Sigma instance.
 *
 * Why this exists:
 *   @react-sigma/core v5 recreates its Sigma instance whenever the `graph`
 *   prop reference changes. Because passive useEffect cleanups run depth-first
 *   (children before parents) but setups also run depth-first, the order on a
 *   `graph`-prop change is:
 *     1. Child cleanup (with stale closure)
 *     2. Parent (SigmaContainer) cleanup → calls `instance.kill()`
 *     3. Child setup (closure still captures the killed instance)
 *     4. Parent setup → constructs new Sigma, schedules setSigma()
 *   At step 3, child hooks like useClientFilters / useClusterAssignment that
 *   invoke `sigma.refresh()` operate on a killed instance. sigma.kill() empties
 *   `nodePrograms`, so the very next render() throws
 *   `Sigma: could not find a suitable program for node type "circle"!`.
 *
 *   The structurally correct fix is to stabilize the `graph` prop identity
 *   (use one Graph instance for the lifetime of the SigmaContainer and mutate
 *   in place). Until that refactor lands, hooks downstream of SigmaContainer
 *   must guard against the killed-instance window.
 *
 * Usage:
 *   const sigma = useSigma();
 *   if (isSigmaKilled(sigma)) return;
 *   sigma.refresh();
 */

import type { Sigma } from "sigma";

/**
 * Returns true if the provided sigma instance has been killed.
 *
 * Sigma.kill() unconditionally sets `nodePrograms`, `nodeHoverPrograms`, and
 * `edgePrograms` to `{}`. A freshly-constructed Sigma always registers the
 * default `circle` node program plus `arrow` + `line` edge programs, so a
 * non-killed instance never has all three maps empty simultaneously. Checking
 * `nodePrograms` is sufficient because it is emptied last in kill() and is
 * what `addNodeToProgram` consults — the same map whose emptiness produces
 * the user-visible "could not find a suitable program" error.
 */
export function isSigmaKilled(sigma: Sigma | null | undefined): boolean {
  if (!sigma) return true;
  const programs = (sigma as unknown as { nodePrograms?: Record<string, unknown> })
    .nodePrograms;
  if (!programs) return true;
  return Object.keys(programs).length === 0;
}
