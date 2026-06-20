/**
 * Pure filter/sort utilities for the Projects workspace.
 *
 * Extracted from page.tsx so they can be exported without violating the
 * Next.js route-module shape constraint (route modules must not export
 * arbitrary value symbols — only recognised named exports like `default`,
 * `metadata`, `generateStaticParams`, etc.).
 *
 * Import from here in both page.tsx and unit tests.
 */

import type { ContextPack } from "@/types/projects";

/** The three available sort dimensions for the project list. */
export type ProjectSortKey = "name" | "artifact_count" | "updated_at";

/** Named filter presets that narrow the project list. */
export type ProjectFilterKey = "all" | "has-intent" | "non-empty";

/**
 * Apply the active filter predicate to a project list.
 *
 * Filter predicates:
 *   all        → pass-through
 *   has-intent → root_intent_id is present and non-null
 *   non-empty  → artifact_count > 0
 */
export function applyFilter(
  packs: ContextPack[],
  filter: ProjectFilterKey,
): ContextPack[] {
  switch (filter) {
    case "has-intent":
      return packs.filter((p) => Boolean(p.root_intent_id));
    case "non-empty":
      return packs.filter((p) => p.artifact_count > 0);
    case "all":
    default:
      return packs;
  }
}

/**
 * Sort a project list by the given sort key.
 *
 * Sort behaviours:
 *   name           → lexicographic A–Z (locale-aware, case-insensitive)
 *   artifact_count → descending (highest first)
 *   updated_at     → most-recently-updated first (falls back to created_at)
 */
export function applySort(packs: ContextPack[], sort: ProjectSortKey): ContextPack[] {
  return [...packs].sort((a, b) => {
    switch (sort) {
      case "name":
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      case "artifact_count":
        return b.artifact_count - a.artifact_count;
      case "updated_at": {
        const ta = a.updated_at ?? a.created_at ?? "";
        const tb = b.updated_at ?? b.created_at ?? "";
        return tb.localeCompare(ta);
      }
    }
  });
}
