"use client";

/**
 * MergeProjectsDialog — Portal v2.6 P4-02.
 *
 * Allows the user to merge the current (source) project into another
 * (target) project. The surviving project keeps the merged resources
 * from both.
 *
 * Flow:
 *   1. Pick target project via combobox (excludes the source project).
 *   2. Set the final name (defaults to target name, editable).
 *   3. Preview reassignment counts (artifacts, attachments, milestones,
 *      decisions) sourced from available source/target data.
 *   4. Confirm → mergeProject(sourceId, { target_pack_id, final_name })
 *      → on success route to the surviving project + toast.
 *      Default archives the source (delete_source omitted, backend defaults true).
 *
 * Error handling:
 *   - 404 (source or target gone): toast error, dialog stays open.
 *   - 409 (same project): toast error, dialog stays open.
 *   - Any other ApiError: toast error, dialog stays open.
 *
 * Contract:
 *   - Matches P1-02 merge dialog contract.
 *   - Uses useProjectOptions() for the target picker.
 *   - Uses mergeProject() from src/lib/api/projects.ts.
 *   - Uses useToast() from src/hooks/use-toast.tsx.
 *
 * WCAG 2.1 AA: labelled combobox, role="listbox", focus-visible rings,
 * live region for error messages, describedby on confirm button.
 */

import { useState, useCallback, useRef, useId, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronsUpDown,
  Loader2,
  AlertCircle,
  GitMerge,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { mergeProject } from "@/lib/api/projects";
import { ApiError } from "@/lib/api/client";
import { useProjectOptions } from "@/hooks/useFieldOptions";
import { useToast } from "@/hooks/use-toast";
import type { ContextPack } from "@/types/projects";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MergeProjectsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The source project being merged away. */
  sourcePack: ContextPack;
  /** Optional pre-fetched list of all projects for the target picker. */
  allProjects?: { id: string; name: string; artifact_count: number }[];
}

// ---------------------------------------------------------------------------
// Combobox sub-component (inline; no external dependency)
// ---------------------------------------------------------------------------

interface ComboboxProps {
  id: string;
  options: { id: string; name: string; artifact_count: number }[];
  value: string | null;
  onChange: (id: string, name: string) => void;
  placeholder?: string;
  isLoading?: boolean;
  disabled?: boolean;
  labelId?: string;
}

