"use client";

/**
 * DecisionTableClient — full interactive Decision Framework table editor.
 *
 * Features per wireframe:
 * - Breadcrumb: Research > Decisions > [Table Name]
 * - Editable title + description (inline pencil-icon toggle)
 * - Toolbar: Save, Reset, Add Criterion
 * - Data table: Criterion (editable) | Weight 0–10 (slider) | Rule Text (editable) | Delete
 * - Footer: "N criteria" count
 * - Dirty-state tracking; Save patches only changed fields
 * - Reset refetches from the server
 *
 * P2-5-03: Decision Framework interactive table UI.
 */

import {
  useState,
  useCallback,
  useRef,
  useId,
  type ChangeEvent,
} from "react";
import {
  Pencil,
  Check,
  X,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  GripVertical,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getDecisionTable,
  updateDecisionTable,
  createDecisionRow,
  updateDecisionRow,
  deleteDecisionRow,
} from "@/lib/api/decisions";
import type { DecisionTable, DecisionRow } from "@/lib/api/decisions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Local mutable row — extends DecisionRow with a client-only dirty flag */
interface LocalRow extends DecisionRow {
  /** True when this row has unsaved local edits */
  dirty: boolean;
  /** True when this is a new, not-yet-persisted row */
  isNew: boolean;
}

interface EditableHeaderState {
  editing: boolean;
  draft: string;
}

// ---------------------------------------------------------------------------
// WeightSlider — native range input styled to match the dark theme
// ---------------------------------------------------------------------------

interface WeightSliderProps {
  value: number;
  onChange: (v: number) => void;
  id: string;
  disabled?: boolean;
}

