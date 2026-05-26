"use client";

/**
 * ProjectDirectoriesTable — table of registered project directories.
 *
 * Columns: path | project_id | enabled (inline toggle) | git_branch |
 *          last_synced_at (relative) | artifact_count | actions (Edit/Delete/Sync)
 *
 * Behaviours:
 *   - Enabled toggle: calls onToggle(dir) inline; shows spinner during save.
 *   - Sync button: calls onSync(dir.project_id); shows per-row progress/status.
 *   - Delete button: opens an AlertDialog confirmation; calls onDelete on confirm.
 *   - Edit button: calls onEdit(dir) to open the parent's modal.
 *
 * Accessibility:
 *   - Table has <caption> for screen readers.
 *   - All icon-only buttons have aria-label.
 *   - Toggle switch has role="switch" + aria-checked.
 *   - Sync progress is announced via aria-live.
 *
 * WCAG 2.1 AA compliant — follows shadcn/ui + project patterns.
 *
 * Traces: Cross-Project Knowledge Hub v2 / P5-02.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { ProjectDirRead } from "@/lib/api/project-directories";
import type { SyncStatus } from "@/hooks/useSyncProgress";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format an ISO datetime as a relative "X ago" string. */
function relativeTime(isoString: string | null): string {
  if (!isoString) return "Never";
  const diff = Date.now() - new Date(isoString).getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn("animate-spin", className ?? "size-3.5")}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

/** Inline enabled/disabled toggle — mirrors the AutoCompileSection pattern. */
function EnabledToggle({
  checked,
  saving,
  onChange,
  label,
}: {
  checked: boolean;
  saving: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={saving}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent",
        "transition-colors duration-200 ease-in-out",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-input",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none inline-block size-4 rounded-full bg-white shadow-md ring-0",
          "transition-transform duration-200 ease-in-out",
          checked ? "translate-x-4" : "translate-x-0",
        )}
      />
    </button>
  );
}

/** Per-row sync status badge shown after Sync is triggered. */
function SyncStatusBadge({
  status,
  error,
  fileCount,
}: {
  status: SyncStatus;
  error: string | null;
  fileCount?: number;
}) {
  if (status === "idle") return null;
  if (status === "connecting" || status === "streaming") {
    return (
      <span
        aria-live="polite"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground"
      >
        <Spinner />
        Syncing…
      </span>
    );
  }
  if (status === "done") {
    return (
      <span
        aria-live="polite"
        className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
          "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
        )}
      >
        {fileCount !== undefined ? `${fileCount} files` : "Done"}
      </span>
    );
  }
  if (status === "error") {
    return (
      <span
        aria-live="assertive"
        title={error ?? undefined}
        className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
          "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
        )}
      >
        Error
      </span>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

interface RowSyncState {
  status: SyncStatus;
  error: string | null;
  filesUpdated?: number;
}

interface RowProps {
  dir: ProjectDirRead;
  onEdit: (dir: ProjectDirRead) => void;
  onDelete: (projectId: string) => Promise<void>;
  onToggleEnabled: (dir: ProjectDirRead, next: boolean) => Promise<void>;
  onSync: (projectId: string) => void;
  syncState: RowSyncState;
}

