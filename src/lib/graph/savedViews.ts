/**
 * savedViews.ts — localStorage CRUD for named graph view snapshots.
 *
 * Storage key: "mw-graph-views"
 * Each entry captures filter state + optional camera preset + optional grouping,
 * so a user can jump back to a precise exploration context.
 *
 * SSR-safe: all localStorage access is guarded by `typeof window !== 'undefined'`.
 *
 * v2.2 — graph explorer saved views (P3-06).
 */

import type { GraphFiltersValues } from "@/components/graph/GraphFilters";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SavedView {
  /** Stable UUID for this view (crypto.randomUUID or Date.now fallback). */
  id: string;
  /** User-supplied display name. */
  name: string;
  /** Full filter state snapshot at save time. */
  filter: GraphFiltersValues;
  /** Camera preset name ("default", "recent-activity", etc.) or null. */
  cameraPreset: string | null;
  /** Grouping dimension key (P3-09) or null until that phase ships. */
  grouping: string | null;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
}

/** Patch type for updateSavedView — all fields optional except id. */
export type SavedViewPatch = Partial<Omit<SavedView, "id" | "createdAt">>;

// ---------------------------------------------------------------------------
// Storage key
// ---------------------------------------------------------------------------

const STORAGE_KEY = "mw-graph-views";

// ---------------------------------------------------------------------------
// SSR-safe helpers
// ---------------------------------------------------------------------------

function readStore(): SavedView[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as SavedView[];
  } catch {
    return [];
  }
}

function writeStore(views: SavedView[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
  } catch {
    // Storage quota exceeded or private browsing — silently swallow.
    console.warn("[savedViews] Failed to persist saved views to localStorage.");
  }
}

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `view-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return all user-saved views in insertion order.
 * Returns an empty array in SSR contexts.
 */
export function listSavedViews(): SavedView[] {
  return readStore();
}

/**
 * Persist a new named view snapshot.
 * Returns the created SavedView (including the generated id + createdAt).
 */
export function saveView(params: {
  name: string;
  filter: GraphFiltersValues;
  cameraPreset: string | null;
  grouping: string | null;
}): SavedView {
  const view: SavedView = {
    id: generateId(),
    name: params.name.trim() || "Untitled view",
    filter: params.filter,
    cameraPreset: params.cameraPreset,
    grouping: params.grouping,
    createdAt: new Date().toISOString(),
  };
  const views = readStore();
  views.push(view);
  writeStore(views);
  return view;
}

/**
 * Delete a user-saved view by id.
 * No-ops if the id is not found (idempotent).
 */
export function deleteSavedView(id: string): void {
  const views = readStore().filter((v) => v.id !== id);
  writeStore(views);
}

/**
 * Patch one or more fields on an existing user-saved view.
 * No-ops if the id is not found.
 * `id` and `createdAt` cannot be patched.
 */
export function updateSavedView(id: string, patch: SavedViewPatch): void {
  const views = readStore().map((v) => {
    if (v.id !== id) return v;
    return {
      ...v,
      ...patch,
      // Immutable fields — never overwritten
      id: v.id,
      createdAt: v.createdAt,
    };
  });
  writeStore(views);
}
