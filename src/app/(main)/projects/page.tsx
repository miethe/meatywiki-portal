"use client";

/**
 * Projects workspace shell — P5-FE-001.
 *
 * Replaces the previous facet-filtered Library view with a proper project
 * workspace backed by the context-pack overlay API:
 *
 *   GET  /api/projects/          → list of ContextPack records
 *   POST /api/projects/          → create new ContextPack
 *
 * Each project card navigates to /projects/[id] (P5-FE-002).
 *
 * Design decisions:
 *   - No multi-user / RBAC affordances (personal-use-first per CLAUDE.md).
 *   - Create dialog: name + optional description → POST /api/projects/.
 *   - TanStack Query for data fetching (consistent with rest of Portal).
 *   - Empty state: friendly CTA, no filter state needed here.
 *
 * WCAG 2.1 AA: min-h touch targets, focus-visible rings, role="list",
 * dialog focus trap from existing Dialog primitive.
 */

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FolderKanban,
  Plus,
  AlertCircle,
  ChevronRight,
  Calendar,
  Package,
  Loader2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  listContextPacks,
  createContextPack,
} from "@/lib/api/projects";
import type { ContextPack } from "@/types/projects";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROJECTS_QUERY_KEY = ["projects", "list"] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-20 text-center"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950/30">
        <FolderKanban
          aria-hidden="true"
          className="size-7 text-amber-600 dark:text-amber-400"
        />
      </div>
      <div className="max-w-xs">
        <p className="text-sm font-semibold text-foreground">
          No projects yet
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Create your first project to start organising context packs and
          resources.
        </p>
      </div>
      <button
        type="button"
        onClick={onCreate}
        className={cn(
          "inline-flex min-h-[44px] items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground sm:h-9 sm:min-h-0",
          "transition-colors hover:bg-primary/90",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        )}
      >
        <Plus aria-hidden="true" className="size-4" />
        Create your first project
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 py-12 text-center"
    >
      <AlertCircle aria-hidden="true" className="size-8 text-destructive" />
      <div>
        <p className="text-sm font-medium text-foreground">
          Failed to load projects
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{error.message}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          "inline-flex min-h-[44px] items-center rounded-md border border-destructive/40 px-3 text-xs font-medium text-destructive sm:h-8 sm:min-h-0",
          "transition-colors hover:bg-destructive/10",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        )}
      >
        Try again
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Project card
// ---------------------------------------------------------------------------

interface ProjectCardProps {
  pack: ContextPack;
}

