"use client";

/**
 * ResourcesTab — list and manage artifacts attached to a project.
 *
 * Renders within the "Resources" tabpanel on the project detail page.
 *
 * Features:
 *   - Lists artifacts via GET /api/projects/{projectId}/attachments with
 *     cursor-based pagination ("Load more" button).
 *   - "Attach Resource" button opens AttachResourceModal for multi-select attach.
 *   - Per-row "Detach" action confirms via inline confirm row, then calls
 *     DELETE /api/projects/{projectId}/attachments/{artifact_id}. On error the
 *     row reverts and an error toast is shown.
 *   - Empty state with clear CTA.
 *   - Loading: skeleton rows while the initial fetch is in flight.
 *   - Error: inline error banner with retry.
 *
 * Patterns followed:
 *   - useQuery (TanStack Query) for list fetching, invalidation on mutations.
 *   - useMutation (TanStack Query) for detach.
 *   - useToast() from src/hooks/use-toast.tsx for detach error.
 *   - AttachResourceModal handles attach mutations internally; onSuccess triggers
 *     query invalidation via the provided callback.
 *   - Button, AlertDialogContent imported from @/components/ui.
 *
 * WCAG 2.1 AA: list semantics, labelled actions, focus-visible rings,
 * live region for pagination changes.
 */

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Package,
  Plus,
  Trash2,
  AlertCircle,
  ChevronDown,
  Loader2,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { AttachResourceModal } from "./AttachResourceModal";
import {
  listProjectAttachments,
  detachArtifactFromProject,
} from "@/lib/api/projects";
import { useToast } from "@/hooks/use-toast";
import type { ProjectAttachment } from "@/types/projects";
import type { ServiceModeEnvelope } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ResourcesTabProps {
  projectId: string;
}

// ---------------------------------------------------------------------------
// Skeleton row
// ---------------------------------------------------------------------------

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="h-8 w-8 shrink-0 animate-pulse rounded-md bg-muted" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/4 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-7 w-14 animate-pulse rounded bg-muted" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// ResourcesTab
// ---------------------------------------------------------------------------

