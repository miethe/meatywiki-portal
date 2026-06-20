"use client";

/**
 * OptionSelectField — inline GroupedSelect for enum-valued artifact fields.
 *
 * Wraps the @miethe/ui GroupedSelect with:
 *   - Site-wide option fetching for the dynamic fields (status, type, workspace).
 *   - Static enum groups for the stable fields (freshness, verification,
 *     publish_state) whose backend enum values are settled and not expected to
 *     change between deploys. These fall back to the static lists used by
 *     ArtifactDetailClient today; the field-options API does not yet expose
 *     dedicated endpoints for them.
 *   - Optimistic save: the displayed value changes immediately on selection;
 *     rolls back on Promise rejection.
 *   - ETag guard preserved end-to-end via the caller-supplied `onSave` handler
 *     (which wraps useFieldEditSave.saveScalar).
 *   - Loading skeleton while dynamic options are fetching.
 *   - Keyboard navigation: provided natively by Radix Select inside GroupedSelect.
 *
 * Supported field names (via the `field` prop):
 *   "status"              → GroupedSelect with dynamic status options + static clarifiers
 *   "type"                → dynamic artifact-type options, grouped by category
 *   "subtype"             → static fixed subtype groups
 *   "workspace"           → dynamic workspace options
 *   "freshness_class"     → static freshness groups
 *   "verification_status" → static verification groups
 *   "publish_state"       → static publish state groups
 *
 * Dynamic fields use useStatusOptions / useArtifactTypeOptions / useWorkspaceOptions
 * respectively. Static fields produce their own GroupedSelectGroup[] inline.
 *
 * Props
 * -----
 *   field     — which artifact field this select controls
 *   value     — current persisted value string (controlled)
 *   onSave    — async (newValue: string) => void; caller calls saveScalar(field, v)
 *   disabled  — disables the underlying Radix select
 *   label     — aria-label / visual label (for wrapper accessibility)
 *
 * Option sources (per field):
 *   status              → useStatusOptions() + static labels
 *   type                → useArtifactTypeOptions(), grouped by category
 *   subtype             → static
 *   workspace           → useWorkspaceOptions() + static labels
 *   freshness_class     → static
 *   verification_status → static
 *   publish_state       → static
 *
 * Portal v2.6 Phase 2 (P2-03).
 */

import React, { useCallback, useMemo, useState } from "react";
import { GroupedSelect } from "@miethe/ui";
import type { GroupedSelectGroup } from "@miethe/ui";
import { cn } from "@/lib/utils";
import {
  useStatusOptions,
  useArtifactTypeOptions,
  useWorkspaceOptions,
} from "@/hooks/useFieldOptions";

// ---------------------------------------------------------------------------
// Field discriminant union
// ---------------------------------------------------------------------------

export type OptionSelectFieldName =
  | "status"
  | "type"
  | "subtype"
  | "workspace"
  | "freshness_class"
  | "verification_status"
  | "publish_state";

// ---------------------------------------------------------------------------
// Static enum group definitions
// ---------------------------------------------------------------------------

/** Status options augmented with a human-readable label. */
const STATUS_GROUPS: GroupedSelectGroup[] = [
  {
    label: "Lifecycle",
    items: [
      { value: "draft", label: "Draft" },
      { value: "active", label: "Active" },
      { value: "archived", label: "Archived" },
      { value: "stale", label: "Stale" },
      { value: "superseded", label: "Superseded" },
    ],
  },
  {
    label: "Inbox",
    items: [
      { value: "new", label: "New" },
      { value: "needs_compile", label: "Needs Compile" },
      { value: "needs_destination", label: "Needs Destination" },
    ],
  },
];

const WORKSPACE_GROUPS: GroupedSelectGroup[] = [
  {
    label: "Workspaces",
    items: [
      { value: "inbox", label: "Inbox" },
      { value: "library", label: "Library" },
      { value: "research", label: "Research" },
      { value: "blog", label: "Blog" },
      { value: "projects", label: "Projects" },
    ],
  },
];

const FRESHNESS_GROUPS: GroupedSelectGroup[] = [
  {
    label: "Freshness",
    items: [
      { value: "current", label: "Current" },
      { value: "aging", label: "Aging" },
      { value: "stale", label: "Stale" },
      { value: "outdated", label: "Outdated" },
    ],
  },
];

