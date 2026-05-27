"use client";

/**
 * DecisionsTab — Decisions sub-view for the Projects workspace detail page.
 *
 * Shows linked decisions for a project context pack. Allows linking existing
 * decision tables and unlinking them.
 *
 * API contract:
 *   GET    /api/projects/{projectId}/decisions/                — list links
 *   POST   /api/projects/{projectId}/decisions/                — link { decision_id }
 *   DELETE /api/projects/{projectId}/decisions/{linkId}        — unlink
 *
 * Picker modal fetches GET /api/decisions/tables for available decisions.
 *
 * P5-FE-005
 */

import { useState, useCallback } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Scale,
  Plus,
  Unlink,
  ExternalLink,
  AlertCircle,
  Loader2,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  listProjectDecisions,
  linkDecisionToProject,
  unlinkDecisionFromProject,
} from "@/lib/api/projects";
import { listDecisionTables } from "@/lib/api/decisions";
import type { ProjectDecisionLink } from "@/types/projects";
import type { DecisionTableSummary } from "@/lib/api/decisions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

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
// Skeleton rows
// ---------------------------------------------------------------------------

function SkeletonRows() {
  return (
    <div aria-busy="true" aria-label="Loading decisions" className="flex flex-col divide-y">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex items-center justify-between px-4 py-3.5">
          <div className="flex flex-col gap-1.5">
            <div className="h-4 w-44 animate-pulse rounded bg-muted" />
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-7 w-16 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ onLink }: { onLink: () => void }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-16 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Scale aria-hidden="true" className="size-5 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">No decisions linked</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Link your first decision to track framework outcomes for this project.
        </p>
      </div>
      <button
        type="button"
        onClick={onLink}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium",
          "transition-colors hover:bg-accent hover:text-accent-foreground",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <Plus aria-hidden="true" className="size-3.5" />
        Link a decision
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Decision row
// ---------------------------------------------------------------------------

interface DecisionRowProps {
  link: ProjectDecisionLink;
  onUnlink: (linkId: string) => void;
  isUnlinking: boolean;
}

function DecisionRow({ link, onUnlink, isUnlinking }: DecisionRowProps) {
  const [confirming, setConfirming] = useState(false);

  const handleUnlinkClick = useCallback(() => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    onUnlink(link.id);
    setConfirming(false);
  }, [confirming, link.id, onUnlink]);

  const handleCancelConfirm = useCallback(() => {
    setConfirming(false);
  }, []);

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5">
      {/* Decision info */}
      <div className="flex min-w-0 flex-col gap-0.5">
        <Link
          href={`/decisions/${link.decision_table_id}`}
          className={cn(
            "inline-flex items-center gap-1 text-sm font-medium text-foreground truncate",
            "hover:text-primary hover:underline",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded",
          )}
        >
          {link.decision_table_name}
          <ExternalLink aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" />
        </Link>
        <p className="text-xs text-muted-foreground">
          Linked {formatDate(link.linked_at)}
        </p>
      </div>

      {/* Unlink action */}
      <div className="flex shrink-0 items-center gap-1.5">
        {confirming ? (
          <>
            <button
              type="button"
              onClick={handleUnlinkClick}
              disabled={isUnlinking}
              aria-label={`Confirm unlink decision: ${link.decision_table_name}`}
              className={cn(
                "inline-flex h-7 items-center gap-1 rounded-md border border-destructive/50 px-2 text-[11px] font-medium text-destructive",
                "transition-colors hover:bg-destructive/10",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:pointer-events-none disabled:opacity-50",
              )}
            >
              {isUnlinking ? (
                <Loader2 aria-hidden="true" className="size-3 animate-spin" />
              ) : (
                <Unlink aria-hidden="true" className="size-3" />
              )}
              Confirm
            </button>
            <button
              type="button"
              onClick={handleCancelConfirm}
              className={cn(
                "inline-flex h-7 items-center rounded-md border px-2 text-[11px] font-medium text-muted-foreground",
                "transition-colors hover:bg-accent hover:text-foreground",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={handleUnlinkClick}
            aria-label={`Unlink decision: ${link.decision_table_name}`}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-medium text-muted-foreground",
              "transition-colors hover:border-destructive/50 hover:text-destructive",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <Unlink aria-hidden="true" className="size-3" />
            Unlink
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Decision picker modal
// ---------------------------------------------------------------------------

interface DecisionPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** IDs of already-linked decision tables — excluded from picker. */
  linkedTableIds: Set<string>;
  onSelect: (decisionId: string) => void;
  isLinking: boolean;
}

function DecisionPickerModal({
  open,
  onOpenChange,
  linkedTableIds,
  onSelect,
  isLinking,
}: DecisionPickerModalProps) {
  const [query, setQuery] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["decisions", "tables", "list"],
    queryFn: () => listDecisionTables(100),
    enabled: open,
    staleTime: 30_000,
  });

  const allDecisions: DecisionTableSummary[] = data?.data ?? [];

  const filtered = allDecisions
    .filter((d) => !linkedTableIds.has(d.id))
    .filter(
      (d) =>
        query.trim().length === 0 ||
        d.name.toLowerCase().includes(query.trim().toLowerCase()),
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mx-4 max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <DialogHeader>
            <DialogTitle>Link a Decision</DialogTitle>
          </DialogHeader>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close dialog"
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground",
              "transition-colors hover:bg-accent hover:text-foreground",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <span aria-hidden="true" className="text-lg leading-none">&times;</span>
          </button>
        </div>

        {/* Search */}
        <div className="border-b px-5 py-3">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="search"
              aria-label="Search decisions"
              placeholder="Search decisions…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={cn(
                "h-8 w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-3 text-xs",
                "placeholder:text-muted-foreground",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            />
          </div>
        </div>

        {/* Body */}
        <div className="max-h-72 overflow-y-auto">
          {isLoading && (
            <div
              aria-busy="true"
              aria-label="Loading decisions"
              className="flex flex-col divide-y"
            >
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="px-5 py-3">
                  <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                  <div className="mt-1.5 h-3 w-24 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && isError && (
            <div
              role="alert"
              className="flex flex-col items-center gap-2 px-5 py-8 text-center"
            >
              <AlertCircle aria-hidden="true" className="size-5 text-destructive" />
              <p className="text-xs text-muted-foreground">
                Failed to load decisions. Try closing and reopening.
              </p>
            </div>
          )}

          {!isLoading && !isError && filtered.length === 0 && (
            <div
              role="status"
              className="px-5 py-10 text-center"
            >
              <p className="text-xs font-medium text-foreground">
                {query
                  ? "No decisions match your search"
                  : allDecisions.length === 0
                  ? "No decisions found"
                  : "All decisions are already linked"}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {!query && allDecisions.length === 0
                  ? "Create a decision table in the Decisions workspace first."
                  : null}
              </p>
            </div>
          )}

          {!isLoading && !isError && filtered.length > 0 && (
            <ul role="list" className="divide-y">
              {filtered.map((decision) => (
                <li key={decision.id}>
                  <button
                    type="button"
                    disabled={isLinking}
                    onClick={() => onSelect(decision.id)}
                    aria-label={`Link decision: ${decision.name}`}
                    className={cn(
                      "flex w-full flex-col items-start gap-0.5 px-5 py-3 text-left",
                      "transition-colors hover:bg-accent",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                      "disabled:pointer-events-none disabled:opacity-50",
                    )}
                  >
                    <span className="text-sm font-medium text-foreground">
                      {decision.name}
                    </span>
                    {decision.description && (
                      <span className="line-clamp-1 text-[11px] text-muted-foreground">
                        {decision.description}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground/70">
                      {decision.row_count} {decision.row_count === 1 ? "criterion" : "criteria"}
                      {" · "}
                      Updated {formatDate(decision.updated_at)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t px-5 py-3">
          <p className="text-[11px] text-muted-foreground">
            Select a decision table to link it to this project.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// DecisionsTab — main export
// ---------------------------------------------------------------------------

export interface DecisionsTabProps {
  projectId: string;
}

export function DecisionsTab({ projectId }: DecisionsTabProps) {
  const queryClient = useQueryClient();
  const { add: addToast } = useToast();
  const [pickerOpen, setPickerOpen] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch linked decisions
  // ---------------------------------------------------------------------------

  const {
    data: links,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["projects", projectId, "decisions"],
    queryFn: () => listProjectDecisions(projectId),
    staleTime: 30_000,
  });

  const linkedTableIds = new Set(
    (links ?? []).map((l) => l.decision_table_id),
  );

  // ---------------------------------------------------------------------------
  // Link mutation
  // ---------------------------------------------------------------------------

  const linkMutation = useMutation({
    mutationFn: (decisionId: string) =>
      linkDecisionToProject(projectId, decisionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["projects", projectId, "decisions"],
      });
      setPickerOpen(false);
      addToast({ message: "Decision linked successfully.", type: "success" });
    },
    onError: (err: Error) => {
      addToast({
        message: err.message || "Failed to link decision.",
        type: "error",
      });
    },
  });

  // ---------------------------------------------------------------------------
  // Unlink mutation
  // ---------------------------------------------------------------------------

  const unlinkMutation = useMutation({
    mutationFn: (linkId: string) =>
      unlinkDecisionFromProject(projectId, linkId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["projects", projectId, "decisions"],
      });
      addToast({ message: "Decision unlinked.", type: "success" });
    },
    onError: (err: Error) => {
      addToast({
        message: err.message || "Failed to unlink decision.",
        type: "error",
      });
    },
  });

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Linked Decisions</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Decision tables attached to this project.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          aria-label="Link a decision to this project"
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium",
            "transition-colors hover:bg-accent hover:text-accent-foreground",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <Plus aria-hidden="true" className="size-3.5" />
          Link Decision
        </button>
      </div>

      {/* Content card */}
      <div className="rounded-lg border bg-card">
        {isLoading && <SkeletonRows />}

        {!isLoading && isError && (
          <div
            role="alert"
            className="flex flex-col items-center gap-3 px-4 py-8 text-center"
          >
            <AlertCircle aria-hidden="true" className="size-6 text-destructive" />
            <p className="text-sm text-destructive">
              {error instanceof Error ? error.message : "Failed to load decisions"}
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              className={cn(
                "inline-flex h-7 items-center rounded-md border border-destructive/40 px-3 text-xs font-medium text-destructive",
                "transition-colors hover:bg-destructive/10",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              Try again
            </button>
          </div>
        )}

        {!isLoading && !isError && (links ?? []).length === 0 && (
          <div className="p-4">
            <EmptyState onLink={() => setPickerOpen(true)} />
          </div>
        )}

        {!isLoading && !isError && (links ?? []).length > 0 && (
          <ul role="list" className="divide-y">
            {(links ?? []).map((link) => (
              <li key={link.id}>
                <DecisionRow
                  link={link}
                  onUnlink={(id) => unlinkMutation.mutate(id)}
                  isUnlinking={
                    unlinkMutation.isPending &&
                    unlinkMutation.variables === link.id
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Picker modal */}
      <DecisionPickerModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        linkedTableIds={linkedTableIds}
        onSelect={(id) => linkMutation.mutate(id)}
        isLinking={linkMutation.isPending}
      />
    </div>
  );
}
