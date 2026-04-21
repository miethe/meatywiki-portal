"use client";

/**
 * SynthesisArtifactPicker — Step 1 artifact grid picker for the Synthesis
 * Builder 2-step wizard (ADR-DPI-005 Option A).
 *
 * Renders a filterable, sortable grid of artifacts with multi-select state.
 * A textarea fallback ("Enter IDs manually") is always available so the
 * picker works without a live search endpoint.
 *
 * ## Data strategy
 *
 * Calls GET /api/artifacts with filter/sort params to populate the grid.
 * Uses the existing `listArtifacts` API wrapper — no new endpoint needed.
 * Research facet is default but user can switch to "library" or "all".
 *
 * ## Endpoint gaps
 *
 * - No full-text search endpoint: search filters client-side over the current
 *   page of artifacts. A future endpoint (GET /api/artifacts?q=) would
 *   enable server-side search. Documented in commit body.
 *
 * ## Multi-select state
 *
 * Parent owns `selectedIds` + `onSelectionChange` — the picker is controlled.
 * Checkbox on each artifact card toggles membership in the set.
 *
 * Tasks: DP4-02d
 * ADR: ADR-DPI-005
 */

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  type ChangeEvent,
} from "react";
import {
  Search,
  LayoutGrid,
  List,
  Loader2,
  AlertCircle,
  CheckSquare,
  Square,
  ChevronDown,
  Edit3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { listArtifacts } from "@/lib/api/artifacts";
import type { ArtifactSortField, SortOrder } from "@/lib/api/artifacts";
import type { ArtifactCard } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PickerViewMode = "grid" | "list";
type PickerFacet = "research" | "library" | "all";
type PickerInputMode = "grid" | "manual";

export interface SynthesisArtifactPickerProps {
  /** Currently selected artifact IDs (controlled). */
  selectedIds: string[];
  /** Fired whenever selection changes. */
  onSelectionChange: (ids: string[]) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Utility: parse raw textarea IDs
// ---------------------------------------------------------------------------

function parseIds(raw: string): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const seg of raw.split(/[\n,]+/)) {
    const t = seg.trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      ids.push(t);
    }
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Sort / filter toolbar
// ---------------------------------------------------------------------------

interface ToolbarProps {
  query: string;
  onQueryChange: (q: string) => void;
  facet: PickerFacet;
  onFacetChange: (f: PickerFacet) => void;
  sort: ArtifactSortField;
  order: SortOrder;
  onSortChange: (sort: ArtifactSortField, order: SortOrder) => void;
  viewMode: PickerViewMode;
  onViewModeChange: (v: PickerViewMode) => void;
  inputMode: PickerInputMode;
  onInputModeChange: (m: PickerInputMode) => void;
  selectedCount: number;
}

const SORT_OPTIONS: { label: string; field: ArtifactSortField; order: SortOrder }[] = [
  { label: "Updated (newest)", field: "updated", order: "desc" },
  { label: "Updated (oldest)", field: "updated", order: "asc" },
  { label: "Created (newest)", field: "created", order: "desc" },
  { label: "Created (oldest)", field: "created", order: "asc" },
  { label: "Title A–Z", field: "title", order: "asc" },
  { label: "Title Z–A", field: "title", order: "desc" },
];

function PickerToolbar({
  query,
  onQueryChange,
  facet,
  onFacetChange,
  sort,
  order,
  onSortChange,
  viewMode,
  onViewModeChange,
  inputMode,
  onInputModeChange,
  selectedCount,
}: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search box — client-side filter over current page */}
      <div className="relative flex-1 min-w-40">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="search"
          aria-label="Filter artifacts by title"
          placeholder="Filter by title…"
          value={query}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onQueryChange(e.target.value)}
          className={cn(
            "h-8 w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-3 text-xs",
            "placeholder:text-muted-foreground",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        />
      </div>

      {/* Facet selector */}
      <div className="relative">
        <select
          aria-label="Filter by workspace"
          value={facet}
          onChange={(e) => onFacetChange(e.target.value as PickerFacet)}
          className={cn(
            "h-8 appearance-none rounded-md border border-input bg-background py-1 pl-2.5 pr-7 text-xs text-foreground",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <option value="research">Research</option>
          <option value="library">Library</option>
          <option value="all">All workspaces</option>
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground"
        />
      </div>

      {/* Sort selector */}
      <div className="relative">
        <select
          aria-label="Sort artifacts"
          value={`${sort}:${order}`}
          onChange={(e) => {
            const [f, o] = e.target.value.split(":") as [ArtifactSortField, SortOrder];
            onSortChange(f, o);
          }}
          className={cn(
            "h-8 appearance-none rounded-md border border-input bg-background py-1 pl-2.5 pr-7 text-xs text-foreground",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={`${opt.field}:${opt.order}`} value={`${opt.field}:${opt.order}`}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground"
        />
      </div>

      {/* View mode toggle */}
      <div role="group" aria-label="View layout" className="flex rounded-md border">
        <button
          type="button"
          aria-label="List view"
          aria-pressed={viewMode === "list"}
          onClick={() => onViewModeChange("list")}
          className={cn(
            "inline-flex h-8 items-center gap-1 rounded-l-md border-r px-2.5 text-xs transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            viewMode === "list"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50",
          )}
        >
          <List aria-hidden="true" className="size-3" />
        </button>
        <button
          type="button"
          aria-label="Grid view"
          aria-pressed={viewMode === "grid"}
          onClick={() => onViewModeChange("grid")}
          className={cn(
            "inline-flex h-8 items-center gap-1 rounded-r-md px-2.5 text-xs transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            viewMode === "grid"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50",
          )}
        >
          <LayoutGrid aria-hidden="true" className="size-3" />
        </button>
      </div>

      {/* Manual ID entry toggle */}
      <button
        type="button"
        aria-label={
          inputMode === "manual" ? "Switch to grid picker" : "Enter IDs manually"
        }
        onClick={() => onInputModeChange(inputMode === "manual" ? "grid" : "manual")}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          inputMode === "manual"
            ? "border-primary bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-accent/50",
        )}
      >
        <Edit3 aria-hidden="true" className="size-3" />
        {inputMode === "manual" ? "Grid" : "Enter IDs"}
      </button>

      {/* Selection count badge */}
      {selectedCount > 0 && (
        <span
          aria-live="polite"
          aria-label={`${selectedCount} artifact${selectedCount === 1 ? "" : "s"} selected`}
          className="inline-flex h-5 items-center rounded-full bg-primary px-2 text-[10px] font-semibold text-primary-foreground"
        >
          {selectedCount} selected
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Artifact selectable card
// ---------------------------------------------------------------------------

interface SelectableArtifactCardProps {
  artifact: ArtifactCard;
  selected: boolean;
  onToggle: (id: string) => void;
  viewMode: PickerViewMode;
}

function SelectableArtifactCard({
  artifact,
  selected,
  onToggle,
  viewMode,
}: SelectableArtifactCardProps) {
  const handleClick = useCallback(() => {
    onToggle(artifact.id);
  }, [artifact.id, onToggle]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        onToggle(artifact.id);
      }
    },
    [artifact.id, onToggle],
  );

  const dateStr = artifact.updated ?? artifact.created;
  const formattedDate = dateStr
    ? new Date(dateStr).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "2-digit",
      })
    : null;

  return (
    <div
      role="checkbox"
      aria-checked={selected}
      aria-label={`Select artifact: ${artifact.title}`}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "relative cursor-pointer rounded-md border transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border bg-card hover:border-primary/50 hover:bg-accent/30",
        viewMode === "grid" ? "flex flex-col gap-1.5 p-3" : "flex items-center gap-3 p-2.5",
      )}
    >
      {/* Checkbox icon */}
      <div
        aria-hidden="true"
        className={cn(
          "shrink-0 transition-colors",
          viewMode === "grid" ? "absolute right-2.5 top-2.5" : "relative",
        )}
      >
        {selected ? (
          <CheckSquare className="size-4 text-primary" />
        ) : (
          <Square className="size-4 text-muted-foreground" />
        )}
      </div>

      {/* Card body */}
      <div className={cn("min-w-0", viewMode === "grid" ? "flex flex-col gap-1" : "flex flex-1 items-center gap-3 min-w-0")}>
        <p
          className={cn(
            "font-medium text-foreground line-clamp-2",
            viewMode === "grid" ? "text-sm pr-6" : "text-xs truncate flex-1",
          )}
        >
          {artifact.title}
        </p>

        <div className={cn("flex flex-wrap items-center gap-1.5", viewMode === "list" && "ml-auto shrink-0")}>
          <span className="inline-flex items-center rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground capitalize">
            {artifact.type}
          </span>
          <span className="inline-flex items-center rounded-sm bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground capitalize">
            {artifact.status}
          </span>
          {formattedDate && (
            <span className="text-[10px] text-muted-foreground/70">
              {formattedDate}
            </span>
          )}
        </div>

        {viewMode === "grid" && (
          <p className="mt-0.5 font-mono text-[9px] text-muted-foreground/60 truncate">
            {artifact.id}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Manual ID textarea (fallback)
// ---------------------------------------------------------------------------

interface ManualIdInputProps {
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

function ManualIdInput({ selectedIds, onSelectionChange }: ManualIdInputProps) {
  const raw = selectedIds.join("\n");
  const [localRaw, setLocalRaw] = useState(raw);

  // Sync from parent only when the parent changes externally
  const prevParent = useRef(raw);
  useEffect(() => {
    if (prevParent.current !== raw && localRaw !== raw) {
      setLocalRaw(raw);
    }
    prevParent.current = raw;
  }, [raw, localRaw]);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      setLocalRaw(e.target.value);
      onSelectionChange(parseIds(e.target.value));
    },
    [onSelectionChange],
  );

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-foreground">
        Source artifact IDs
        <span aria-hidden="true" className="ml-0.5 text-red-500">*</span>
      </label>
      <textarea
        aria-label="Source artifact IDs — one per line or comma-separated"
        value={localRaw}
        onChange={handleChange}
        rows={8}
        placeholder={"01HXYZ0000000000000000001\n01HXYZ0000000000000000002"}
        className={cn(
          "w-full resize-y rounded-md border border-input bg-background px-3 py-2",
          "font-mono text-xs placeholder:text-muted-foreground",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      />
      <p className="text-[11px] text-muted-foreground">
        Enter one artifact ULID per line, or comma-separated.
        {selectedIds.length > 0 && (
          <span className="ml-1 font-medium text-foreground">
            ({selectedIds.length} ID{selectedIds.length === 1 ? "" : "s"} parsed)
          </span>
        )}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SynthesisArtifactPicker — main component
// ---------------------------------------------------------------------------

export function SynthesisArtifactPicker({
  selectedIds,
  onSelectionChange,
  className,
}: SynthesisArtifactPickerProps) {
  // Toolbar state
  const [query, setQuery] = useState("");
  const [facet, setFacet] = useState<PickerFacet>("research");
  const [sort, setSort] = useState<ArtifactSortField>("updated");
  const [order, setOrder] = useState<SortOrder>("desc");
  const [viewMode, setViewMode] = useState<PickerViewMode>("list");
  const [inputMode, setInputMode] = useState<PickerInputMode>("grid");

  // Data state
  const [artifacts, setArtifacts] = useState<ArtifactCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isFetchingNext, setIsFetchingNext] = useState(false);

  const selectedSet = new Set(selectedIds);

  // Fetch artifacts whenever facet/sort/order changes
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    setArtifacts([]);
    setCursor(null);

    const params: Parameters<typeof listArtifacts>[0] = {
      sort,
      order,
      limit: 24,
    };

    if (facet === "research") {
      params.facet = "research";
    } else if (facet === "library") {
      params.facet = "library";
    }
    // "all" — no facet filter

    listArtifacts(params)
      .then((res) => {
        if (!cancelled) {
          setArtifacts(res.data ?? []);
          setCursor(res.cursor ?? null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Failed to load artifacts.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [facet, sort, order]);

  // Load more (cursor pagination)
  const handleLoadMore = useCallback(async () => {
    if (!cursor || isFetchingNext) return;
    setIsFetchingNext(true);

    const params: Parameters<typeof listArtifacts>[0] = {
      sort,
      order,
      limit: 24,
      cursor,
    };
    if (facet === "research") params.facet = "research";
    else if (facet === "library") params.facet = "library";

    try {
      const res = await listArtifacts(params);
      setArtifacts((prev) => [...prev, ...(res.data ?? [])]);
      setCursor(res.cursor ?? null);
    } catch {
      // Non-fatal — user can retry
    } finally {
      setIsFetchingNext(false);
    }
  }, [cursor, isFetchingNext, facet, sort, order]);

  // Toggle selection
  const handleToggle = useCallback(
    (id: string) => {
      const next = new Set(selectedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      onSelectionChange(Array.from(next));
    },
    [selectedIds, onSelectionChange],
  );

  // Client-side title filter
  const filteredArtifacts =
    query.trim().length === 0
      ? artifacts
      : artifacts.filter((a) =>
          a.title.toLowerCase().includes(query.trim().toLowerCase()),
        );

  // Sort change helper
  const handleSortChange = useCallback(
    (newSort: ArtifactSortField, newOrder: SortOrder) => {
      setSort(newSort);
      setOrder(newOrder);
    },
    [],
  );

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Toolbar */}
      <PickerToolbar
        query={query}
        onQueryChange={setQuery}
        facet={facet}
        onFacetChange={(f) => {
          setFacet(f);
          setQuery("");
        }}
        sort={sort}
        order={order}
        onSortChange={handleSortChange}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        inputMode={inputMode}
        onInputModeChange={setInputMode}
        selectedCount={selectedIds.length}
      />

      {/* ------------------------------------------------------------------ */}
      {/* Manual ID entry mode                                                */}
      {/* ------------------------------------------------------------------ */}
      {inputMode === "manual" && (
        <ManualIdInput
          selectedIds={selectedIds}
          onSelectionChange={onSelectionChange}
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Grid picker mode                                                    */}
      {/* ------------------------------------------------------------------ */}
      {inputMode === "grid" && (
        <>
          {isLoading && (
            <div
              aria-busy="true"
              aria-label="Loading artifacts"
              className={cn(
                "grid gap-2",
                viewMode === "grid"
                  ? "grid-cols-1 sm:grid-cols-2"
                  : "grid-cols-1",
              )}
            >
              {Array.from({ length: 6 }, (_, i) => (
                <div
                  key={i}
                  aria-hidden="true"
                  className={cn(
                    "animate-pulse rounded-md border bg-muted",
                    viewMode === "grid" ? "h-24" : "h-12",
                  )}
                />
              ))}
            </div>
          )}

          {!isLoading && loadError && (
            <div
              role="alert"
              className="flex flex-col items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-6 text-center"
            >
              <AlertCircle aria-hidden="true" className="size-5 text-destructive" />
              <p className="text-xs text-muted-foreground">{loadError}</p>
              <button
                type="button"
                onClick={() => {
                  setFacet((f) => f); // trigger re-fetch via useEffect
                  setSort((s) => s);
                }}
                className={cn(
                  "inline-flex h-7 items-center rounded border border-destructive/40 px-2 text-[11px] text-destructive",
                  "hover:bg-destructive/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                Retry
              </button>
            </div>
          )}

          {!isLoading && !loadError && filteredArtifacts.length === 0 && (
            <div
              role="status"
              className="flex flex-col items-center gap-2 rounded-md border border-dashed px-4 py-10 text-center"
            >
              <p className="text-xs font-medium text-foreground">
                {query ? "No artifacts match your filter" : "No artifacts found"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {query
                  ? "Try a different title filter or clear the search."
                  : 'Try a different workspace or switch to "Enter IDs" mode.'}
              </p>
            </div>
          )}

          {!isLoading && filteredArtifacts.length > 0 && (
            <div
              role="group"
              aria-label="Select source artifacts"
              className={cn(
                "grid gap-2",
                viewMode === "grid"
                  ? "grid-cols-1 sm:grid-cols-2"
                  : "grid-cols-1",
              )}
            >
              {filteredArtifacts.map((artifact) => (
                <SelectableArtifactCard
                  key={artifact.id}
                  artifact={artifact}
                  selected={selectedSet.has(artifact.id)}
                  onToggle={handleToggle}
                  viewMode={viewMode}
                />
              ))}
            </div>
          )}

          {/* Load more */}
          {cursor && !isLoading && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={isFetchingNext}
                aria-label="Load more artifacts"
                className={cn(
                  "inline-flex h-8 items-center gap-2 rounded-md border px-4 text-xs font-medium text-foreground",
                  "transition-colors hover:bg-accent hover:text-accent-foreground",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  "disabled:pointer-events-none disabled:opacity-50",
                )}
              >
                {isFetchingNext ? (
                  <>
                    <Loader2 aria-hidden="true" className="size-3 animate-spin" />
                    Loading…
                  </>
                ) : (
                  "Load more"
                )}
              </button>
            </div>
          )}

          {/* Note about search limitations */}
          <p className="text-[10px] text-muted-foreground/60">
            Note: title filter applies to the current page only. Full-text search
            across all artifacts requires a future backend endpoint.
          </p>
        </>
      )}
    </div>
  );
}