const VERIFICATION_GROUPS: GroupedSelectGroup[] = [
  {
    label: "Verification",
    items: [
      { value: "unverified", label: "Unverified" },
      { value: "human_review_pending", label: "Human Review Pending" },
      { value: "human_reviewed", label: "Human Reviewed" },
      { value: "machine_verified", label: "Machine Verified" },
      { value: "disputed", label: "Disputed" },
    ],
  },
];

const PUBLISH_STATE_GROUPS: GroupedSelectGroup[] = [
  {
    label: "Publish State",
    items: [
      { value: "internal", label: "Internal" },
      { value: "draft", label: "Draft" },
      { value: "review", label: "Review" },
      { value: "published", label: "Published" },
    ],
  },
];

/** Subtype options: a representative static set.
 *  The backend may extend these; the dynamic field-options endpoint for
 *  subtype is not yet available (tracked as a v2.6 follow-up). */
const SUBTYPE_GROUPS: GroupedSelectGroup[] = [
  {
    label: "Concept",
    items: [
      { value: "definition", label: "Definition" },
      { value: "framework", label: "Framework" },
      { value: "principle", label: "Principle" },
      { value: "pattern", label: "Pattern" },
    ],
  },
  {
    label: "Entity",
    items: [
      { value: "person", label: "Person" },
      { value: "organization", label: "Organization" },
      { value: "project", label: "Project" },
      { value: "product", label: "Product" },
    ],
  },
  {
    label: "Evidence",
    items: [
      { value: "research_paper", label: "Research Paper" },
      { value: "blog_post", label: "Blog Post" },
      { value: "book", label: "Book" },
      { value: "video", label: "Video" },
      { value: "talk", label: "Talk" },
    ],
  },
  {
    label: "Synthesis",
    items: [
      { value: "analysis", label: "Analysis" },
      { value: "comparison", label: "Comparison" },
      { value: "review", label: "Review" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Artifact type grouping (for dynamic list)
// ---------------------------------------------------------------------------

/** Best-effort categorisation of the ~40 artifact types into display groups.
 *  When new types arrive from the API that don't match any group they fall
 *  into "Other". */
const TYPE_GROUP_MAP: Record<string, string> = {
  // Core knowledge
  concept: "Knowledge",
  definition: "Knowledge",
  framework: "Knowledge",
  principle: "Knowledge",
  // Entity
  entity: "Entity",
  person: "Entity",
  organization: "Entity",
  product: "Entity",
  // Evidence
  evidence: "Evidence",
  raw_note: "Capture",
  bookmark: "Capture",
  clip: "Capture",
  // Synthesis
  synthesis: "Synthesis",
  analysis: "Synthesis",
  summary: "Synthesis",
  // Reference
  topic: "Reference",
  glossary: "Reference",
  index: "Reference",
  // Blog / publish
  blog_post: "Publish",
  newsletter: "Publish",
};

function groupArtifactTypes(types: string[]): GroupedSelectGroup[] {
  const buckets = new Map<string, string[]>();

  for (const t of types) {
    const bucket = TYPE_GROUP_MAP[t] ?? "Other";
    const existing = buckets.get(bucket);
    if (existing) {
      existing.push(t);
    } else {
      buckets.set(bucket, [t]);
    }
  }

  // Preferred group order
  const ORDER = [
    "Knowledge",
    "Entity",
    "Evidence",
    "Capture",
    "Synthesis",
    "Reference",
    "Publish",
    "Other",
  ];

  const groups: GroupedSelectGroup[] = [];
  for (const label of ORDER) {
    const items = buckets.get(label);
    if (items && items.length > 0) {
      groups.push({
        label,
        items: items.map((v) => ({
          value: v,
          label: v
            .split("_")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" "),
        })),
      });
      buckets.delete(label);
    }
  }
  // Any remaining (shouldn't happen with ORDER covering all, but be safe)
  for (const [label, items] of buckets) {
    groups.push({
      label,
      items: items.map((v) => ({
        value: v,
        label: v
          .split("_")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" "),
      })),
    });
  }

  return groups;
}

function stringArrayToSingleGroup(
  items: string[],
  groupLabel: string,
): GroupedSelectGroup[] {
  return [
    {
      label: groupLabel,
      items: items.map((v) => ({
        value: v,
        label: v
          .split("_")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" "),
      })),
    },
  ];
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface OptionSelectFieldProps {
  /** The artifact field being edited. Drives option source and grouping. */
  field: OptionSelectFieldName;
  /** Current persisted enum value. */
  value: string;
  /**
   * Called with the newly selected enum value.
   * Caller wraps this with saveScalar(field, v) from useFieldEditSave.
   */
  onSave: (newValue: string) => Promise<void>;
  disabled?: boolean;
  /** Accessible label for the select control. Defaults to a humanised field name. */
  label?: string;
  className?: string;
  placeholder?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OptionSelectField({
  field,
  value,
  onSave,
  disabled = false,
  label,
  className,
  placeholder,
}: OptionSelectFieldProps) {
  // Dynamic option hooks (only active when the field needs them).
  const { data: statusData, isLoading: statusLoading } = useStatusOptions();
  const { data: typeData, isLoading: typeLoading } = useArtifactTypeOptions();
  const { data: workspaceData, isLoading: workspaceLoading } = useWorkspaceOptions();

  // ---- Optimistic local value -------------------------------------------
  const [localValue, setLocalValue] = useState(value);
  const [saving, setSaving] = useState(false);

  // Sync when the controlled prop changes externally (e.g. parent rollback).
  React.useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // ---- Build group options -----------------------------------------------
  const groups = useMemo<GroupedSelectGroup[]>(() => {
    switch (field) {
      case "status":
        // If dynamic fetch is available, use it; otherwise fall back to static.
        if (statusData && statusData.length > 0) {
          return stringArrayToSingleGroup(statusData, "Status");
        }
        return STATUS_GROUPS;

      case "type":
        if (typeData && typeData.length > 0) {
          return groupArtifactTypes(typeData);
        }
        return [];

      case "workspace":
        if (workspaceData && workspaceData.length > 0) {
          return stringArrayToSingleGroup(workspaceData, "Workspace");
        }
        return WORKSPACE_GROUPS;

      case "subtype":
        return SUBTYPE_GROUPS;

      case "freshness_class":
        return FRESHNESS_GROUPS;

      case "verification_status":
        return VERIFICATION_GROUPS;

      case "publish_state":
        return PUBLISH_STATE_GROUPS;

      default:
        return [];
    }
  }, [field, statusData, typeData, workspaceData]);

  // ---- Loading state (only for dynamic fields) ---------------------------
  const isLoading =
    (field === "status" && statusLoading) ||
    (field === "type" && typeLoading) ||
    (field === "workspace" && workspaceLoading);

  // ---- Save handler -------------------------------------------------------
  const handleValueChange = useCallback(
    async (newValue: string) => {
      const prev = localValue;
      setLocalValue(newValue);
      setSaving(true);
      try {
        await onSave(newValue);
      } catch {
        setLocalValue(prev);
      } finally {
        setSaving(false);
      }
    },
    [localValue, onSave],
  );

  // ---- Derived label ------------------------------------------------------
  const ariaLabel =
    label ??
    field
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

  const defaultPlaceholder =
    placeholder ??
    `Select ${ariaLabel.toLowerCase()}…`;

  // ---- Loading skeleton ---------------------------------------------------
  if (isLoading) {
    return (
      <div
        role="status"
        aria-label={ariaLabel}
        className={cn(
          "flex min-h-[44px] items-center rounded-md border border-input bg-transparent px-3",
          "animate-pulse",
          className,
        )}
      >
        <span className="h-3 w-28 rounded bg-muted" />
      </div>
    );
  }

  return (
    <div className={cn("relative min-h-[44px] w-full", className)}>
      <GroupedSelect
        groups={groups}
        value={localValue || undefined}
        onValueChange={(v) => void handleValueChange(v)}
        placeholder={defaultPlaceholder}
        disabled={disabled || saving}
        className={cn("min-h-[44px] w-full", saving && "opacity-70")}
      />

      {saving && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-9 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary"
        />
      )}
    </div>
  );
}