export function ResourcesTab({ projectId }: ResourcesTabProps) {
  const { add: addToast } = useToast();
  const queryClient = useQueryClient();

  const [attachOpen, setAttachOpen] = useState(false);
  const [confirmDetachId, setConfirmDetachId] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [allItems, setAllItems] = useState<ProjectAttachment[]>([]);
  const [hasMore, setHasMore] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch
  // ---------------------------------------------------------------------------

  const queryKey = ["projects", projectId, "attachments"];

  const { isLoading, isError, error, refetch } = useQuery<
    ServiceModeEnvelope<ProjectAttachment>,
    Error
  >({
    queryKey,
    queryFn: async () => {
      const page = await listProjectAttachments(projectId, { limit: 20 });
      // Reset accumulated list when re-fetching from scratch
      setAllItems(page.data);
      setHasMore(!!page.cursor);
      setCursor(page.cursor ?? null);
      return page;
    },
    staleTime: 15_000,
    retry: false,
  });

  // ---------------------------------------------------------------------------
  // Load more
  // ---------------------------------------------------------------------------

  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const handleLoadMore = useCallback(async () => {
    if (!cursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const page = await listProjectAttachments(projectId, {
        limit: 20,
        cursor,
      });
      setAllItems((prev) => [...prev, ...page.data]);
      setHasMore(!!page.cursor);
      setCursor(page.cursor ?? null);
    } catch {
      addToast({ message: "Failed to load more resources.", type: "error" });
    } finally {
      setIsLoadingMore(false);
    }
  }, [cursor, isLoadingMore, projectId, addToast]);

  // ---------------------------------------------------------------------------
  // Detach mutation
  // ---------------------------------------------------------------------------

  const detachMutation = useMutation({
    mutationFn: ({ artifactId }: { artifactId: string }) =>
      detachArtifactFromProject(projectId, artifactId),
    onSuccess: (_data, variables) => {
      setAllItems((prev) =>
        prev.filter((item) => item.artifact_id !== variables.artifactId),
      );
      // Invalidate so any other consumers re-fetch
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (err: Error) => {
      addToast({
        message: `Failed to detach resource: ${err.message}`,
        type: "error",
      });
    },
  });

  const handleDetachConfirm = useCallback(() => {
    if (!confirmDetachId) return;
    detachMutation.mutate({ artifactId: confirmDetachId });
    setConfirmDetachId(null);
  }, [confirmDetachId, detachMutation]);

  // ---------------------------------------------------------------------------
  // Attach success callback — reset and refetch
  // ---------------------------------------------------------------------------

  const handleAttachSuccess = useCallback(() => {
    setCursor(null);
    void queryClient.invalidateQueries({ queryKey });
    void refetch();
  }, [queryClient, queryKey, refetch]);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading resources"
        className="rounded-lg border"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Attached Resources
          </h2>
          <div className="h-8 w-28 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="divide-y">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    const errMsg =
      error instanceof Error ? error.message : "Failed to load resources.";
    return (
      <div
        role="alert"
        className="rounded-md border border-destructive/30 bg-destructive/5 px-6 py-8 text-center"
      >
        <AlertCircle
          aria-hidden="true"
          className="mx-auto mb-3 size-7 text-destructive"
        />
        <p className="text-sm font-semibold text-destructive">
          Failed to load resources
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{errMsg}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4 border-destructive/40 text-destructive hover:bg-destructive/10"
          onClick={() => void refetch()}
        >
          Try again
        </Button>
      </div>
    );
  }

  const isEmpty = allItems.length === 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Section card */}
      <div className="rounded-lg border">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Attached Resources
            {!isEmpty && (
              <span className="ml-1.5 font-mono text-foreground">
                ({allItems.length}{hasMore ? "+" : ""})
              </span>
            )}
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAttachOpen(true)}
            className="h-7 gap-1.5 text-xs"
          >
            <Plus aria-hidden="true" className="size-3.5" />
            Attach Resource
          </Button>
        </div>

        {/* Empty state */}
        {isEmpty && (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Package
                aria-hidden="true"
                className="size-5 text-muted-foreground"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                No resources attached
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Attach your first resource to keep related artifacts accessible.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAttachOpen(true)}
              className="mt-1"
            >
              <Plus aria-hidden="true" className="size-3.5" />
              Attach Resource
            </Button>
          </div>
        )}

        {/* List */}
        {!isEmpty && (
          <ul aria-label="Attached resources" className="divide-y">
            {allItems.map((item) => (
              <li
                key={item.artifact_id}
                className="flex items-center gap-3 px-4 py-3"
              >
                {/* Icon */}
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-muted">
                  <FileText
                    aria-hidden="true"
                    className="size-3.5 text-muted-foreground"
                  />
                </span>

                {/* Name + meta */}
                <span className="min-w-0 flex-1">
                  <span
                    className="block truncate text-sm font-medium leading-tight text-foreground"
                    title={item.name}
                  >
                    {item.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.type}
                    <span
                      aria-hidden="true"
                      className="mx-1 select-none text-muted-foreground/40"
                    >
                      ·
                    </span>
                    <time dateTime={item.attached_at}>
                      Attached {formatDate(item.attached_at)}
                    </time>
                  </span>
                </span>

                {/* Detach button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Detach ${item.name}`}
                  onClick={() => setConfirmDetachId(item.artifact_id)}
                  disabled={
                    detachMutation.isPending &&
                    detachMutation.variables?.artifactId === item.artifact_id
                  }
                  className={cn(
                    "h-7 gap-1 text-xs text-muted-foreground hover:text-destructive",
                    detachMutation.isPending &&
                      detachMutation.variables?.artifactId ===
                        item.artifact_id &&
                      "opacity-50",
                  )}
                >
                  {detachMutation.isPending &&
                  detachMutation.variables?.artifactId === item.artifact_id ? (
                    <Loader2
                      aria-hidden="true"
                      className="size-3.5 animate-spin"
                    />
                  ) : (
                    <Trash2 aria-hidden="true" className="size-3.5" />
                  )}
                  Detach
                </Button>
              </li>
            ))}
          </ul>
        )}

        {/* Load more */}
        {hasMore && (
          <div className="border-t px-4 py-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void handleLoadMore()}
              disabled={isLoadingMore}
              className="w-full gap-1.5 text-xs text-muted-foreground"
            >
              {isLoadingMore ? (
                <>
                  <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
                  Loading…
                </>
              ) : (
                <>
                  <ChevronDown aria-hidden="true" className="size-3.5" />
                  Load more
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Attach modal */}
      <AttachResourceModal
        open={attachOpen}
        onOpenChange={setAttachOpen}
        projectId={projectId}
        onSuccess={handleAttachSuccess}
      />

      {/* Detach confirm dialog */}
      <AlertDialog
        open={confirmDetachId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDetachId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Detach resource?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the artifact from this project. The artifact
              itself will not be deleted from your library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDetachConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Detach
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
