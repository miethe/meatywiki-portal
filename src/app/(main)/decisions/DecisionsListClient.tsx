"use client";

/**
 * DecisionsListClient — interactive list of Decision Framework tables.
 *
 * Features:
 * - Card grid of tables showing name, description, row count
 * - "New Table" button opens inline create form
 * - Delete table with confirm dialog
 * - Navigate to table detail on card click
 *
 * P2-5-03: Decision Framework interactive table UI.
 */

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Scale, Trash2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createDecisionTable,
  deleteDecisionTable,
} from "@/lib/api/decisions";
import type { DecisionTablesEnvelope, DecisionTableSummary } from "@/lib/api/decisions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import InfoTooltip from "@/components/ui/info-tooltip";
import { TOOLTIP_COPY } from "@/lib/copy/tooltips";
import { FirstRunOffer } from "@/components/tour/FirstRunOffer";

// ---------------------------------------------------------------------------
// Create table form (inline)
// ---------------------------------------------------------------------------

interface CreateFormProps {
  onCreated: (table: DecisionTableSummary) => void;
  onCancel: () => void;
}

function CreateTableForm({ onCreated, onCancel }: CreateFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim()) return;
      setSubmitting(true);
      setError(null);
      try {
        const table = await createDecisionTable({
          name: name.trim(),
          description: description.trim() || undefined,
        });
        onCreated(table);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create table");
        setSubmitting(false);
      }
    },
    [name, description, onCreated],
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border bg-card p-4"
      aria-label="Create new decision table"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="new-table-name" className="text-xs font-medium text-foreground">
          Table name <span className="text-destructive" aria-hidden="true">*</span>
        </label>
        <Input
          id="new-table-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Source Evaluation"
          autoFocus
          required
          disabled={submitting}
          className="h-8 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="new-table-desc" className="text-xs font-medium text-foreground">
          Description
        </label>
        <Input
          id="new-table-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Define and weight criteria for decision-making"
          disabled={submitting}
          className="h-8 text-sm"
        />
      </div>
      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle aria-hidden="true" className="size-3.5 shrink-0" />
          {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={submitting || !name.trim()}>
          {submitting ? "Creating…" : "Create table"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Table card
// ---------------------------------------------------------------------------

interface TableCardProps {
  table: DecisionTableSummary;
  onDelete: (id: string) => void;
}

function TableCard({ table, onDelete }: TableCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await deleteDecisionTable(table.id);
      onDelete(table.id);
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }, [table.id, onDelete]);

  return (
    <div className="group relative flex flex-col rounded-lg border bg-card transition-shadow hover:shadow-sm">
      <Link
        href={`/decisions/${table.id}`}
        className="flex flex-col gap-2 p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-lg"
        aria-label={`Open ${table.name} decision table`}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
            <Scale aria-hidden="true" className="size-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{table.name}</p>
            {table.description && (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {table.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between pl-11">
          <span className="text-xs text-muted-foreground">
            {table.row_count === 1
              ? "1 criterion"
              : `${table.row_count} criteria`}
          </span>
          <span className="text-xs text-muted-foreground">
            {new Date(table.updated_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>
      </Link>

      {/* Delete button — shown on hover */}
      <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        {confirmDelete ? (
          <div className="flex items-center gap-1 rounded-md border bg-card p-1 shadow-sm">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className={cn(
                "rounded px-2 py-0.5 text-xs font-medium text-destructive transition-colors",
                "hover:bg-destructive hover:text-destructive-foreground",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:opacity-50",
              )}
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className={cn(
                "rounded px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setConfirmDelete(true);
            }}
            aria-label={`Delete ${table.name}`}
            className={cn(
              "rounded-md p-1.5 text-muted-foreground transition-colors",
              "hover:bg-destructive/10 hover:text-destructive",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <Trash2 aria-hidden="true" className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <Scale aria-hidden="true" className="size-6 text-primary" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">No decision tables yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Create a table to define and weight criteria for research decisions.
        </p>
      </div>
      <Button size="sm" onClick={onNew}>
        <Plus aria-hidden="true" className="size-4" />
        New table
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface DecisionsListClientProps {
  initialData: DecisionTablesEnvelope;
}

export function DecisionsListClient({ initialData }: DecisionsListClientProps) {
  const [tables, setTables] = useState<DecisionTableSummary[]>(
    initialData.data,
  );
  const [showCreate, setShowCreate] = useState(false);
  const router = useRouter();

  const handleCreated = useCallback(
    (table: DecisionTableSummary) => {
      setShowCreate(false);
      router.push(`/decisions/${table.id}`);
    },
    [router],
  );

  const handleDelete = useCallback((id: string) => {
    setTables((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <>
      {/* P3-06: First-run tour offer banner */}
      <FirstRunOffer tourId="decisions" tourLabel="Decisions" />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Decisions</h1>
            <InfoTooltip
              content={TOOLTIP_COPY.decisions.decisionFramework}
              side="right"
              label="About the Decision Framework"
            />
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Decision Framework tables — define and weight evaluation criteria
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)} disabled={showCreate}>
          <Plus aria-hidden="true" className="size-4" />
          New table
        </Button>
      </div>

      {/* Inline create form */}
      {showCreate && (
        <CreateTableForm
          onCreated={handleCreated}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Table grid or empty state */}
      {tables.length === 0 && !showCreate ? (
        <EmptyState onNew={() => setShowCreate(true)} />
      ) : (
        <>
          <section aria-label="Decision tables" data-tour="decisions-list">
            <ul
              role="list"
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
            >
              {tables.map((table) => (
                <li key={table.id}>
                  <TableCard table={table} onDelete={handleDelete} />
                </li>
              ))}
            </ul>
          </section>
          <p className="text-xs text-muted-foreground">
            {tables.length === 1 ? "1 table" : `${tables.length} tables`}
          </p>
        </>
      )}
    </>
  );
}
