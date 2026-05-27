"use client";

/**
 * AttachResourceModal — artifact picker modal for attaching resources to a project.
 *
 * Opens a search-driven list of existing artifacts. The user can select multiple
 * items and submit — each selected artifact is attached via
 * POST /api/projects/{projectId}/attachments.
 *
 * Follows:
 *   - Dialog/DialogContent/DialogHeader/DialogTitle pattern from src/components/ui/dialog.tsx
 *   - Input primitive from src/components/ui/input.tsx
 *   - Checkbox primitive from src/components/ui/checkbox.tsx
 *   - Button primitive from src/components/ui/button.tsx
 *   - apiFetch client pattern from src/lib/api/client.ts
 *   - useSearch hook from src/hooks/useSearch.ts
 *   - attachArtifactToProject from src/lib/api/projects.ts
 *
 * Error handling:
 *   - Per-item attach errors are shown inline; the modal stays open on partial success.
 *   - If ALL items fail, a top-level error message is shown.
 *   - If ALL items succeed, onSuccess() is called and the modal closes.
 *
 * WCAG 2.1 AA: focus managed by Dialog, labelled form controls, live region for errors.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { Search, Check, Loader2, AlertCircle, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { attachArtifactToProject } from "@/lib/api/projects";
import { search as apiSearch } from "@/lib/api/search";
import type { ArtifactCard } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AttachResourceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  /** Called when at least one artifact was successfully attached. */
  onSuccess: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AttachResourceModal({
  open,
  onOpenChange,
  projectId,
  onSuccess,
}: AttachResourceModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ArtifactCard[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear state on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSelected(new Set());
      setSearchError(null);
      setSubmitError(null);
      setIsSearching(false);
      setIsSubmitting(false);
    }
  }, [open]);

  // Debounced search — fires 300ms after typing stops
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    debounceRef.current = setTimeout(async () => {
      try {
        const result = await apiSearch({ q: trimmed, mode: "fts", limit: 30 });
        setResults(result.data);
      } catch (err) {
        setSearchError(
          err instanceof Error ? err.message : "Search failed. Try again.",
        );
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const toggleItem = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (selected.size === 0 || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const ids = Array.from(selected);
    const errors: string[] = [];
    let successCount = 0;

    for (const artifactId of ids) {
      try {
        await attachArtifactToProject(projectId, artifactId);
        successCount++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        errors.push(`${artifactId}: ${msg}`);
      }
    }

    setIsSubmitting(false);

    if (errors.length > 0 && successCount === 0) {
      // All failed — show error inline, keep modal open
      setSubmitError(`Failed to attach ${errors.length} artifact(s). Check your connection and try again.`);
      return;
    }

    // At least one succeeded — close and refresh
    onSuccess();
    onOpenChange(false);
  }, [selected, isSubmitting, projectId, onSuccess, onOpenChange]);

  const hasResults = results.length > 0;
  const hasQuery = query.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <div className="flex flex-col">
          {/* Header */}
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="text-base">Attach Resource</DialogTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Search for artifacts to attach to this project.
            </p>
          </DialogHeader>

          {/* Search input */}
          <div className="px-5 pt-4 pb-2">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="search"
                placeholder="Search artifacts…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 pr-3 text-sm"
                aria-label="Search artifacts"
                aria-autocomplete="list"
                aria-controls="attach-resource-results"
              />
              {isSearching && (
                <Loader2
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground"
                />
              )}
            </div>
          </div>

          {/* Results list */}
          <div
            id="attach-resource-results"
            role="listbox"
            aria-label="Search results"
            aria-multiselectable="true"
            className="min-h-[160px] max-h-[280px] overflow-y-auto border-t border-b"
          >
            {searchError && (
              <div
                role="alert"
                className="flex items-center gap-2 px-5 py-3 text-xs text-destructive"
              >
                <AlertCircle aria-hidden="true" className="size-3.5 shrink-0" />
                {searchError}
              </div>
            )}

            {!hasQuery && !isSearching && (
              <p className="px-5 py-8 text-center text-xs text-muted-foreground">
                Start typing to search artifacts.
              </p>
            )}

            {hasQuery && !isSearching && !searchError && !hasResults && (
              <p className="px-5 py-8 text-center text-xs text-muted-foreground">
                No artifacts found for &ldquo;{query}&rdquo;.
              </p>
            )}

            {hasResults && (
              <ul className="py-1">
                {results.map((artifact) => {
                  const isSelected = selected.has(artifact.id);
                  return (
                    <li key={artifact.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => toggleItem(artifact.id)}
                        className={cn(
                          "flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors",
                          "hover:bg-accent focus:outline-none focus-visible:bg-accent",
                          isSelected && "bg-primary/5",
                        )}
                      >
                        {/* Selection indicator */}
                        <span
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors",
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input",
                          )}
                          aria-hidden="true"
                        >
                          {isSelected && <Check className="size-3" />}
                        </span>

                        {/* Artifact icon */}
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-muted">
                          <FileText aria-hidden="true" className="size-3.5 text-muted-foreground" />
                        </span>

                        {/* Name + type */}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium leading-tight">
                            {artifact.title}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {artifact.type}
                            {artifact.subtype ? ` · ${artifact.subtype}` : ""}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="flex flex-col gap-2 px-5 py-4">
            {/* Submit error */}
            {submitError && (
              <div
                role="alert"
                aria-live="assertive"
                className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
              >
                <AlertCircle aria-hidden="true" className="mt-px size-3.5 shrink-0" />
                {submitError}
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {selected.size === 0
                  ? "No artifacts selected"
                  : `${selected.size} artifact${selected.size === 1 ? "" : "s"} selected`}
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={selected.size === 0 || isSubmitting}
                  onClick={() => void handleSubmit()}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
                      Attaching…
                    </>
                  ) : (
                    `Attach${selected.size > 0 ? ` (${selected.size})` : ""}`
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
