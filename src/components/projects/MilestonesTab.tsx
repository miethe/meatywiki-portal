"use client";

/**
 * MilestonesTab — sub-view for the Projects detail page Milestones tab.
 *
 * Features:
 *   - List milestones ordered by created_at (server order preserved).
 *   - Inline create: title input + optional date picker + "Add" button.
 *   - Status toggle: click badge to toggle open ↔ done via PATCH.
 *   - Inline title edit: click title to swap to an input; save on blur/Enter,
 *     cancel on Escape.
 *   - Delete: trash button opens an AlertDialog confirmation.
 *   - Empty state + skeleton loading.
 *
 * Backend contract:
 *   GET    /api/projects/{projectId}/milestones/
 *   POST   /api/projects/{projectId}/milestones/      { title, due_date? }
 *   PATCH  /api/projects/{projectId}/milestones/{id}  { title?, due_date?, status? }
 *   DELETE /api/projects/{projectId}/milestones/{id}
 *
 * Patterns:
 *   - TanStack Query (useQuery + useMutation) with optimistic cache invalidation.
 *   - useToast for success/error notifications.
 *   - shadcn/ui Alert Dialog for delete confirmation.
 *   - WCAG 2.1 AA: all interactive controls have accessible labels / roles.
 *
 * Traces: audit-wave-3 P5-FE-004
 */

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  listMilestones,
  createMilestone,
  updateMilestone,
  deleteMilestone,
} from "@/lib/api/projects";
import { useToast } from "@/hooks/use-toast";
import type { ProjectMilestone } from "@/types/projects";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDueDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function queryKey(projectId: string) {
  return ["projects", "milestones", projectId] as const;
}

// ---------------------------------------------------------------------------
// Spinner
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

// ---------------------------------------------------------------------------
// Skeleton row
// ---------------------------------------------------------------------------

function SkeletonRow() {
  return (
    <li className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
      <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
      <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
      <div className="h-4 w-20 animate-pulse rounded bg-muted" />
      <div className="h-7 w-7 animate-pulse rounded bg-muted" />
    </li>
  );
}

// ---------------------------------------------------------------------------
// Status badge — clickable to toggle
// ---------------------------------------------------------------------------

interface StatusBadgeProps {
  status: "open" | "done";
  saving: boolean;
  onToggle: () => void;
}

