"use client";

/**
 * ProjectDirectoriesClient — interactive client island for /settings/projects.
 *
 * Composes:
 *   - useProjectDirectories   → list + CRUD mutations
 *   - useSyncProgress         → per-row SSE sync (one active at a time)
 *   - ProjectDirectoriesTable → rendered table with inline actions
 *   - ProjectDirModal         → Add / Edit modal
 *
 * Sync design:
 *   The sync hook manages one active SSE stream at a time.  Each row receives
 *   its computed SyncStatus from the shared `syncStates` map.  When a row's
 *   Sync button is clicked, `activeSyncId` is updated and `startSync()` is
 *   called.  After the stream completes (done / error) the state is persisted
 *   in `syncStates` so the badge remains visible until the next action.
 *
 * Toast notifications:
 *   Success/error toasts are dispatched via useToast() for CRUD ops.
 *   Sync completion is shown via the inline per-row badge (no toast — the
 *   badge is more contextual for sync).
 *
 * Traces: Cross-Project Knowledge Hub v2 / P5-04.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useProjectDirectories } from "@/hooks/useProjectDirectories";
import { useSyncProgress } from "@/hooks/useSyncProgress";
import { ProjectDirectoriesTable } from "@/components/settings/ProjectDirectoriesTable";
import { ProjectDirModal } from "@/components/settings/ProjectDirModal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { ProjectDirRead, ProjectDirCreateRequest, ProjectDirUpdateRequest } from "@/lib/api/project-directories";
import type { SyncStateMap } from "@/components/settings/ProjectDirectoriesTable";
import type { SyncStatus } from "@/hooks/useSyncProgress";

// ---------------------------------------------------------------------------
// Loading / error skeletons
// ---------------------------------------------------------------------------

function TableSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-2">
      <span className="sr-only">Loading project directories…</span>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-12 animate-pulse rounded-md bg-muted"
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

function ErrorAlert({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3",
        "text-sm text-destructive",
      )}
    >
      <span>{message}</span>
      <Button variant="ghost" size="sm" onClick={onRetry} className="ml-4 shrink-0 text-xs">
        Retry
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Client component
// ---------------------------------------------------------------------------

export function ProjectDirectoriesClient() {
  const { add: addToast } = useToast();

  // Data + mutations
  const { dirs, isLoading, error, refresh, create, update, remove } =
    useProjectDirectories();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDir, setEditingDir] = useState<ProjectDirRead | undefined>(undefined);

  // Sync state map — keyed by project_id
  const [syncStates, setSyncStates] = useState<SyncStateMap>({});

  // Track which project is currently being synced
  const activeSyncIdRef = useRef<string | null>(null);

  const {
    startSync: startSyncStream,
    status: syncStatus,
    error: syncError,
    events: syncEvents,
    reset: resetSync,
  } = useSyncProgress();

  // Reflect SSE stream status → syncStates map for the active project
  useEffect(() => {
    const id = activeSyncIdRef.current;
    if (!id) return;
    if (syncStatus === "idle") return; // don't overwrite with idle on reset

    const filesUpdated = syncEvents
      .filter((e) => e.type === "sync_completed")
      .map((e) => e.files_updated ?? 0)[0];

    setSyncStates((prev) => ({
      ...prev,
      [id]: {
        status: syncStatus as SyncStatus,
        error: syncError,
        filesUpdated,
      },
    }));
  }, [syncStatus, syncError, syncEvents]);

  const handleSync = useCallback(
    (projectId: string) => {
      // Reset previous sync state for this row
      resetSync();
      activeSyncIdRef.current = projectId;
      setSyncStates((prev) => ({
        ...prev,
        [projectId]: { status: "connecting", error: null },
      }));
      startSyncStream(projectId);
    },
    [resetSync, startSyncStream],
  );

  const handleToggleEnabled = useCallback(
    async (dir: ProjectDirRead, next: boolean) => {
      try {
        await update(dir.project_id, { enabled: next });
        addToast({
          type: "success",
          message: `${dir.project_id} ${next ? "enabled" : "disabled"}.`,
        });
      } catch (err) {
        addToast({
          type: "error",
          message:
            err instanceof Error ? err.message : "Failed to update directory.",
        });
        throw err; // re-throw so the row can revert optimistically if needed
      }
    },
    [update, addToast],
  );

  const handleDelete = useCallback(
    async (projectId: string) => {
      try {
        await remove(projectId);
        addToast({ type: "success", message: `${projectId} removed.` });
      } catch (err) {
        addToast({
          type: "error",
          message: err instanceof Error ? err.message : "Failed to delete directory.",
        });
        throw err;
      }
    },
    [remove, addToast],
  );

  const handleEdit = useCallback((dir: ProjectDirRead) => {
    setEditingDir(dir);
    setModalOpen(true);
  }, []);

  const handleAddNew = useCallback(() => {
    setEditingDir(undefined);
    setModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setModalOpen(false);
    setEditingDir(undefined);
  }, []);

  const handleModalSubmit = useCallback(
    async (
      data: ProjectDirCreateRequest | ProjectDirUpdateRequest,
      mode: "create" | "edit",
    ) => {
      if (mode === "create") {
        const created = await create(data as ProjectDirCreateRequest);
        addToast({
          type: "success",
          message: `${created.project_id} added successfully.`,
        });
      } else {
        const projectId = editingDir?.project_id;
        if (!projectId) return;
        const updated = await update(projectId, data as ProjectDirUpdateRequest);
        addToast({
          type: "success",
          message: `${updated.project_id} updated.`,
        });
      }
    },
    [create, update, editingDir, addToast],
  );

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          {isLoading
            ? "Loading…"
            : `${dirs.length} director${dirs.length === 1 ? "y" : "ies"} registered`}
        </p>
        <Button size="sm" onClick={handleAddNew} disabled={isLoading}>
          <PlusIcon />
          Add Directory
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorAlert message={error} onRetry={refresh} />
      ) : (
        <ProjectDirectoriesTable
          dirs={dirs}
          syncStates={syncStates}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggleEnabled={handleToggleEnabled}
          onSync={handleSync}
        />
      )}

      {/* Add / Edit modal */}
      <ProjectDirModal
        open={modalOpen}
        onClose={handleModalClose}
        dir={editingDir}
        onSubmit={handleModalSubmit}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Icon atom
// ---------------------------------------------------------------------------

function PlusIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 4v16m8-8H4"
      />
    </svg>
  );
}
