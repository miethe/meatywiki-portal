"use client";

/**
 * ArtifactSearchDialog — rich artifact picker dialog (Portal v2.6 P2-02).
 *
 * Mounts on top of src/components/ui/dialog.tsx (local, no Radix).
 * Uses @miethe/ui primitives: Badge (/primitives), SearchableCombobox (/primitives),
 * TagFilterPopover (/filters), Popover (/primitives), ScrollArea (/primitives).
 * Local-only component: ArtifactResultRow (rich result row — documented gap).
 *
 * Modes:
 *   single — clicking a row calls onSelect([artifact]) and closes the dialog.
 *   multi  — clicking a row toggles selection; "Confirm" button commits.
 *
 * Search:
 *   - Backed by search() from src/lib/api/search.ts (fts/semantic/hybrid).
 *   - Cursor pagination: "Load more" appends next page.
 *   - Graceful semantic degrade: EmbeddingsNotReadyError falls back to fts
 *     silently (search client may also return degraded=true; both handled).
 *
 * Filters (from useFieldOptions hooks + search facets):
 *   - type: artifact type multi-select via local CheckboxPopover
 *   - workspace: workspace multi-select via local CheckboxPopover
 *   - tags: @miethe/ui TagFilterPopover (from @miethe/ui/filters)
 *
 * Keyboard navigation:
 *   - Arrow Up/Down: navigate result rows
 *   - Enter: select highlighted row (single mode selects+closes; multi toggles)
 *   - Esc: close dialog (handled by Dialog's portal)
 *   - Tab: cycle through filter controls and input
 *
 * WCAG 2.1 AA: role="dialog" on outer, role="listbox" on result list,
 * role="option" on each row, aria-selected, aria-activedescendant, focus trap
 * via dialog.tsx, no colour-only affordances.
 *
 * TS strict: no `any` types. All generics are explicit.
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useId,
  useMemo,
} from "react";
import {
  Search,
  X,
  ChevronDown,
  Check,
  Loader2,
  AlertTriangle,
  SlidersHorizontal,
} from "lucide-react";

// @miethe/ui imports — all from published subpath exports
import { Badge } from "@miethe/ui/primitives";
import { ScrollArea } from "@miethe/ui/primitives";
import { Popover, PopoverContent, PopoverTrigger } from "@miethe/ui/primitives";
import { TagFilterPopover } from "@miethe/ui/filters";
import type { AvailableTag } from "@miethe/ui/filters";

// Local UI primitives
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Local domain
import { cn } from "@/lib/utils";
import {
  search as searchApi,
  isEmbeddingsNotReadyError,
} from "@/lib/api/search";
import type { SearchMode } from "@/lib/api/search";
import type { ArtifactCard } from "@/types/artifact";
import {
  useArtifactTypeOptions,
  useWorkspaceOptions,
  useTagOptions,
} from "@/hooks/useFieldOptions";
import type { TagOption } from "@/lib/api/field-options";

// Local rich result row (documented @miethe/ui gap)
import { ArtifactResultRow } from "./ArtifactResultRow";

// ---------------------------------------------------------------------------
// Public props API
// ---------------------------------------------------------------------------

export type ArtifactSearchDialogMode = "single" | "multi";

export interface ArtifactSearchDialogProps {
  /** Controls dialog visibility. */
  open: boolean;
  /** Called when the dialog requests to close (Esc, backdrop, or after single-select). */
  onOpenChange: (open: boolean) => void;
  /**
   * Callback invoked with the selected artifact(s).
   *   single mode: called immediately on row click with a one-element array.
   *   multi mode: called when the user presses "Confirm selection".
   */
  onSelect: (artifacts: ArtifactCard[]) => void;
  /** Selection mode — defaults to "single". */
  mode?: ArtifactSearchDialogMode;
  /** Optional dialog heading. Defaults to mode-appropriate text. */
  title?: string;
  /**
   * Initial search mode. Defaults to "fts".
   * The dialog degrades automatically to "fts" if embeddings are not ready.
   */
  searchMode?: SearchMode;
  /**
   * Pre-filter: lock the type filter to these values on open.
   * User cannot change the type filter when this is set.
   */
  lockedTypes?: string[];
  /**
   * Pre-filter: lock the workspace filter on open.
   * User cannot change the workspace filter when this is set.
   */
  lockedWorkspaces?: string[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const RESULT_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

/**
 * A lightweight multi-select popover for string-valued filter arrays.
 * Used for type and workspace filters (no per-option counts).
 */
interface StringFilterPopoverProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
  className?: string;
}