function StatusBadge({ status, saving, onToggle }: StatusBadgeProps) {
  const isDone = status === "done";
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={saving}
      aria-label={isDone ? "Mark as open" : "Mark as done"}
      title={isDone ? "Click to reopen" : "Click to mark done"}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        "disabled:cursor-not-allowed disabled:opacity-60",
        isDone
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-950/60"
          : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400 dark:hover:bg-amber-950/60",
      )}
    >
      {saving ? (
        <Spinner className="size-3" />
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            "size-1.5 rounded-full",
            isDone ? "bg-emerald-500" : "bg-amber-500",
          )}
        />
      )}
      {isDone ? "Done" : "Open"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Milestone row
// ---------------------------------------------------------------------------

interface MilestoneRowProps {
  milestone: ProjectMilestone;
  projectId: string;
}

function MilestoneRow({ milestone, projectId }: MilestoneRowProps) {
  const queryClient = useQueryClient();
  const { add: addToast } = useToast();

  // Inline edit state
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(milestone.title);
  const inputRef = useRef<HTMLInputElement>(null);

  // Status toggle mutation
  const toggleMutation = useMutation({
    mutationFn: () =>
      updateMilestone(projectId, milestone.id, {
        status: milestone.status === "open" ? "done" : "open",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKey(projectId) });
    },
    onError: () => {
      addToast({ message: "Failed to update milestone status.", type: "error" });
    },
  });

  // Title update mutation
  const titleMutation = useMutation({
    mutationFn: (title: string) =>
      updateMilestone(projectId, milestone.id, { title }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKey(projectId) });
      setEditing(false);
    },
    onError: () => {
      addToast({ message: "Failed to update milestone title.", type: "error" });
      setEditing(false);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => deleteMilestone(projectId, milestone.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKey(projectId) });
      addToast({ message: "Milestone deleted.", type: "success" });
    },
    onError: () => {
      addToast({ message: "Failed to delete milestone.", type: "error" });
    },
  });

  function startEdit() {
    setEditValue(milestone.title);
    setEditing(true);
    // Focus input after render
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function commitEdit() {
    const trimmed = editValue.trim();
    if (!trimmed) {
      setEditing(false);
      return;
    }
    if (trimmed === milestone.title) {
      setEditing(false);
      return;
    }
    titleMutation.mutate(trimmed);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
    }
    if (e.key === "Escape") {
      setEditing(false);
    }
  }

  const isSavingTitle = titleMutation.isPending;
  const isSavingStatus = toggleMutation.isPending;

  return (
    <li className="group flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-muted/30">
      {/* Status badge / toggle */}
      <StatusBadge
        status={milestone.status}
        saving={isSavingStatus}
        onToggle={() => toggleMutation.mutate()}
      />

      {/* Title — inline edit */}
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            disabled={isSavingTitle}
            aria-label="Edit milestone title"
            className={cn(
              "w-full rounded border border-input bg-background px-2 py-0.5 text-sm",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:opacity-50",
            )}
          />
        ) : (
          <button
            type="button"
            onClick={startEdit}
            aria-label={`Edit title: ${milestone.title}`}
            title="Click to edit title"
            className={cn(
              "block w-full truncate text-left text-sm",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded",
              milestone.status === "done"
                ? "text-muted-foreground line-through"
                : "text-foreground",
              "hover:underline decoration-dashed underline-offset-2",
            )}
          >
            {milestone.title}
            {isSavingTitle && (
              <Spinner className="ml-1.5 inline size-3 text-muted-foreground" />
            )}
          </button>
        )}
      </div>

      {/* Due date */}
      {milestone.due_date ? (
        <span
          className={cn(
            "shrink-0 text-xs",
            // Flag overdue open milestones
            milestone.status === "open" &&
              new Date(milestone.due_date) < new Date()
              ? "font-medium text-destructive"
              : "text-muted-foreground",
          )}
          aria-label={`Due ${formatDueDate(milestone.due_date)}`}
        >
          {formatDueDate(milestone.due_date)}
        </span>
      ) : (
        <span className="shrink-0 text-xs text-muted-foreground/40">—</span>
      )}

      {/* Delete */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            type="button"
            aria-label={`Delete milestone: ${milestone.title}`}
            disabled={deleteMutation.isPending}
            className={cn(
              "shrink-0 rounded p-1 text-muted-foreground/40 transition-colors",
              "hover:bg-destructive/10 hover:text-destructive",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
            )}
          >
            {deleteMutation.isPending ? (
              <Spinner className="size-4" />
            ) : (
              <TrashIcon />
            )}
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete milestone?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{milestone.title}&rdquo; will be permanently removed. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Create form
// ---------------------------------------------------------------------------

interface CreateFormProps {
  projectId: string;
}

function CreateForm({ projectId }: CreateFormProps) {
  const queryClient = useQueryClient();
  const { add: addToast } = useToast();

  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [titleError, setTitleError] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      createMilestone(projectId, {
        title: title.trim(),
        due_date: dueDate || null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKey(projectId) });
      setTitle("");
      setDueDate("");
      setTitleError(false);
      addToast({ message: "Milestone added.", type: "success" });
      titleInputRef.current?.focus();
    },
    onError: () => {
      addToast({ message: "Failed to add milestone.", type: "error" });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setTitleError(true);
      titleInputRef.current?.focus();
      return;
    }
    setTitleError(false);
    createMutation.mutate();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-lg border bg-card p-4 sm:flex-row sm:items-start"
      aria-label="Add milestone"
    >
      {/* Title input */}
      <div className="flex-1">
        <label htmlFor="milestone-title" className="sr-only">
          Milestone title (required)
        </label>
        <Input
          id="milestone-title"
          ref={titleInputRef}
          type="text"
          placeholder="Milestone title…"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (e.target.value.trim()) setTitleError(false);
          }}
          aria-required="true"
          aria-invalid={titleError}
          aria-describedby={titleError ? "milestone-title-error" : undefined}
          className={cn(
            "h-9 text-sm",
            titleError && "border-destructive focus-visible:ring-destructive",
          )}
        />
        {titleError && (
          <p
            id="milestone-title-error"
            role="alert"
            className="mt-1 text-xs text-destructive"
          >
            Title is required.
          </p>
        )}
      </div>

      {/* Due date */}
      <div>
        <label htmlFor="milestone-due-date" className="sr-only">
          Due date (optional)
        </label>
        <input
          id="milestone-due-date"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          aria-label="Due date (optional)"
          className={cn(
            "h-9 rounded-md border border-input bg-background px-3 py-1 text-sm",
            "text-foreground placeholder:text-muted-foreground",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        />
      </div>

      {/* Submit */}
      <Button
        type="submit"
        size="sm"
        disabled={createMutation.isPending}
        className="h-9 shrink-0"
      >
        {createMutation.isPending ? (
          <>
            <Spinner className="mr-1.5 size-3.5" />
            Adding…
          </>
        ) : (
          "Add"
        )}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Trash icon
// ---------------------------------------------------------------------------

function TrashIcon() {
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
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export interface MilestonesTabProps {
  projectId: string;
}

export function MilestonesTab({ projectId }: MilestonesTabProps) {
  const { data: milestones, isLoading, isError, error } = useQuery({
    queryKey: queryKey(projectId),
    queryFn: () => listMilestones(projectId),
    staleTime: 30_000,
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Create form */}
      <CreateForm projectId={projectId} />

      {/* List */}
      {isLoading ? (
        <ul aria-label="Loading milestones" aria-busy="true" className="flex flex-col gap-2">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </ul>
      ) : isError ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive"
        >
          Failed to load milestones.
          {error instanceof Error && (
            <span className="ml-1 text-muted-foreground">({error.message})</span>
          )}
        </div>
      ) : !milestones || milestones.length === 0 ? (
        <div
          role="status"
          className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-14 text-center"
        >
          <MilestoneIcon className="size-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-foreground">No milestones yet</p>
          <p className="text-xs text-muted-foreground">
            Add your first milestone above.
          </p>
        </div>
      ) : (
        <ul
          aria-label="Milestones"
          className="flex flex-col gap-2"
        >
          {milestones.map((m) => (
            <MilestoneRow key={m.id} milestone={m} projectId={projectId} />
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Milestone icon
// ---------------------------------------------------------------------------

function MilestoneIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 12h2.25m13.5 0H21M12 3v2.25m0 13.5V21M5.636 5.636l1.591 1.591M16.773 16.773l1.591 1.591M5.636 18.364l1.591-1.591M16.773 7.227l1.591-1.591"
      />
    </svg>
  );
}
