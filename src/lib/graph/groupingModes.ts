/**
 * groupingModes — enum + display labels for the 8 graph grouping modes.
 *
 * v2.2 — graph explorer grouping selector (P3-09).
 */

// ---------------------------------------------------------------------------
// Type
// ---------------------------------------------------------------------------

export type GroupingMode =
  | "none"
  | "workspace"
  | "artifact_type"
  | "project"
  | "domain"
  | "lens_cluster"
  | "temporal"
  | "semantic_cluster";

// ---------------------------------------------------------------------------
// Descriptor shape
// ---------------------------------------------------------------------------

export interface GroupingModeDescriptor {
  value: GroupingMode;
  label: string;
  /** When true the option is greyed out with a tooltip. */
  disabled?: boolean;
  /** Tooltip shown on hover when disabled. */
  disabledReason?: string;
}

// ---------------------------------------------------------------------------
// Ordered list — rendered top-to-bottom in the dropdown
// ---------------------------------------------------------------------------

export const GROUPING_MODES: GroupingModeDescriptor[] = [
  {
    value: "none",
    label: "None",
  },
  {
    value: "workspace",
    label: "Workspace",
  },
  {
    value: "artifact_type",
    label: "Artifact type",
  },
  {
    value: "project",
    label: "Project",
  },
  {
    value: "domain",
    label: "Domain",
  },
  {
    value: "lens_cluster",
    label: "Lens cluster (F0–F4)",
  },
  {
    value: "temporal",
    label: "Temporal (by month)",
  },
  {
    value: "semantic_cluster",
    label: "Semantic cluster",
    disabled: true,
    disabledReason: "Available when semantic clustering ships",
  },
];

// ---------------------------------------------------------------------------
// Default
// ---------------------------------------------------------------------------

export const DEFAULT_GROUPING_MODE: GroupingMode = "none";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Look up descriptor by value — always returns something (falls back to "none"). */
export function getGroupingDescriptor(mode: GroupingMode): GroupingModeDescriptor {
  return GROUPING_MODES.find((m) => m.value === mode) ?? GROUPING_MODES[0];
}

/**
 * Compute a cluster_id string for a given node and grouping mode.
 *
 * Returns null when no meaningful cluster can be assigned (mode === "none",
 * "semantic_cluster", or a required attribute is missing).
 *
 * @param node      - Partial node attribute bag from graphology.
 * @param mode      - Active grouping mode.
 */
export function computeClusterId(
  node: {
    workspace?: string | null;
    artifact_type?: string | null;
    project?: string | null;
    domain?: string | null;
    fidelity_level?: number | null;
    updated_at?: string | null;
  },
  mode: GroupingMode,
): string | null {
  switch (mode) {
    case "none":
    case "semantic_cluster":
      return null;

    case "workspace":
      return node.workspace ?? null;

    case "artifact_type":
      return node.artifact_type ?? null;

    case "project":
      return node.project ?? null;

    case "domain":
      return node.domain ?? null;

    case "lens_cluster": {
      const fl = node.fidelity_level;
      if (fl == null) return null;
      return `F${Math.floor(fl)}`;
    }

    case "temporal": {
      const ts = node.updated_at;
      if (!ts) return null;
      const d = new Date(ts);
      if (Number.isNaN(d.getTime())) return null;
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      return `${d.getUTCFullYear()}-${mm}`;
    }

    default:
      return null;
  }
}
