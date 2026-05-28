/**
 * encoding-palette.ts — Palette-aware visual encoding helpers.
 *
 * P5-08: Extends the base encoding module with palette-context awareness.
 *
 * These functions wrap the base encoding module but read colors from the active
 * palette context via usePalette(). Call these from React components that need
 * to respect palette changes (e.g., nodeReducer, edgeReducer, legend swatches).
 *
 * For non-React pure functions (like buildVaultGraph), pass the palette object
 * directly to these helpers.
 */

import {
  resolveArtifactTypeColor,
  resolveWorkspaceColor,
  resolveEdgeTypeColor,
  type ColorPalette,
} from "./palette";
import type { NodeColorMode } from "@/types/graph";

// ---------------------------------------------------------------------------
// Palette-aware color resolution (pure functions accepting palette)
// ---------------------------------------------------------------------------

/**
 * Resolve node color using a provided palette object.
 * Use this from non-React contexts (like buildVaultGraph in VaultGraphPageClient).
 */
export function resolveNodeColorWithPalette(
  artifactType: string,
  workspace: string,
  lensScores: Record<string, number | undefined> | null | undefined,
  selectedLens: string | null,
  mode: NodeColorMode,
  palette: ColorPalette,
): string {
  switch (mode) {
    case "workspace":
      return resolveWorkspaceColor(workspace, palette);

    case "lens": {
      if (!selectedLens || !lensScores) {
        return resolveArtifactTypeColor(artifactType, palette);
      }
      const score = lensScores[selectedLens];
      if (score === undefined || score === null) {
        // Fallback to default artifact type color for missing lens score
        return resolveArtifactTypeColor(artifactType, palette);
      }
      // Map 0..1 continuous score to a blue→red ramp via HSL.
      // Low score (0) → cool blue, high score (1) → warm red.
      // We interpolate hue: 220° (blue) → 0° (red).
      const clamped = Math.max(0, Math.min(1, score));
      const hue = Math.round(220 - clamped * 220);
      return `hsl(${hue},80%,45%)`;
    }

    case "artifact_type":
    default:
      return resolveArtifactTypeColor(artifactType, palette);
  }
}

/**
 * Resolve edge color using a provided palette object.
 * Use this from non-React contexts or reducer functions.
 */
export function resolveEdgeColorWithPalette(
  edgeType: string,
  palette: ColorPalette,
): string {
  return resolveEdgeTypeColor(edgeType, palette);
}

// ---------------------------------------------------------------------------
// Re-exports of base encoding functions (no palette needed)
// ---------------------------------------------------------------------------

export {
  resolveNodeSize,
  resolveNodeOpacity,
  hasUncertaintyRing,
  resolveEdgeSize,
  isSemanticEdge,
} from "./encoding";

export type { RING_SIZE_SCALE } from "./encoding";