function ProjectCard({ pack }: ProjectCardProps) {
  const router = useRouter();

  const handleClick = useCallback(() => {
    router.push(`/projects/${encodeURIComponent(pack.pack_id)}`);
  }, [router, pack.pack_id]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick],
  );

  return (
    <li>
      <div
        role="link"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-label={`Open project: ${pack.name}`}
        className={cn(
          "group flex cursor-pointer items-start justify-between gap-4 rounded-lg border bg-card p-4 transition-all",
          "hover:border-primary/40 hover:bg-accent/30 hover:shadow-sm",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        )}
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {/* Icon */}
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-amber-50 dark:bg-amber-950/30">
            <FolderKanban
              aria-hidden="true"
              className="size-4 text-amber-600 dark:text-amber-400"
            />
          </div>

          {/* Text content */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary">
              {pack.name}
            </p>
            {pack.description && (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {pack.description}
              </p>
            )}

            {/* Meta row */}
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Package aria-hidden="true" className="size-3" />
                {pack.artifact_count} artifact{pack.artifact_count !== 1 ? "s" : ""}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar aria-hidden="true" className="size-3" />
                {formatDate(pack.created_at)}
              </span>
            </div>
          </div>
        </div>

        {/* Chevron */}
        <ChevronRight
          aria-hidden="true"
          className="mt-1 size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground"
        />
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ProjectCardSkeleton() {
  return (
    <li className="flex items-start gap-3 rounded-lg border bg-card p-4" aria-hidden="true">
      <div className="mt-0.5 h-9 w-9 shrink-0 animate-pulse rounded-md bg-muted" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-2/5 animate-pulse rounded bg-muted" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
        <div className="flex gap-3">
          <div className="h-3 w-16 animate-pulse rounded bg-muted" />
          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Create project dialog
// ---------------------------------------------------------------------------

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (packId: string) => void;
}

function CreateProjectDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateProjectDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      createContextPack({
        name: name.trim(),
        description: description.trim() || null,
        artifact_ids: [],
      }),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
      setName("");
      setDescription("");
      onOpenChange(false);
      onCreated(data.pack_id);
    },
  });

  const handleClose = useCallback(() => {
    if (mutation.isPending) return;
    setName("");
    setDescription("");
    mutation.reset();
    onOpenChange(false);
  }, [mutation, onOpenChange]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim() || mutation.isPending) return;
      mutation.mutate();
    },
    [name, mutation],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mx-4 max-w-md p-6">
        <div className="flex items-start justify-between gap-2">
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a context pack to organise related artifacts and resources.
            </p>
          </DialogHeader>
          <button
            type="button"
            aria-label="Close dialog"
            onClick={handleClose}
            className={cn(
              "mt-0.5 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          {/* Name field */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="project-name" className="text-sm font-medium">
              Name <span className="text-destructive" aria-hidden="true">*</span>
            </label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Semantic search spike"
              maxLength={200}
              required
              disabled={mutation.isPending}
              autoFocus
            />
          </div>

          {/* Description field */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="project-description" className="text-sm font-medium">
              Description{" "}
              <span className="text-xs font-normal text-muted-foreground">(optional)</span>
            </label>
            <textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this project's purpose…"
              rows={3}
              maxLength={1000}
              disabled={mutation.isPending}
              className={cn(
                "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
                "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "disabled:cursor-not-allowed disabled:opacity-50 resize-none",
              )}
            />
          </div>

          {/* Error message */}
          {mutation.isError && (
            <p role="alert" className="text-xs text-destructive">
              {mutation.error instanceof Error
                ? mutation.error.message
                : "Failed to create project. Please try again."}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={mutation.isPending}
              className={cn(
                "inline-flex min-h-[44px] items-center rounded-md border px-4 text-sm font-medium sm:h-9 sm:min-h-0",
                "transition-colors hover:bg-accent hover:text-accent-foreground",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "disabled:pointer-events-none disabled:opacity-50",
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || mutation.isPending}
              className={cn(
                "inline-flex min-h-[44px] items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground sm:h-9 sm:min-h-0",
                "transition-colors hover:bg-primary/90",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "disabled:pointer-events-none disabled:opacity-50",
              )}
            >
              {mutation.isPending && (
                <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
              )}
              {mutation.isPending ? "Creating…" : "Create project"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function ProjectsPage() {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: PROJECTS_QUERY_KEY,
    queryFn: () => listContextPacks({ limit: 50 }),
    staleTime: 30_000,
  });

  const projects = data?.data ?? [];

  const handleCreated = useCallback(
    (packId: string) => {
      router.push(`/projects/${encodeURIComponent(packId)}`);
    },
    [router],
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Context packs and resources, organised by project.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className={cn(
            "inline-flex min-h-[44px] items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground sm:h-9 sm:min-h-0",
            "transition-colors hover:bg-primary/90",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          )}
        >
          <Plus aria-hidden="true" className="size-4" />
          New project
        </button>
      </div>

      {/* Content */}
      {isError && error ? (
        <ErrorState
          error={error instanceof Error ? error : new Error(String(error))}
          onRetry={() => void refetch()}
        />
      ) : (
        <>
          {/* Skeleton */}
          {isLoading && (
            <ul role="list" className="flex flex-col gap-3" aria-label="Loading projects">
              {Array.from({ length: 4 }).map((_, i) => (
                <ProjectCardSkeleton key={i} />
              ))}
            </ul>
          )}

          {/* Project list */}
          {!isLoading && projects.length > 0 && (
            <ul role="list" className="flex flex-col gap-3" aria-label="Projects">
              {projects.map((pack) => (
                <ProjectCard key={pack.pack_id} pack={pack} />
              ))}
            </ul>
          )}

          {/* Empty state */}
          {!isLoading && projects.length === 0 && (
            <EmptyState onCreate={() => setCreateOpen(true)} />
          )}
        </>
      )}

      {/* Create dialog */}
      <CreateProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />
    </div>
  );
}