function WeightSlider({ value, onChange, id, disabled }: WeightSliderProps) {
  const percent = (value / 10) * 100;

  return (
    <div className="flex items-center gap-2">
      {/* Slider track */}
      <div className="relative flex-1">
        <input
          id={id}
          type="range"
          min={0}
          max={10}
          step={1}
          value={value}
          disabled={disabled}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onChange(Number(e.target.value))
          }
          aria-label={`Weight: ${value} of 10`}
          aria-valuemin={0}
          aria-valuemax={10}
          aria-valuenow={value}
          style={
            {
              "--slider-pct": `${percent}%`,
            } as React.CSSProperties
          }
          className={cn(
            "decision-weight-slider",
            "h-1.5 w-full cursor-pointer appearance-none rounded-full",
            "bg-border",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        />
      </div>
      {/* Numeric display */}
      <span className="w-5 shrink-0 text-right text-sm font-medium tabular-nums text-foreground">
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline editable text field — shown as plain text; pencil icon reveals input
// ---------------------------------------------------------------------------

interface InlineEditProps {
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
}

function InlineEdit({
  value,
  onCommit,
  placeholder,
  className,
  inputClassName,
  disabled,
}: InlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  const startEditing = useCallback(() => {
    setDraft(value);
    setEditing(true);
    // Focus after render
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [value]);

  const commit = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed !== value && trimmed) {
      onCommit(trimmed);
    } else if (!trimmed) {
      // Revert if emptied
      setDraft(value);
    }
    setEditing(false);
  }, [draft, value, onCommit]);

  const cancel = useCallback(() => {
    setDraft(value);
    setEditing(false);
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        commit();
      }
      if (e.key === "Escape") {
        cancel();
      }
    },
    [commit, cancel],
  );

  if (editing) {
    const sharedProps = {
      ref: inputRef as React.Ref<HTMLInputElement>,
      value: draft,
      onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setDraft(e.target.value),
      onKeyDown: handleKeyDown,
      onBlur: commit,
      placeholder,
      className: cn("h-7 py-0 text-sm", inputClassName),
    };

    return (
      <div className={cn("flex items-center gap-1", className)}>
        <Input {...sharedProps} />
        <button
          type="button"
          onClick={commit}
          aria-label="Confirm edit"
          className={cn(
            "shrink-0 rounded p-1 text-muted-foreground transition-colors",
            "hover:bg-accent hover:text-accent-foreground",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <Check aria-hidden="true" className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={cancel}
          aria-label="Cancel edit"
          className={cn(
            "shrink-0 rounded p-1 text-muted-foreground transition-colors",
            "hover:bg-accent hover:text-accent-foreground",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className={cn("group flex items-center gap-1.5", className)}>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sm",
          !value && "text-muted-foreground italic",
        )}
        title={value || placeholder}
      >
        {value || placeholder}
      </span>
      {!disabled && (
        <button
          type="button"
          onClick={startEditing}
          aria-label="Edit"
          className={cn(
            "shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity",
            "group-hover:opacity-100 focus:opacity-100",
            "hover:bg-accent hover:text-accent-foreground",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <Pencil aria-hidden="true" className="size-3" />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row component
// ---------------------------------------------------------------------------

interface RowProps {
  row: LocalRow;
  tableId: string;
  onUpdate: (rowId: string, patch: Partial<LocalRow>) => void;
  onDelete: (rowId: string) => void;
  disabled: boolean;
}

function DecisionRowItem({ row, tableId, onUpdate, onDelete, disabled }: RowProps) {
  const sliderId = useId();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleCriterionChange = useCallback(
    (v: string) => {
      onUpdate(row.id, { criterion: v, dirty: true });
    },
    [row.id, onUpdate],
  );

  const handleWeightChange = useCallback(
    (v: number) => {
      onUpdate(row.id, { weight: v, dirty: true });
    },
    [row.id, onUpdate],
  );

  const handleRuleChange = useCallback(
    (v: string) => {
      onUpdate(row.id, { rule_text: v, dirty: true });
    },
    [row.id, onUpdate],
  );

  const handleDelete = useCallback(async () => {
    if (row.isNew) {
      // Never persisted — just remove locally
      onDelete(row.id);
      return;
    }
    setDeleting(true);
    try {
      await deleteDecisionRow(tableId, row.id);
      onDelete(row.id);
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }, [row.id, row.isNew, tableId, onDelete]);

  return (
    <tr
      className={cn(
        "group border-b border-border/50 last:border-b-0 transition-colors",
        row.dirty && "bg-amber-500/5",
      )}
    >
      {/* Drag handle (visual only in v1) */}
      <td className="w-6 py-3 pl-3 pr-0">
        <GripVertical
          aria-hidden="true"
          className="size-4 text-muted-foreground/30 transition-opacity group-hover:opacity-100"
        />
      </td>

      {/* Criterion */}
      <td className="py-2 pl-2 pr-4 align-middle" style={{ minWidth: 160 }}>
        <InlineEdit
          value={row.criterion}
          onCommit={handleCriterionChange}
          placeholder="Criterion"
          disabled={disabled}
        />
      </td>

      {/* Weight slider */}
      <td className="py-2 pr-6 align-middle" style={{ width: 180, minWidth: 140 }}>
        <WeightSlider
          id={sliderId}
          value={row.weight}
          onChange={handleWeightChange}
          disabled={disabled}
        />
      </td>

      {/* Rule text */}
      <td className="py-2 pr-4 align-middle" style={{ minWidth: 200 }}>
        <InlineEdit
          value={row.rule_text}
          onCommit={handleRuleChange}
          placeholder="Rule text…"
          disabled={disabled}
          inputClassName="w-full"
          className="w-full"
        />
      </td>

      {/* Delete */}
      <td className="py-2 pr-3 align-middle">
        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || disabled}
              className={cn(
                "rounded px-1.5 py-0.5 text-xs font-medium text-destructive transition-colors",
                "hover:bg-destructive hover:text-destructive-foreground",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:opacity-50",
              )}
            >
              {deleting ? "…" : "Yes"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className={cn(
                "rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              No
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={disabled}
            aria-label={`Delete criterion: ${row.criterion}`}
            className={cn(
              "rounded-md p-1.5 text-muted-foreground transition-colors",
              "hover:bg-destructive/10 hover:text-destructive",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            <Trash2 aria-hidden="true" className="size-3.5" />
          </button>
        )}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

interface DecisionTableClientProps {
  initialTable: DecisionTable;
}

export function DecisionTableClient({ initialTable }: DecisionTableClientProps) {
  // Table metadata edit state
  const [tableNameState, setTableNameState] = useState<EditableHeaderState>({
    editing: false,
    draft: initialTable.name,
  });
  const [tableDescState, setTableDescState] = useState<EditableHeaderState>({
    editing: false,
    draft: initialTable.description ?? "",
  });
  const [tableName, setTableName] = useState(initialTable.name);
  const [tableDesc, setTableDesc] = useState(initialTable.description ?? "");
  const [tableNameDirty, setTableNameDirty] = useState(false);
  const [tableDescDirty, setTableDescDirty] = useState(false);

  // Row state — copy rows to local mutable list
  const [rows, setRows] = useState<LocalRow[]>(() =>
    initialTable.rows.map((r) => ({ ...r, dirty: false, isNew: false })),
  );

  // Save / reset state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Derived dirty flag
  // ---------------------------------------------------------------------------

  const anyDirty =
    tableNameDirty ||
    tableDescDirty ||
    rows.some((r) => r.dirty || r.isNew);

  // ---------------------------------------------------------------------------
  // Header editing
  // ---------------------------------------------------------------------------

  const startEditName = useCallback(() => {
    setTableNameState({ editing: true, draft: tableName });
  }, [tableName]);

  const commitName = useCallback((v: string) => {
    setTableName(v);
    setTableNameDirty(v !== initialTable.name);
    setTableNameState({ editing: false, draft: v });
  }, [initialTable.name]);

  const cancelName = useCallback(() => {
    setTableNameState({ editing: false, draft: tableName });
  }, [tableName]);

  const startEditDesc = useCallback(() => {
    setTableDescState({ editing: true, draft: tableDesc });
  }, [tableDesc]);

  const commitDesc = useCallback((v: string) => {
    setTableDesc(v);
    setTableDescDirty(v !== (initialTable.description ?? ""));
    setTableDescState({ editing: false, draft: v });
  }, [initialTable.description]);

  const cancelDesc = useCallback(() => {
    setTableDescState({ editing: false, draft: tableDesc });
  }, [tableDesc]);

  // ---------------------------------------------------------------------------
  // Row mutations
  // ---------------------------------------------------------------------------

  const handleRowUpdate = useCallback(
    (rowId: string, patch: Partial<LocalRow>) => {
      setRows((prev) =>
        prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r)),
      );
    },
    [],
  );

  const handleRowDelete = useCallback((rowId: string) => {
    setRows((prev) => prev.filter((r) => r.id !== rowId));
  }, []);

  const handleAddCriterion = useCallback(() => {
    const newRow: LocalRow = {
      id: `new-${Date.now()}`,
      table_id: initialTable.id,
      criterion: "New criterion",
      weight: 5,
      rule_text: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      dirty: true,
      isNew: true,
    };
    setRows((prev) => [...prev, newRow]);
  }, [initialTable.id]);

  // ---------------------------------------------------------------------------
  // Save — patches table metadata and all dirty rows
  // ---------------------------------------------------------------------------

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);

    try {
      // 1. Update table metadata if dirty
      if (tableNameDirty || tableDescDirty) {
        await updateDecisionTable(initialTable.id, {
          name: tableNameDirty ? tableName : undefined,
          description: tableDescDirty ? tableDesc : undefined,
        });
        setTableNameDirty(false);
        setTableDescDirty(false);
      }

      // 2. Process each dirty / new row
      const savedRows: LocalRow[] = [...rows];
      for (let i = 0; i < savedRows.length; i++) {
        const row = savedRows[i];
        if (!row.dirty && !row.isNew) continue;

        if (row.isNew) {
          // POST new row
          const created = await createDecisionRow(initialTable.id, {
            criterion: row.criterion,
            weight: row.weight,
            rule_text: row.rule_text,
          });
          savedRows[i] = { ...created, dirty: false, isNew: false };
        } else {
          // PATCH existing row
          const updated = await updateDecisionRow(initialTable.id, row.id, {
            criterion: row.criterion,
            weight: row.weight,
            rule_text: row.rule_text,
          });
          savedRows[i] = { ...updated, dirty: false, isNew: false };
        }
      }

      setRows(savedRows);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to save changes",
      );
    } finally {
      setSaving(false);
    }
  }, [
    initialTable.id,
    tableName,
    tableDesc,
    tableNameDirty,
    tableDescDirty,
    rows,
  ]);

  // ---------------------------------------------------------------------------
  // Reset — refetch from the server
  // ---------------------------------------------------------------------------

  const handleReset = useCallback(async () => {
    setSaveError(null);
    try {
      const fresh = await getDecisionTable(initialTable.id);
      setTableName(fresh.name);
      setTableDesc(fresh.description ?? "");
      setTableNameDirty(false);
      setTableDescDirty(false);
      setTableNameState({ editing: false, draft: fresh.name });
      setTableDescState({ editing: false, draft: fresh.description ?? "" });
      setRows(fresh.rows.map((r) => ({ ...r, dirty: false, isNew: false })));
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to reload table",
      );
    }
  }, [initialTable.id]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-4">
      {/* Breadcrumb */}
      <Breadcrumbs
        items={[
          { label: "Research", href: "/research" },
          { label: "Decisions", href: "/decisions" },
          { label: tableName },
        ]}
      />

      {/* Editable title */}
      <div className="flex flex-col gap-1">
        {tableNameState.editing ? (
          <div className="flex items-center gap-2">
            <Input
              value={tableNameState.draft}
              onChange={(e) =>
                setTableNameState((s) => ({ ...s, draft: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") commitName(tableNameState.draft.trim() || tableName);
                if (e.key === "Escape") cancelName();
              }}
              onBlur={() => commitName(tableNameState.draft.trim() || tableName)}
              autoFocus
              className="max-w-md text-2xl font-semibold h-10"
              aria-label="Table name"
            />
            <button
              type="button"
              onClick={() => commitName(tableNameState.draft.trim() || tableName)}
              aria-label="Confirm name"
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Check aria-hidden="true" className="size-4" />
            </button>
            <button
              type="button"
              onClick={cancelName}
              aria-label="Cancel name edit"
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        ) : (
          <div className="group flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{tableName}</h1>
            <button
              type="button"
              onClick={startEditName}
              aria-label="Edit table name"
              className={cn(
                "rounded p-1 text-muted-foreground opacity-0 transition-opacity",
                "group-hover:opacity-100 focus:opacity-100",
                "hover:bg-accent hover:text-accent-foreground",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <Pencil aria-hidden="true" className="size-3.5" />
            </button>
          </div>
        )}

        {/* Editable description */}
        {tableDescState.editing ? (
          <div className="flex items-center gap-2">
            <Input
              value={tableDescState.draft}
              onChange={(e) =>
                setTableDescState((s) => ({ ...s, draft: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") commitDesc(tableDescState.draft.trim());
                if (e.key === "Escape") cancelDesc();
              }}
              onBlur={() => commitDesc(tableDescState.draft.trim())}
              autoFocus
              placeholder="Add a description…"
              className="max-w-lg text-sm h-8"
              aria-label="Table description"
            />
            <button
              type="button"
              onClick={() => commitDesc(tableDescState.draft.trim())}
              aria-label="Confirm description"
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Check aria-hidden="true" className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={cancelDesc}
              aria-label="Cancel description edit"
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X aria-hidden="true" className="size-3.5" />
            </button>
          </div>
        ) : (
          <div className="group flex items-center gap-1.5">
            <p
              className={cn(
                "text-sm",
                tableDesc
                  ? "text-muted-foreground"
                  : "italic text-muted-foreground/60",
              )}
            >
              {tableDesc || "Add a description…"}
            </p>
            <button
              type="button"
              onClick={startEditDesc}
              aria-label="Edit description"
              className={cn(
                "rounded p-1 text-muted-foreground opacity-0 transition-opacity",
                "group-hover:opacity-100 focus:opacity-100",
                "hover:bg-accent hover:text-accent-foreground",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <Pencil aria-hidden="true" className="size-3" />
            </button>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving || !anyDirty}
          aria-busy={saving}
        >
          <Save aria-hidden="true" className="size-4" />
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleReset}
          disabled={saving}
          aria-label="Reset all changes from server"
        >
          <RotateCcw aria-hidden="true" className="size-4" />
          Reset
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleAddCriterion}
          disabled={saving}
        >
          <Plus aria-hidden="true" className="size-4" />
          Add Criterion
        </Button>

        {/* Dirty indicator */}
        {anyDirty && !saving && (
          <span className="text-xs text-amber-500 dark:text-amber-400">
            Unsaved changes
          </span>
        )}
      </div>

      {/* Save error */}
      {saveError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle aria-hidden="true" className="size-4 shrink-0" />
          {saveError}
        </div>
      )}

      {/* Criteria table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm" aria-label={`Criteria for ${tableName}`}>
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="w-6 py-2.5 pl-3 pr-0" aria-label="Drag handle" />
              <th
                scope="col"
                className="py-2.5 pl-2 pr-4 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Criterion
              </th>
              <th
                scope="col"
                className="py-2.5 pr-6 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
                style={{ width: 180 }}
              >
                Weight (0–10)
              </th>
              <th
                scope="col"
                className="py-2.5 pr-4 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Rule Text
              </th>
              <th
                scope="col"
                className="py-2.5 pr-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Delete
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No criteria yet.{" "}
                  <button
                    type="button"
                    onClick={handleAddCriterion}
                    className="text-primary underline underline-offset-2 hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  >
                    Add the first criterion.
                  </button>
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <DecisionRowItem
                key={row.id}
                row={row}
                tableId={initialTable.id}
                onUpdate={handleRowUpdate}
                onDelete={handleRowDelete}
                disabled={saving}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer count */}
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {rows.length === 1 ? "1 criterion" : `${rows.length} criteria`}
      </p>
    </div>
  );
}