function StringFilterPopover({
  label,
  options,
  selected,
  onChange,
  disabled = false,
  className,
}: StringFilterPopoverProps) {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(
    (value: string) => {
      if (selected.includes(value)) {
        onChange(selected.filter((v) => v !== value));
      } else {
        onChange([...selected, value]);
      }
    },
    [selected, onChange],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn("gap-1.5 text-xs", className)}
          aria-label={`Filter by ${label}${selected.length > 0 ? ` (${selected.length} selected)` : ""}`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          {label}
          {selected.length > 0 && (
            <Badge
              variant="secondary"
              className="ml-0.5 h-4 rounded-full px-1.5 py-0 text-[10px]"
            >
              {selected.length}
            </Badge>
          )}
          <ChevronDown className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <div className="border-b px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">
              Filter by {label}
            </span>
            {selected.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px]"
                onClick={() => onChange([])}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="max-h-52">
          <div
            role="group"
            aria-label={`Filter by ${label}`}
            className="p-1.5"
          >
            {options.length === 0 ? (
              <p className="py-3 text-center text-xs text-muted-foreground">
                No options
              </p>
            ) : (
              options.map((opt) => {
                const checked = selected.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() => toggle(opt)}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors",
                      checked
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/50",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border",
                        checked
                          ? "border-primary bg-primary"
                          : "border-input",
                      )}
                    >
                      {checked && (
                        <Check className="h-2.5 w-2.5 text-primary-foreground" />
                      )}
                    </span>
                    <span className="truncate">{opt}</span>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Active filter pills
// ---------------------------------------------------------------------------

interface FilterPillsProps {
  types: string[];
  workspaces: string[];
  tags: string[];
  onRemoveType: (v: string) => void;
  onRemoveWorkspace: (v: string) => void;
  onRemoveTag: (v: string) => void;
}

function FilterPills({
  types,
  workspaces,
  tags,
  onRemoveType,
  onRemoveWorkspace,
  onRemoveTag,
}: FilterPillsProps) {
  const all = [
    ...types.map((v) => ({ kind: "type" as const, value: v })),
    ...workspaces.map((v) => ({ kind: "workspace" as const, value: v })),
    ...tags.map((v) => ({ kind: "tag" as const, value: v })),
  ];

  if (all.length === 0) return null;

  const removers: Record<"type" | "workspace" | "tag", (v: string) => void> = {
    type: onRemoveType,
    workspace: onRemoveWorkspace,
    tag: onRemoveTag,
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-4 pb-2">
      <span className="text-[10px] text-muted-foreground">Active:</span>
      {all.map(({ kind, value }) => (
        <span
          key={`${kind}:${value}`}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-px text-[10px] leading-tight text-secondary-foreground"
        >
          <span className="text-muted-foreground">{kind}:</span>
          {value}
          <button
            type="button"
            aria-label={`Remove ${kind} filter: ${value}`}
            onClick={() => removers[kind](value)}
            className="ml-0.5 rounded-full hover:text-foreground"
          >
            <X className="h-2.5 w-2.5" aria-hidden="true" />
          </button>
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ArtifactSearchDialog({
  open,
  onOpenChange,
  onSelect,
  mode = "single",
  title,
  searchMode: initialSearchMode = "fts",
  lockedTypes,
  lockedWorkspaces,
}: ArtifactSearchDialogProps) {
  // --- Field option hooks ---
  const { data: typeOptions = [] } = useArtifactTypeOptions();
  const { data: workspaceOptions = [] } = useWorkspaceOptions();
  const { data: tagOptions = [] } = useTagOptions();

  // Convert TagOption[] → AvailableTag[] for @miethe/ui TagFilterPopover
  const availableTags = useMemo<AvailableTag[]>(
    () =>
      (tagOptions as TagOption[]).map((t) => ({
        name: t.name,
        artifact_count: t.count,
      })),
    [tagOptions],
  );

  // --- Local state ---
  const [query, setQuery] = useState("");
  const [effectiveMode, setEffectiveMode] = useState<SearchMode>(initialSearchMode);
  const [degraded, setDegraded] = useState(false);

  // Filters
  const [selectedTypes, setSelectedTypes] = useState<string[]>(
    lockedTypes ?? [],
  );
  const [selectedWorkspaces, setSelectedWorkspaces] = useState<string[]>(
    lockedWorkspaces ?? [],
  );
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Results
  const [results, setResults] = useState<ArtifactCard[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selection (multi mode)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedMap = useMemo<Map<string, ArtifactCard>>(() => {
    const m = new Map<string, ArtifactCard>();
    for (const a of results) {
      if (selectedIds.has(a.id)) m.set(a.id, a);
    }
    return m;
  }, [results, selectedIds]);

  // Keyboard navigation
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const listboxId = useId();
  const degradedAnnouncerId = useId();
  const getOptionId = useCallback(
    (index: number) => `${listboxId}-option-${index}`,
    [listboxId],
  );

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  // Tracks whether the open-triggered initial search has already fired so the
  // filter-change effect does not issue a second identical request on mount.
  const didInitialSearchRef = useRef(false);

  // isMountedRef is driven exclusively by mount/unmount — never by open/close.
  // This prevents executeSearch from early-returning while the component is
  // still mounted but the dialog happens to be closing.
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    };
  }, []);

  // Reset when dialog opens/closes
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setCursor(null);
      setError(null);
      setDegraded(false);
      setHighlightedIndex(-1);
      setSelectedIds(new Set());
      setEffectiveMode(initialSearchMode);
      setSelectedTypes(lockedTypes ?? []);
      setSelectedWorkspaces(lockedWorkspaces ?? []);
      setSelectedTags([]);
      // Mark that the initial search has not yet fired for this open cycle.
      didInitialSearchRef.current = false;
      // Focus input on open
      requestAnimationFrame(() => searchInputRef.current?.focus());
      // Fire the single initial search to populate the browse-all list.
      void executeSearch("", initialSearchMode, null).then(() => {
        didInitialSearchRef.current = true;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialSearchMode, lockedTypes, lockedWorkspaces]);

  // ---------------------------------------------------------------------------
  // Client-side filter application over results
  // The backend search() API accepts q + mode + cursor + limit only.
  // Type / workspace / tag filters are applied client-side over fetched results.
  // Tags are matched against ArtifactCard.tags (populated from frontmatter).
  // ---------------------------------------------------------------------------

  const filteredResults = useMemo<ArtifactCard[]>(() => {
    let r = results;
    if (selectedTypes.length > 0) {
      r = r.filter((a) => selectedTypes.includes(a.type));
    }
    if (selectedWorkspaces.length > 0) {
      r = r.filter((a) => selectedWorkspaces.includes(a.workspace));
    }
    if (selectedTags.length > 0) {
      // Match against real ArtifactCard.tags from frontmatter.
      r = r.filter((a) =>
        (a.tags ?? []).some((t) => selectedTags.includes(t)),
      );
    }
    return r;
  }, [results, selectedTypes, selectedWorkspaces, selectedTags]);

  // ---------------------------------------------------------------------------
  // Search execution
  // ---------------------------------------------------------------------------

  const executeSearch = useCallback(
    async (q: string, mode: SearchMode, replaceCursor: string | null = null) => {
      const isFirstPage = replaceCursor === null;
      if (isFirstPage) {
        setIsLoading(true);
        setResults([]);
        setCursor(null);
      } else {
        setIsLoadingMore(true);
      }
      setError(null);

      try {
        const res = await searchApi({
          // Backend requires non-empty q; use "*" as browse-all sentinel which
          // FTS5 tokenises to "match everything" instead of an empty match set.
          q: q.trim() || "*",
          mode,
          cursor: replaceCursor ?? undefined,
          limit: RESULT_PAGE_SIZE,
        });

        if (!isMountedRef.current) return;

        if (isFirstPage) {
          setResults(res.data);
        } else {
          setResults((prev) => [...prev, ...res.data]);
        }
        setCursor(res.cursor ?? null);
        if (res.degraded) setDegraded(true);
      } catch (err) {
        if (!isMountedRef.current) return;
        if (isEmbeddingsNotReadyError(err)) {
          // Graceful degrade: retry as fts
          setDegraded(true);
          setEffectiveMode("fts");
          if (mode !== "fts") {
            void executeSearch(q, "fts", null);
            return;
          }
          setError("Embeddings not ready — showing text search results.");
        } else {
          setError(
            err instanceof Error ? err.message : "Search failed. Please try again.",
          );
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [],
  );

  // Scroll highlighted option into view when keyboard navigating inside ScrollArea.
  useEffect(() => {
    if (highlightedIndex < 0 || !listboxRef.current) return;
    const optionEl = listboxRef.current.querySelector<HTMLElement>(
      `#${CSS.escape(getOptionId(highlightedIndex))}`,
    );
    optionEl?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex, getOptionId]);

  // Debounced query trigger
  const triggerSearch = useCallback(
    (q: string) => {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void executeSearch(q, effectiveMode, null);
      }, SEARCH_DEBOUNCE_MS);
    },
    [effectiveMode, executeSearch],
  );

  // Fire search when filters or mode change (no debounce — user action).
  // Guard with didInitialSearchRef so this effect does not issue a second
  // identical request when React runs it on the same render cycle as the
  // open-driven initial search (which sets didInitialSearchRef to true first).
  useEffect(() => {
    if (!open) return;
    // Skip if the initial search for this open cycle hasn't completed yet —
    // the open effect already owns the first search.
    if (!didInitialSearchRef.current) return;
    if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    void executeSearch(query, effectiveMode, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTypes, selectedWorkspaces, selectedTags, effectiveMode, open]);

  // ---------------------------------------------------------------------------
  // Interaction handlers
  // ---------------------------------------------------------------------------

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const q = e.target.value;
      setQuery(q);
      setHighlightedIndex(-1);
      triggerSearch(q);
    },
    [triggerSearch],
  );

  const handleSelectArtifact = useCallback(
    (artifact: ArtifactCard) => {
      if (mode === "single") {
        onSelect([artifact]);
        onOpenChange(false);
      } else {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(artifact.id)) {
            next.delete(artifact.id);
          } else {
            next.add(artifact.id);
          }
          return next;
        });
      }
    },
    [mode, onSelect, onOpenChange],
  );

  const handleConfirmMulti = useCallback(() => {
    const chosen = [...selectedMap.values()];
    onSelect(chosen);
    onOpenChange(false);
  }, [selectedMap, onSelect, onOpenChange]);

  const handleLoadMore = useCallback(() => {
    if (cursor && !isLoadingMore) {
      void executeSearch(query, effectiveMode, cursor);
    }
  }, [cursor, isLoadingMore, executeSearch, query, effectiveMode]);

  // Keyboard navigation on the search input
  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const count = filteredResults.length;
      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          setHighlightedIndex((prev) => (prev < count - 1 ? prev + 1 : 0));
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : count - 1));
          break;
        }
        case "Enter": {
          if (highlightedIndex >= 0 && highlightedIndex < count) {
            e.preventDefault();
            handleSelectArtifact(filteredResults[highlightedIndex]);
          }
          break;
        }
        default:
          break;
      }
    },
    [filteredResults, highlightedIndex, handleSelectArtifact],
  );

  // ---------------------------------------------------------------------------
  // Derived UI values
  // ---------------------------------------------------------------------------

  const dialogTitle =
    title ?? (mode === "single" ? "Select artifact" : "Select artifacts");

  const activeDescendant =
    highlightedIndex >= 0 && filteredResults.length > 0
      ? getOptionId(highlightedIndex)
      : undefined;

  const hasActiveFilters =
    selectedTypes.length > 0 ||
    selectedWorkspaces.length > 0 ||
    selectedTags.length > 0;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[85vh] w-full max-w-2xl flex-col p-0"
        aria-describedby={undefined}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <DialogHeader className="shrink-0 border-b px-4 pb-0 pt-4">
          <DialogTitle className="sr-only">{dialogTitle}</DialogTitle>

          {/* Search input row */}
          <div className="relative mb-3">
            <Search
              aria-hidden="true"
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              ref={searchInputRef}
              type="search"
              role="combobox"
              aria-expanded={filteredResults.length > 0}
              // aria-controls must only reference an element that exists in the
              // DOM. The listbox ul is only rendered when there are results, so
              // we omit aria-controls while loading/error/empty to avoid a
              // dangling IDREF (ARIA anti-pattern; aria-expanded=false covers
              // the collapsed state for AT).
              aria-controls={filteredResults.length > 0 ? listboxId : undefined}
              aria-activedescendant={activeDescendant}
              aria-autocomplete="list"
              aria-label={dialogTitle}
              value={query}
              onChange={handleQueryChange}
              onKeyDown={handleInputKeyDown}
              placeholder="Search artifacts…"
              className="pl-9 pr-9"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setQuery("");
                  triggerSearch("");
                  searchInputRef.current?.focus();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Filter bar */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <StringFilterPopover
              label="Type"
              options={typeOptions}
              selected={selectedTypes}
              onChange={setSelectedTypes}
              disabled={!!lockedTypes}
            />
            <StringFilterPopover
              label="Workspace"
              options={workspaceOptions}
              selected={selectedWorkspaces}
              onChange={setSelectedWorkspaces}
              disabled={!!lockedWorkspaces}
            />
            <TagFilterPopover
              selectedTags={selectedTags}
              onChange={setSelectedTags}
              availableTags={availableTags}
            />

            {/* Mode indicator */}
            {degraded && (
              <Badge
                variant="secondary"
                className="ml-auto gap-1 text-[10px] text-amber-700 dark:text-amber-400"
              >
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                Text-only
              </Badge>
            )}
            {/* Screen-reader live region: announces when semantic search
                degrades to text-only AFTER initial render (silent visual
                badge change alone is not perceived by AT). */}
            <span
              id={degradedAnnouncerId}
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="sr-only"
            >
              {degraded ? "Semantic search unavailable — showing text-only results." : ""}
            </span>
          </div>
        </DialogHeader>

        {/* ── Active filter pills ─────────────────────────────────────── */}
        {hasActiveFilters && (
          <FilterPills
            types={selectedTypes}
            workspaces={selectedWorkspaces}
            tags={selectedTags}
            onRemoveType={(v) =>
              setSelectedTypes((prev) => prev.filter((x) => x !== v))
            }
            onRemoveWorkspace={(v) =>
              setSelectedWorkspaces((prev) => prev.filter((x) => x !== v))
            }
            onRemoveTag={(v) =>
              setSelectedTags((prev) => prev.filter((x) => x !== v))
            }
          />
        )}

        {/* ── Results list ────────────────────────────────────────────── */}
        <div className="min-h-0 flex-1 overflow-hidden">
          {isLoading ? (
            <div
              role="status"
              aria-live="polite"
              className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"
            >
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Searching…
            </div>
          ) : error ? (
            <div
              role="alert"
              className="flex items-center gap-2 px-4 py-8 text-sm text-amber-700 dark:text-amber-400"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </div>
          ) : filteredResults.length === 0 ? (
            <div
              role="status"
              aria-live="polite"
              className="py-12 text-center text-sm text-muted-foreground"
            >
              {query || hasActiveFilters
                ? "No artifacts match your search."
                : "Start typing to search artifacts…"}
            </div>
          ) : (
            <ScrollArea className="h-full max-h-[50vh]">
              <ul
                ref={listboxRef}
                id={listboxId}
                role="listbox"
                aria-label={dialogTitle}
                aria-multiselectable={mode === "multi"}
                className="py-1"
              >
                {filteredResults.map((artifact, index) => (
                  <ArtifactResultRow
                    key={artifact.id}
                    artifact={artifact}
                    selected={selectedIds.has(artifact.id)}
                    highlighted={index === highlightedIndex}
                    optionId={getOptionId(index)}
                    onMouseDown={(e) => {
                      // Prevent input blur before click processes
                      e.preventDefault();
                      handleSelectArtifact(artifact);
                    }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  />
                ))}
              </ul>

              {/* Pagination */}
              {cursor && (
                <div className="px-4 py-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    aria-label="Load more results"
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2
                          className="mr-1.5 h-3.5 w-3.5 animate-spin"
                          aria-hidden="true"
                        />
                        Loading…
                      </>
                    ) : (
                      "Load more"
                    )}
                  </Button>
                </div>
              )}
            </ScrollArea>
          )}
        </div>

        {/* ── Footer — multi mode confirm / selection count ───────────── */}
        {mode === "multi" && (
          <div className="flex shrink-0 items-center justify-between border-t px-4 py-3">
            <span className="text-xs text-muted-foreground" aria-live="polite">
              {selectedIds.size === 0
                ? "No artifacts selected"
                : `${selectedIds.size} artifact${selectedIds.size === 1 ? "" : "s"} selected`}
            </span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmMulti}
                disabled={selectedIds.size === 0}
                aria-label={`Confirm selection of ${selectedIds.size} artifact${selectedIds.size === 1 ? "" : "s"}`}
              >
                Confirm
                {selectedIds.size > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1.5 h-4 rounded-full px-1.5 py-0 text-[10px]"
                  >
                    {selectedIds.size}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
