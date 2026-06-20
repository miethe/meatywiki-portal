"use client";

/**
 * ProjectComboboxField — inline-edit combobox for the `project` field.
 *
 * Renders the @miethe/ui SearchableCombobox bound to the site-wide
 * useProjectOptions() list.  Selection triggers an optimistic save via the
 * caller-supplied `onSave` handler; rollback and toast are the caller's
 * responsibility (handled by useFieldEditSave in ArtifactDetailClient).
 *
 * Features
 * --------
 * - Site-wide project option set from GET /api/field-options/projects.
 * - Client-side substring filter: the combobox's onSearch callback filters
 *   the already-fetched option list (no extra network round-trips).
 * - Displays `project.name (N artifacts)` per option; "No project" entry
 *   allows clearing the field.
 * - Current selection shown in the input; cleared input shows all projects.
 * - Optimistic update: onSave is called immediately on selection.
 * - Loading skeleton while options are fetching.
 * - Keyboard-accessible: all SearchableCombobox arrow/enter/escape handling
 *   is provided by @miethe/ui.
 *
 * Props
 * -----
 *   currentProjectId  — current persisted project ID (null = no project)
 *   currentProjectName — display name for the current project (optional;
 *                        resolved from option list if absent)
 *   onSave            — async handler; receives new project ID string (or
 *                       empty string to clear)
 *   disabled          — disable interaction
 *   label             — aria-label forwarded to combobox
 *
 * Option source: useProjectOptions() → ProjectOption[] (id, name, artifact_count)
 * Save field:    "project" via useFieldEditSave.saveScalar
 *
 * Portal v2.6 Phase 2 (P2-03).
 */

import React, { useCallback, useMemo, useState } from "react";
import { SearchableCombobox } from "@miethe/ui";
import { cn } from "@/lib/utils";
import { useProjectOptions } from "@/hooks/useFieldOptions";
import type { ProjectOption } from "@/lib/api/field-options";

// ---------------------------------------------------------------------------
// Internal option shape (adds a "clear" sentinel)
// ---------------------------------------------------------------------------

interface ProjectEntry {
  id: string;
  name: string;
  artifact_count: number;
  /** True for the synthetic "No project" clearing option. */
  isClear: boolean;
}

const CLEAR_ENTRY: ProjectEntry = {
  id: "",
  name: "No project",
  artifact_count: 0,
  isClear: true,
};

function toEntry(opt: ProjectOption): ProjectEntry {
  return { id: opt.id, name: opt.name, artifact_count: opt.artifact_count, isClear: false };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ProjectComboboxFieldProps {
  /** Current persisted project ID; null or "" when unset. */
  currentProjectId: string | null;
  /**
   * Display name for the current project.  When not supplied the component
   * resolves the name from the fetched options list.
   */
  currentProjectName?: string | null;
  /**
   * Called with the newly selected project ID on selection.
   * Caller assembles and calls `saveScalar("project", projectId)`.
   * Pass "" to clear the project link.
   */
  onSave: (projectId: string) => Promise<void>;
  disabled?: boolean;
  label?: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProjectComboboxField({
  currentProjectId,
  currentProjectName,
  onSave,
  disabled = false,
  label = "Project",
  className,
}: ProjectComboboxFieldProps) {
  const { data: options, isLoading } = useProjectOptions();

  // ---- filter state -------------------------------------------------------
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  // All project entries (with clear sentinel at the top).
  const allEntries = useMemo<ProjectEntry[]>(() => {
    if (!options) return [CLEAR_ENTRY];
    return [CLEAR_ENTRY, ...options.map(toEntry)];
  }, [options]);

  // Client-side substring filter.
  const filteredEntries = useMemo<ProjectEntry[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allEntries;
    return allEntries.filter((e) =>
      e.isClear ? true : e.name.toLowerCase().includes(q),
    );
  }, [allEntries, query]);

  // ---- display label of the current selection ----------------------------
  const displayLabel = useMemo<string>(() => {
    if (!currentProjectId) return "";
    if (currentProjectName) return currentProjectName;
    const match = options?.find((o) => o.id === currentProjectId);
    return match?.name ?? currentProjectId;
  }, [currentProjectId, currentProjectName, options]);

  // ---- handlers -----------------------------------------------------------
  const handleSearch = useCallback((q: string) => {
    setQuery(q);
  }, []);

  const handleSelect = useCallback(
    async (entry: ProjectEntry) => {
      setSaving(true);
      try {
        await onSave(entry.id);
      } finally {
        setSaving(false);
        setQuery("");
      }
    },
    [onSave],
  );

  // ---- render item --------------------------------------------------------
  const renderItem = useCallback((entry: ProjectEntry) => {
    if (entry.isClear) {
      return (
        <span className="italic text-muted-foreground">No project</span>
      );
    }
    return (
      <span className="flex w-full items-center justify-between gap-2">
        <span className="truncate">{entry.name}</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {entry.artifact_count}
        </span>
      </span>
    );
  }, []);

  // ---- loading skeleton ---------------------------------------------------
  if (isLoading) {
    return (
      <div
        role="status"
        aria-label={label}
        className={cn(
          "flex min-h-[44px] items-center rounded-md border border-input bg-transparent px-3",
          "animate-pulse",
          className,
        )}
      >
        <span className="h-3 w-32 rounded bg-muted" />
      </div>
    );
  }

  return (
    <div className={cn("relative w-full", className)}>
      {/* Current selection chip (shown above the combobox when set) */}
      {currentProjectId && !query && (
        <div className="mb-1 flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center rounded-full border border-border/60 bg-accent/40 px-2 py-0.5",
              "text-xs font-medium text-foreground/80",
            )}
          >
            {displayLabel}
          </span>
        </div>
      )}

      <SearchableCombobox<ProjectEntry>
        items={filteredEntries}
        onSearch={handleSearch}
        onSelect={(entry) => void handleSelect(entry)}
        renderItem={renderItem}
        getItemKey={(e) => e.id || "__clear__"}
        placeholder={currentProjectId ? "Change project…" : "Assign project…"}
        emptyMessage="No matching projects"
        aria-label={label}
        disabled={disabled || saving}
      />

      {saving && (
        <span
          aria-hidden="true"
          className="absolute right-9 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary"
        />
      )}
    </div>
  );
}