function ProjectCombobox({
  id,
  options,
  value,
  onChange,
  placeholder = "Select project…",
  isLoading = false,
  disabled = false,
  labelId,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const listboxId = `${id}-listbox`;

  const selected = options.find((o) => o.id === value) ?? null;

  const filtered = query
    ? options.filter((o) => o.name.toLowerCase().includes(query.toLowerCase()))
    : options;

  // Reset active index when the filtered list changes
  useEffect(() => {
    setActiveIndex(-1);
  }, [query]);

  // Close on outside click or Escape (mousedown path)
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const el = document.getElementById(id);
      if (el && !el.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [id, open]);

  // Scroll active option into view
  useEffect(() => {
    if (!open || activeIndex < 0 || !listboxRef.current) return;
    const activeEl = listboxRef.current.querySelector<HTMLElement>(
      `[id="${listboxId}-${filtered[activeIndex]?.id}"]`,
    );
    activeEl?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open, filtered, listboxId]);

  function openPopup() {
    setOpen(true);
    setActiveIndex(-1);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function closePopup(returnFocus = true) {
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
    if (returnFocus) triggerRef.current?.focus();
  }

  function handleSelect(opt: { id: string; name: string }) {
    onChange(opt.id, opt.name);
    closePopup();
  }

  function handleTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      openPopup();
    }
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      closePopup();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < filtered.length) {
        handleSelect(filtered[activeIndex]);
      }
      return;
    }
    if (e.key === "Tab") {
      closePopup(false);
    }
  }

  const activeOptionId =
    activeIndex >= 0 && filtered[activeIndex]
      ? `${listboxId}-${filtered[activeIndex].id}`
      : undefined;

  return (
    <div id={id} className="relative">
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-labelledby={labelId}
        aria-activedescendant={activeOptionId}
        disabled={disabled || isLoading}
        onClick={() => {
          if (open) {
            closePopup();
          } else {
            openPopup();
          }
        }}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm",
          "ring-offset-background transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        <span className={cn(!selected && "text-muted-foreground")}>
          {isLoading ? "Loading…" : selected ? selected.name : placeholder}
        </span>
        {isLoading ? (
          <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md",
            "animate-in fade-in-0 zoom-in-95 slide-in-from-top-2",
          )}
        >
          {/* Search input */}
          <div className="border-b p-2">
            <input
              ref={inputRef}
              type="text"
              placeholder="Search projects…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleInputKeyDown}
              className={cn(
                "w-full rounded-sm border border-input bg-background px-2 py-1 text-sm",
                "placeholder:text-muted-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              )}
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-activedescendant={activeOptionId}
            />
          </div>

          {/* Options list */}
          <ul
            ref={listboxRef}
            id={listboxId}
            role="listbox"
            aria-label="Projects"
            className="max-h-56 overflow-y-auto p-1"
          >
            {filtered.length === 0 ? (
              <li className="px-2 py-3 text-center text-xs text-muted-foreground">
                No projects match.
              </li>
            ) : (
              filtered.map((opt, idx) => (
                <li
                  key={opt.id}
                  id={`${listboxId}-${opt.id}`}
                  role="option"
                  aria-selected={opt.id === value}
                  onClick={() => handleSelect(opt)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
                    "hover:bg-accent hover:text-accent-foreground",
                    opt.id === value && "bg-accent text-accent-foreground",
                    idx === activeIndex && "ring-2 ring-ring ring-inset",
                  )}
                >
                  <Check
                    aria-hidden="true"
                    className={cn(
                      "size-3.5 shrink-0",
                      opt.id === value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="flex-1 truncate">{opt.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {opt.artifact_count} artifacts
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preview counts component
// ---------------------------------------------------------------------------

interface MergePreviewProps {
  sourceCount: number;
  targetCount: number | null;
}

function MergePreview({ sourceCount, targetCount }: MergePreviewProps) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        After merge
      </p>
      <div className="flex items-center gap-3 text-sm">
        {/* Source */}
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-base font-semibold tabular-nums">{sourceCount}</span>
          <span className="text-xs text-muted-foreground">from source</span>
        </div>
        <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        {/* Target */}
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-base font-semibold tabular-nums">
            {targetCount !== null ? targetCount : "—"}
          </span>
          <span className="text-xs text-muted-foreground">in target</span>
        </div>
        {/* Result */}
        <span className="text-xs text-muted-foreground">=</span>
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-base font-semibold tabular-nums text-primary">
            {targetCount !== null ? sourceCount + targetCount : "—"}
          </span>
          <span className="text-xs text-muted-foreground">total artifacts</span>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Source project will be archived. Milestones and decisions are reassigned
        to the surviving project.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main dialog component
// ---------------------------------------------------------------------------

export function MergeProjectsDialog({
  open,
  onOpenChange,
  sourcePack,
  allProjects,
}: MergeProjectsDialogProps) {
  const router = useRouter();
  const { add: addToast } = useToast();

  const { data: fetchedOptions, isLoading: optionsLoading } = useProjectOptions();

  // allProjects prop acts as an optional pre-fetched override; fall back to the
  // hook result. If neither is available yet, default to an empty array.
  const projectOptions = allProjects ?? fetchedOptions;

  // Filter out the source project from target options
  const targetOptions = projectOptions
    ? projectOptions.filter((p) => p.id !== sourcePack.pack_id)
    : [];

  // Form state
  const [targetId, setTargetId] = useState<string | null>(null);
  const [finalName, setFinalName] = useState("");
  const [isMerging, setIsMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const comboboxId = useId();
  const nameInputId = useId();
  const errorId = useId();

  // When target changes, default the final name to the target's name
  const handleTargetChange = useCallback(
    (id: string, name: string) => {
      setTargetId(id);
      setFinalName(name);
      setError(null);
    },
    [],
  );

  // Reset on close
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setTargetId(null);
        setFinalName("");
        setError(null);
        setIsMerging(false);
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange],
  );

  const selectedTarget = targetOptions.find((o) => o.id === targetId) ?? null;

  async function handleConfirm() {
    if (!targetId) {
      setError("Please select a target project.");
      return;
    }
    if (!finalName.trim()) {
      setError("Final name cannot be empty.");
      return;
    }

    setIsMerging(true);
    setError(null);

    try {
      const result = await mergeProject(sourcePack.pack_id, {
        target_pack_id: targetId,
        final_name: finalName.trim(),
        // delete_source omitted → backend defaults to true (archive)
      });

      addToast({
        type: "success",
        message: `Merged into "${finalName.trim()}". ${result.absorbed_artifact_count} artifacts transferred.`,
      });

      handleOpenChange(false);
      router.push(`/projects/${encodeURIComponent(result.surviving_pack_id)}`);
    } catch (err) {
      if (err instanceof ApiError) {
        switch (err.status) {
          case 404:
            setError("One of the projects was not found. It may have been deleted.");
            break;
          case 409:
            setError("Cannot merge a project into itself.");
            break;
          case 422: {
            // Surface backend validation detail when available
            const detail =
              err.body != null && typeof err.body === "object" && "detail" in err.body
                ? String((err.body as { detail: unknown }).detail)
                : null;
            setError(detail ? `Validation error: ${detail}` : "Merge request was invalid.");
            break;
          }
          default:
            setError(`Merge failed: ${err.message}`);
        }
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        setError(`Merge failed: ${msg}`);
      }

      addToast({ type: "error", message: "Merge failed — see dialog for details." });
    } finally {
      setIsMerging(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
              <GitMerge aria-hidden="true" className="size-4 text-primary" />
            </div>
            <DialogTitle>Merge Project</DialogTitle>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Merge{" "}
            <span className="font-medium text-foreground">{sourcePack.name}</span>{" "}
            into another project. All artifacts, milestones, and decisions will be
            transferred to the target.
          </p>
        </DialogHeader>

        <div className="flex flex-col gap-4 pt-2">
          {/* Error region */}
          {error && (
            <div
              id={errorId}
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
            >
              <AlertCircle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Target picker */}
          <div className="flex flex-col gap-1.5">
            <label
              id={`${comboboxId}-label`}
              htmlFor={comboboxId}
              className="text-sm font-medium"
            >
              Target project
              <span aria-hidden="true" className="ml-0.5 text-destructive">*</span>
            </label>
            <ProjectCombobox
              id={comboboxId}
              labelId={`${comboboxId}-label`}
              options={targetOptions}
              value={targetId}
              onChange={handleTargetChange}
              isLoading={optionsLoading}
              disabled={isMerging}
              placeholder="Choose target project…"
            />
            <p className="text-xs text-muted-foreground">
              All resources will be moved to this project.
            </p>
          </div>

          {/* Final name */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor={nameInputId} className="text-sm font-medium">
              Surviving project name
              <span aria-hidden="true" className="ml-0.5 text-destructive">*</span>
            </label>
            <input
              id={nameInputId}
              type="text"
              value={finalName}
              onChange={(e) => setFinalName(e.target.value)}
              placeholder="Name for the surviving project…"
              disabled={isMerging || !targetId}
              aria-describedby={error ? errorId : undefined}
              className={cn(
                "h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
                "placeholder:text-muted-foreground ring-offset-background",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            />
            <p className="text-xs text-muted-foreground">
              Defaults to the target&apos;s name. Edit to rename the surviving project.
            </p>
          </div>

          {/* Merge preview */}
          <MergePreview
            sourceCount={sourcePack.artifact_count}
            targetCount={selectedTarget?.artifact_count ?? null}
          />

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              disabled={isMerging}
              className={cn(
                "inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={isMerging || !targetId || !finalName.trim()}
              aria-describedby={error ? errorId : undefined}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors",
                "hover:bg-primary/90",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {isMerging ? (
                <>
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                  Merging…
                </>
              ) : (
                <>
                  <GitMerge aria-hidden="true" className="size-4" />
                  Confirm merge
                </>
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