function ProjectDirRow({
  dir,
  onEdit,
  onDelete,
  onToggleEnabled,
  onSync,
  syncState,
}: RowProps) {
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleToggle(next: boolean) {
    setToggling(true);
    try {
      await onToggleEnabled(dir, next);
    } finally {
      setToggling(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete(dir.project_id);
    } finally {
      setDeleting(false);
    }
  }

  const isSyncing =
    syncState.status === "connecting" || syncState.status === "streaming";

  return (
    <tr className="border-b transition-colors hover:bg-muted/50">
      {/* Path */}
      <td className="max-w-[240px] px-4 py-3 align-top">
        <span
          className="block truncate font-mono text-xs text-foreground"
          title={dir.path}
        >
          {dir.path}
        </span>
        {dir.auto_detected && (
          <span
            className={cn(
              "mt-0.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
              "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
            )}
          >
            auto
          </span>
        )}
      </td>

      {/* Project ID */}
      <td className="px-4 py-3 align-top">
        <span className="font-mono text-xs text-muted-foreground">
          {dir.project_id}
        </span>
      </td>

      {/* Enabled toggle */}
      <td className="px-4 py-3 align-middle">
        <div className="flex items-center gap-1.5">
          <EnabledToggle
            checked={dir.enabled}
            saving={toggling}
            onChange={handleToggle}
            label={`Toggle enabled for ${dir.project_id}`}
          />
          {toggling && <Spinner className="size-3 text-muted-foreground" />}
        </div>
      </td>

      {/* Git branch */}
      <td className="px-4 py-3 align-top">
        {dir.git_branch ? (
          <span className="font-mono text-xs text-muted-foreground">
            {dir.git_branch}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/40">—</span>
        )}
      </td>

      {/* Last synced */}
      <td className="px-4 py-3 align-top">
        <span
          className="text-xs text-muted-foreground"
          title={dir.last_synced_at ?? undefined}
        >
          {relativeTime(dir.last_synced_at)}
        </span>
      </td>

      {/* Artifact count */}
      <td className="px-4 py-3 text-right align-top">
        <span className="text-xs tabular-nums text-muted-foreground">
          {dir.artifact_count}
        </span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3 align-middle">
        <div className="flex items-center gap-1.5">
          {/* Sync button */}
          <Button
            variant="ghost"
            size="sm"
            disabled={isSyncing}
            onClick={() => onSync(dir.project_id)}
            aria-label={`Sync ${dir.project_id}`}
            className="h-7 px-2 text-xs"
          >
            {isSyncing ? <Spinner /> : <SyncIcon />}
            <span className="ml-1 hidden sm:inline">Sync</span>
          </Button>

          {/* Edit button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(dir)}
            aria-label={`Edit ${dir.project_id}`}
            className="h-7 px-2 text-xs"
          >
            <PencilIcon />
            <span className="ml-1 hidden sm:inline">Edit</span>
          </Button>

          {/* Delete button — wrapped in AlertDialog */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={deleting}
                aria-label={`Delete ${dir.project_id}`}
                className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                {deleting ? <Spinner /> : <TrashIcon />}
                <span className="ml-1 hidden sm:inline">Delete</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove project directory?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
                    {dir.project_id}
                  </code>{" "}
                  from the tracked directories. Existing artifacts in the vault
                  are not deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Inline sync progress badge */}
        {syncState.status !== "idle" && (
          <div className="mt-1">
            <SyncStatusBadge
              status={syncState.status}
              error={syncState.error}
              fileCount={syncState.filesUpdated}
            />
          </div>
        )}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Icon atoms (inline SVG — no extra dep)
// ---------------------------------------------------------------------------

function SyncIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-3.5"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-3.5"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-3.5"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Props + main component
// ---------------------------------------------------------------------------

export interface SyncStateMap {
  [projectId: string]: RowSyncState;
}

export interface ProjectDirectoriesTableProps {
  dirs: ProjectDirRead[];
  syncStates: SyncStateMap;
  onEdit: (dir: ProjectDirRead) => void;
  onDelete: (projectId: string) => Promise<void>;
  onToggleEnabled: (dir: ProjectDirRead, next: boolean) => Promise<void>;
  onSync: (projectId: string) => void;
}

export function ProjectDirectoriesTable({
  dirs,
  syncStates,
  onEdit,
  onDelete,
  onToggleEnabled,
  onSync,
}: ProjectDirectoriesTableProps) {
  if (dirs.length === 0) {
    return (
      <div className="rounded-md border">
        <p className="py-12 text-center text-sm text-muted-foreground">
          No project directories registered yet.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <caption className="sr-only">Registered project directories</caption>
        <thead>
          <tr className="border-b bg-muted/50">
            <th
              scope="col"
              className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground"
            >
              Path
            </th>
            <th
              scope="col"
              className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground"
            >
              Project ID
            </th>
            <th
              scope="col"
              className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground"
            >
              Enabled
            </th>
            <th
              scope="col"
              className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground"
            >
              Branch
            </th>
            <th
              scope="col"
              className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground"
            >
              Last synced
            </th>
            <th
              scope="col"
              className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground"
            >
              Artifacts
            </th>
            <th
              scope="col"
              className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground"
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {dirs.map((dir) => (
            <ProjectDirRow
              key={dir.id}
              dir={dir}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleEnabled={onToggleEnabled}
              onSync={onSync}
              syncState={
                syncStates[dir.project_id] ?? {
                  status: "idle",
                  error: null,
                }
              }
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
