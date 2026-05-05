"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  FileStack,
  Loader2,
  PackagePlus,
  Search,
  Square,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { listArtifacts } from "@/lib/api/artifacts";
import type { ArtifactSortField, SortOrder } from "@/lib/api/artifacts";
import {
  createContextPack,
  getContextPack,
  listContextPackVersions,
} from "@/lib/api/projects";
import type {
  ArtifactCard,
  ArtifactFacet,
  ArtifactStatus,
} from "@/types/artifact";
import type { ContextPack, ContextPackVersion } from "@/types/projects";

type BuilderStep = 1 | 2;
type WorkspaceFilter = ArtifactFacet | "all";
type StatusFilter = ArtifactStatus | "all";
type ViewMode = "grid" | "list";

const SORT_OPTIONS: {
  label: string;
  field: ArtifactSortField;
  order: SortOrder;
}[] = [
  { label: "Updated newest", field: "updated", order: "desc" },
  { label: "Updated oldest", field: "updated", order: "asc" },
  { label: "Created newest", field: "created", order: "desc" },
  { label: "Created oldest", field: "created", order: "asc" },
  { label: "Title A-Z", field: "title", order: "asc" },
  { label: "Title Z-A", field: "title", order: "desc" },
];

function WizardStepper({ step }: { step: BuilderStep }) {
  const items = [
    { num: 1 as const, label: "Discover artifacts" },
    { num: 2 as const, label: "Confirm pack" },
  ];

  return (
    <nav
      aria-label="Context pack builder steps"
      className="flex flex-wrap items-center gap-2"
    >
      {items.map(({ num, label }, index) => {
        const active = num === step;
        const complete = num < step;

        return (
          <div key={num} className="flex items-center gap-2">
            {index > 0 && (
              <div
                aria-hidden="true"
                className={cn(
                  "h-px w-8",
                  complete ? "bg-primary" : "bg-border",
                )}
              />
            )}
            <div
              aria-current={active ? "step" : undefined}
              className="flex items-center gap-1.5"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold",
                  active
                    ? "bg-primary text-primary-foreground"
                    : complete
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {num}
              </span>
              <span
                className={cn(
                  "text-xs font-medium",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

interface SelectableArtifactProps {
  artifact: ArtifactCard;
  selected: boolean;
  viewMode: ViewMode;
  onToggle: (id: string) => void;
}

function formatDate(value?: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SelectableArtifact({
  artifact,
  selected,
  viewMode,
  onToggle,
}: SelectableArtifactProps) {
  const handleToggle = useCallback(
    () => onToggle(artifact.id),
    [artifact.id, onToggle],
  );
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        onToggle(artifact.id);
      }
    },
    [artifact.id, onToggle],
  );

  const date = formatDate(artifact.updated ?? artifact.created);

  return (
    <div
      role="checkbox"
      aria-checked={selected}
      aria-label={`Select artifact: ${artifact.title}`}
      tabIndex={0}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      className={cn(
        "cursor-pointer rounded-md border bg-card transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border hover:border-primary/50 hover:bg-accent/30",
        viewMode === "grid" ? "min-h-32 p-3" : "p-2.5",
      )}
    >
      <div
        className={cn(
          "grid min-w-0 gap-3",
          viewMode === "grid" ? "grid-cols-[1fr_auto]" : "grid-cols-[1fr_auto]",
        )}
      >
        <div className="min-w-0">
          <p
            className={cn(
              "font-medium text-foreground",
              viewMode === "grid" ? "line-clamp-2 text-sm" : "truncate text-sm",
            )}
          >
            {artifact.title}
          </p>
          <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground/70">
            {artifact.id}
          </p>
        </div>
        <span aria-hidden="true" className="mt-0.5 text-muted-foreground">
          {selected ? (
            <CheckSquare className="size-4 text-primary" />
          ) : (
            <Square className="size-4" />
          )}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground capitalize">
          {artifact.workspace}
        </span>
        <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground capitalize">
          {artifact.type}
        </span>
        <span className="rounded-sm bg-muted/70 px-1.5 py-0.5 text-[10px] text-muted-foreground capitalize">
          {artifact.status}
        </span>
        {date && (
          <span className="text-[10px] text-muted-foreground">{date}</span>
        )}
      </div>
    </div>
  );
}

interface DiscoveryToolbarProps {
  search: string;
  workspace: WorkspaceFilter;
  status: StatusFilter;
  typeFilter: string;
  sort: ArtifactSortField;
  order: SortOrder;
  viewMode: ViewMode;
  selectedCount: number;
  onSearchChange: (value: string) => void;
  onWorkspaceChange: (value: WorkspaceFilter) => void;
  onStatusChange: (value: StatusFilter) => void;
  onTypeFilterChange: (value: string) => void;
  onSortChange: (sort: ArtifactSortField, order: SortOrder) => void;
  onViewModeChange: (value: ViewMode) => void;
}

function DiscoveryToolbar({
  search,
  workspace,
  status,
  typeFilter,
  sort,
  order,
  viewMode,
  selectedCount,
  onSearchChange,
  onWorkspaceChange,
  onStatusChange,
  onTypeFilterChange,
  onSortChange,
  onViewModeChange,
}: DiscoveryToolbarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-md border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            aria-label="Search artifacts"
            placeholder="Search current results"
            value={search}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onSearchChange(event.target.value)
            }
            className={cn(
              "h-9 w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-3 text-sm",
              "placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          />
        </div>

        <div className="relative">
          <select
            aria-label="Filter artifacts by workspace"
            value={workspace}
            onChange={(event) =>
              onWorkspaceChange(event.target.value as WorkspaceFilter)
            }
            className={cn(
              "h-9 appearance-none rounded-md border border-input bg-background py-1 pl-2.5 pr-8 text-sm",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <option value="all">All workspaces</option>
            <option value="library">Library</option>
            <option value="research">Research</option>
            <option value="blog">Blog</option>
            <option value="projects">Projects</option>
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
        </div>

        <div className="relative">
          <select
            aria-label="Filter artifacts by status"
            value={status}
            onChange={(event) =>
              onStatusChange(event.target.value as StatusFilter)
            }
            className={cn(
              "h-9 appearance-none rounded-md border border-input bg-background py-1 pl-2.5 pr-8 text-sm",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <option value="all">Any status</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
            <option value="stale">Stale</option>
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
        </div>

        <input
          type="text"
          aria-label="Filter artifacts by type"
          placeholder="Type"
          value={typeFilter}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onTypeFilterChange(event.target.value)
          }
          className={cn(
            "h-9 w-28 rounded-md border border-input bg-background px-2.5 text-sm",
            "placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        />

        <div className="relative">
          <select
            aria-label="Sort artifacts"
            value={`${sort}:${order}`}
            onChange={(event) => {
              const [field, direction] = event.target.value.split(":") as [
                ArtifactSortField,
                SortOrder,
              ];
              onSortChange(field, direction);
            }}
            className={cn(
              "h-9 appearance-none rounded-md border border-input bg-background py-1 pl-2.5 pr-8 text-sm",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            {SORT_OPTIONS.map((option) => (
              <option
                key={`${option.field}:${option.order}`}
                value={`${option.field}:${option.order}`}
              >
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
        </div>

        <div
          role="group"
          aria-label="Artifact view mode"
          className="flex rounded-md border"
        >
          <button
            type="button"
            aria-label="List view"
            aria-pressed={viewMode === "list"}
            onClick={() => onViewModeChange("list")}
            className={cn(
              "h-9 rounded-l-md border-r px-3 text-xs font-medium transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              viewMode === "list"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50",
            )}
          >
            List
          </button>
          <button
            type="button"
            aria-label="Grid view"
            aria-pressed={viewMode === "grid"}
            onClick={() => onViewModeChange("grid")}
            className={cn(
              "h-9 rounded-r-md px-3 text-xs font-medium transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              viewMode === "grid"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50",
            )}
          >
            Grid
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Search filters the loaded page. Use workspace, status, type, and sort
          controls to request a focused artifact set.
        </p>
        <span
          aria-live="polite"
          className="shrink-0 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground"
        >
          {selectedCount} selected
        </span>
      </div>
    </div>
  );
}

interface SuccessResult {
  packId: string;
  pack: ContextPack | null;
  currentVersion: ContextPackVersion | null;
}

export function ContextPackBuilder() {
  const [step, setStep] = useState<BuilderStep>(1);
  const [search, setSearch] = useState("");
  const [workspace, setWorkspace] = useState<WorkspaceFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState("");
  const [sort, setSort] = useState<ArtifactSortField>("updated");
  const [order, setOrder] = useState<SortOrder>("desc");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [artifacts, setArtifacts] = useState<ArtifactCard[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingNext, setIsFetchingNext] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessResult | null>(null);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const artifactById = useMemo(
    () => new Map(artifacts.map((artifact) => [artifact.id, artifact])),
    [artifacts],
  );

  useEffect(() => {
    let cancelled = false;
    const trimmedType = typeFilter.trim();

    setIsLoading(true);
    setLoadError(null);
    setArtifacts([]);
    setCursor(null);

    listArtifacts({
      facet: workspace === "all" ? undefined : workspace,
      status: status === "all" ? undefined : status,
      type: trimmedType ? trimmedType : undefined,
      sort,
      order,
      limit: 30,
    })
      .then((response) => {
        if (cancelled) return;
        setArtifacts(response.data ?? []);
        setCursor(response.cursor ?? null);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(
          error instanceof Error ? error.message : "Failed to load artifacts.",
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workspace, status, typeFilter, sort, order, reloadNonce]);

  const filteredArtifacts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return artifacts;
    return artifacts.filter((artifact) => {
      return (
        artifact.title.toLowerCase().includes(query) ||
        artifact.id.toLowerCase().includes(query) ||
        artifact.type.toLowerCase().includes(query)
      );
    });
  }, [artifacts, search]);

  const handleToggle = useCallback((id: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return Array.from(next);
    });
    setValidationError(null);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedIds([]);
    setValidationError(null);
  }, []);

  const handleLoadMore = useCallback(async () => {
    if (!cursor || isFetchingNext) return;
    setIsFetchingNext(true);
    const trimmedType = typeFilter.trim();

    try {
      const response = await listArtifacts({
        facet: workspace === "all" ? undefined : workspace,
        status: status === "all" ? undefined : status,
        type: trimmedType ? trimmedType : undefined,
        sort,
        order,
        cursor,
        limit: 30,
      });
      setArtifacts((previous) => [...previous, ...(response.data ?? [])]);
      setCursor(response.cursor ?? null);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Failed to load more artifacts.",
      );
    } finally {
      setIsFetchingNext(false);
    }
  }, [cursor, isFetchingNext, order, sort, status, typeFilter, workspace]);

  const handleContinue = useCallback(() => {
    if (selectedIds.length === 0) {
      setValidationError(
        "Select at least one artifact before confirming the pack.",
      );
      return;
    }
    setValidationError(null);
    setSubmitError(null);
    setStep(2);
  }, [selectedIds.length]);

  const handleSubmit = useCallback(async () => {
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();

    if (!trimmedName) {
      setSubmitError("Name is required.");
      return;
    }
    if (selectedIds.length === 0) {
      setSubmitError("Select at least one artifact before creating the pack.");
      setStep(1);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const created = await createContextPack({
        name: trimmedName,
        description: trimmedDescription ? trimmedDescription : null,
        artifact_ids: selectedIds,
      });
      const [pack, versions] = await Promise.all([
        getContextPack(created.pack_id),
        listContextPackVersions(created.pack_id, { limit: 5 }),
      ]);
      setSuccess({
        packId: created.pack_id,
        pack,
        currentVersion: versions.data[0] ?? null,
      });
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Failed to create context pack.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [description, name, selectedIds]);

  if (success) {
    const version =
      success.currentVersion?.version ?? success.pack?.version ?? 1;

    return (
      <div className="flex flex-col gap-5">
        <div className="rounded-md border border-emerald-300 bg-emerald-50 p-5 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
          <div className="flex flex-wrap items-start gap-3">
            <CheckCircle2
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold">Context pack created</h2>
              <p className="mt-1 text-sm">
                {success.pack?.name ?? name.trim()} is ready in the Projects
                overlay.
              </p>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs font-medium uppercase text-emerald-800/70 dark:text-emerald-200/70">
                    Pack ID
                  </dt>
                  <dd className="mt-1 break-all font-mono text-xs">
                    {success.packId}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-emerald-800/70 dark:text-emerald-200/70">
                    Current version
                  </dt>
                  <dd className="mt-1 font-mono text-xs">v{version}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-emerald-800/70 dark:text-emerald-200/70">
                    Artifacts
                  </dt>
                  <dd className="mt-1 font-mono text-xs">
                    {success.pack?.artifact_count ?? selectedIds.length}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/projects"
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground",
              "transition-colors hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            View Projects
          </Link>
          <button
            type="button"
            onClick={() => {
              setSuccess(null);
              setStep(1);
              setSelectedIds([]);
              setName("");
              setDescription("");
            }}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium",
              "transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            Create another pack
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <PackagePlus aria-hidden="true" className="size-5 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">
              Context Pack Builder
            </h1>
          </div>
          <WizardStepper step={step} />
        </div>
        <Link
          href="/projects"
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium text-muted-foreground",
            "transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <X aria-hidden="true" className="size-4" />
          Cancel
        </Link>
      </div>

      {step === 1 ? (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-base font-medium text-foreground">
              Discover artifacts
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Search and filter artifacts, then select the scope for the context
              pack.
            </p>
          </div>

          {validationError && (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {validationError}
            </div>
          )}

          <DiscoveryToolbar
            search={search}
            workspace={workspace}
            status={status}
            typeFilter={typeFilter}
            sort={sort}
            order={order}
            viewMode={viewMode}
            selectedCount={selectedIds.length}
            onSearchChange={setSearch}
            onWorkspaceChange={(value) => {
              setWorkspace(value);
              setSearch("");
            }}
            onStatusChange={setStatus}
            onTypeFilterChange={setTypeFilter}
            onSortChange={(nextSort, nextOrder) => {
              setSort(nextSort);
              setOrder(nextOrder);
            }}
            onViewModeChange={setViewMode}
          />

          <section
            aria-label="Artifact discovery results"
            aria-busy={isLoading}
          >
            {isLoading && (
              <div className="grid gap-2">
                {Array.from({ length: 6 }, (_, index) => (
                  <div
                    key={index}
                    aria-hidden="true"
                    className="h-16 animate-pulse rounded-md border bg-muted"
                  />
                ))}
              </div>
            )}

            {!isLoading && loadError && (
              <div
                role="alert"
                className="flex flex-col items-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-8 text-center"
              >
                <AlertCircle
                  aria-hidden="true"
                  className="size-6 text-destructive"
                />
                <p className="text-sm text-muted-foreground">{loadError}</p>
                <button
                  type="button"
                  onClick={() => setReloadNonce((value) => value + 1)}
                  className={cn(
                    "inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium",
                    "hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  Retry
                </button>
              </div>
            )}

            {!isLoading && !loadError && filteredArtifacts.length === 0 && (
              <div
                role="status"
                className="rounded-md border border-dashed px-4 py-10 text-center"
              >
                <p className="text-sm font-medium text-foreground">
                  No artifacts found
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Adjust the search or filters to broaden the discovery set.
                </p>
              </div>
            )}

            {!isLoading && !loadError && filteredArtifacts.length > 0 && (
              <div
                role="group"
                aria-label="Selectable artifacts"
                className={cn(
                  "grid gap-2",
                  viewMode === "grid"
                    ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
                    : "grid-cols-1",
                )}
              >
                {filteredArtifacts.map((artifact) => (
                  <SelectableArtifact
                    key={artifact.id}
                    artifact={artifact}
                    selected={selectedSet.has(artifact.id)}
                    viewMode={viewMode}
                    onToggle={handleToggle}
                  />
                ))}
              </div>
            )}
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleContinue}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground",
                  "transition-colors hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                Continue
                <ArrowRight aria-hidden="true" className="size-4" />
              </button>
              {selectedIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className={cn(
                    "inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium text-muted-foreground",
                    "transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  Clear selection
                </button>
              )}
            </div>

            {cursor && !isLoading && (
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={isFetchingNext}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium",
                  "transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  "disabled:pointer-events-none disabled:opacity-50",
                )}
              >
                {isFetchingNext && (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                )}
                Load more
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-base font-medium text-foreground">
                Confirm pack scope
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Name the pack, describe its intended use, and create the overlay
                record.
              </p>
            </div>

            {submitError && (
              <div
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                {submitError}
              </div>
            )}

            <div className="grid gap-4 rounded-md border bg-card p-4">
              <div className="grid gap-1.5">
                <label
                  htmlFor="context-pack-name"
                  className="text-sm font-medium text-foreground"
                >
                  Name
                </label>
                <input
                  id="context-pack-name"
                  value={name}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setName(event.target.value)
                  }
                  placeholder="Research briefing scope"
                  maxLength={512}
                  className={cn(
                    "h-10 rounded-md border border-input bg-background px-3 text-sm",
                    "placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                />
              </div>

              <div className="grid gap-1.5">
                <label
                  htmlFor="context-pack-description"
                  className="text-sm font-medium text-foreground"
                >
                  Description
                </label>
                <textarea
                  id="context-pack-description"
                  value={description}
                  onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                    setDescription(event.target.value)
                  }
                  placeholder="What this context pack is for, and how it should be used."
                  rows={5}
                  maxLength={8192}
                  className={cn(
                    "resize-y rounded-md border border-input bg-background px-3 py-2 text-sm",
                    "placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t pt-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium",
                  "transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
                Back
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground",
                  "transition-colors hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  "disabled:pointer-events-none disabled:opacity-50",
                )}
              >
                {isSubmitting ? (
                  <>
                    <Loader2
                      aria-hidden="true"
                      className="size-4 animate-spin"
                    />
                    Creating
                  </>
                ) : (
                  <>
                    <FileStack aria-hidden="true" className="size-4" />
                    Create context pack
                  </>
                )}
              </button>
            </div>
          </div>

          <aside
            aria-label="Selected pack scope"
            className="rounded-md border bg-card p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-foreground">
                Selected scope
              </h3>
              <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                {selectedIds.length} artifacts
              </span>
            </div>
            <ul
              className="mt-4 flex max-h-96 flex-col gap-2 overflow-auto"
              aria-label="Selected artifacts"
            >
              {selectedIds.map((id) => {
                const artifact = artifactById.get(id);
                return (
                  <li key={id} className="rounded-md border bg-background p-2">
                    <p className="truncate text-xs font-medium text-foreground">
                      {artifact?.title ?? id}
                    </p>
                    <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                      {id}
                    </p>
                  </li>
                );
              })}
            </ul>
          </aside>
        </div>
      )}
    </div>
  );
}
