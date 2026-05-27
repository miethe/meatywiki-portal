"use client";

/**
 * ContextPackBuilderDialog — 2-step Dialog wizard to build a context pack from
 * within a project detail page (P5-FE-006).
 *
 * Step 1 — Attach artifacts:
 *   Search + multi-select artifacts. Selected items shown in a removable chip
 *   list below the results. "Next" advances to step 2.
 *
 * Step 2 — Compile pack:
 *   Summary of selected artifacts. Name + description fields. "Compile" calls
 *   POST /api/projects/ (createContextPack). No dedicated
 *   POST /api/projects/{id}/compile endpoint exists yet; on success we display
 *   an auto-compile notice rather than a progress stream.
 *
 * States: loading artifact search, submitting, error (inline with retry),
 * success (summary card). "Back" returns to step 1. "Cancel" closes.
 *
 * Patterns:
 *   - Dialog/DialogContent/DialogHeader/DialogTitle from src/components/ui/dialog.tsx
 *   - search API via src/lib/api/search.ts
 *   - createContextPack + attachArtifactToProject from src/lib/api/projects.ts
 *   - useToast from src/hooks/use-toast.tsx
 *   - Button from src/components/ui/button.tsx
 *
 * WCAG 2.1 AA: dialog labelled by title, listbox multi-select, live regions
 * for errors, focus management via DialogContent.
 */

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  Search,
  Check,
  Loader2,
  AlertCircle,
  X,
  ArrowLeft,
  ArrowRight,
  PackagePlus,
  FileText,
  CheckCircle2,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { search as apiSearch } from "@/lib/api/search";
import {
  createContextPack,
  attachArtifactToProject,
} from "@/lib/api/projects";
import { useToast } from "@/hooks/use-toast";
import type { ArtifactCard } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WizardStep = 1 | 2;

interface SelectedArtifact {
  id: string;
  title: string;
  type: string;
  subtype?: string | null;
}

interface SuccessResult {
  packId: string;
  packName: string;
  artifactCount: number;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ContextPackBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  /** Called after a pack is created + artifacts are attached. */
  onSuccess?: () => void;
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepIndicator({ step }: { step: WizardStep }) {
  const steps: { num: WizardStep; label: string }[] = [
    { num: 1, label: "Select artifacts" },
    { num: 2, label: "Compile pack" },
  ];
  return (
    <nav aria-label="Builder steps" className="flex items-center gap-2">
      {steps.map(({ num, label }, i) => {
        const active = num === step;
        const done = num < step;
        return (
          <div key={num} className="flex items-center gap-2">
            {i > 0 && (
              <div
                aria-hidden="true"
                className={cn("h-px w-6 shrink-0", done ? "bg-primary" : "bg-border")}
              />
            )}
            <div
              aria-current={active ? "step" : undefined}
              className="flex items-center gap-1.5"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                  active
                    ? "bg-primary text-primary-foreground"
                    : done
                      ? "bg-primary/20 text-primary"
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

// ---------------------------------------------------------------------------
// Artifact chip (selected item with remove button)
// ---------------------------------------------------------------------------

function ArtifactChip({
  artifact,
  onRemove,
}: {
  artifact: SelectedArtifact;
  onRemove: (id: string) => void;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-1.5 rounded-full border bg-muted/60 py-1 pl-2.5 pr-1.5",
        "text-xs font-medium text-foreground",
      )}
    >
      <span className="max-w-[140px] truncate">{artifact.title}</span>
      <button
        type="button"
        aria-label={`Remove ${artifact.title}`}
        onClick={() => onRemove(artifact.id)}
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
          "text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground",
          "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        )}
      >
        <X aria-hidden="true" className="size-2.5" />
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Artifact search + multi-select
// ---------------------------------------------------------------------------

interface Step1Props {
  selected: SelectedArtifact[];
  onToggle: (artifact: SelectedArtifact) => void;
  onRemove: (id: string) => void;
  onNext: () => void;
  onCancel: () => void;
  validationError: string | null;
}

function Step1({
  selected,
  onToggle,
  onRemove,
  onNext,
  onCancel,
  validationError,
}: Step1Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ArtifactCard[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedSet = new Set(selected.map((a) => a.id));

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    debounceRef.current = setTimeout(async () => {
      try {
        const result = await apiSearch({ q: trimmed, mode: "fts", limit: 30 });
        setResults(result.data);
      } catch (err) {
        setSearchError(
          err instanceof Error ? err.message : "Search failed. Try again.",
        );
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const hasResults = results.length > 0;
  const hasQuery = query.trim().length > 0;

  const handleResultKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>, artifact: ArtifactCard) => {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        onToggle({
          id: artifact.id,
          title: artifact.title,
          type: artifact.type,
          subtype: artifact.subtype,
        });
      }
    },
    [onToggle],
  );

  return (
    <div className="flex flex-col gap-0">
      {/* Search */}
      <div className="border-b px-5 pt-4 pb-3">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            placeholder="Search artifacts to include…"
            value={query}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
            aria-label="Search artifacts"
            aria-autocomplete="list"
            aria-controls="cpb-results"
            className={cn(
              "h-9 w-full rounded-md border border-input bg-background py-1.5 pl-9 pr-9 text-sm",
              "placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          />
          {isSearching && (
            <Loader2
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground"
            />
          )}
        </div>
      </div>

      {/* Results */}
      <div
        id="cpb-results"
        role="listbox"
        aria-label="Search results"
        aria-multiselectable="true"
        className="min-h-[200px] max-h-[260px] overflow-y-auto border-b"
      >
        {searchError && (
          <div
            role="alert"
            className="flex items-center gap-2 px-5 py-3 text-xs text-destructive"
          >
            <AlertCircle aria-hidden="true" className="size-3.5 shrink-0" />
            {searchError}
          </div>
        )}

        {!hasQuery && !isSearching && (
          <p className="px-5 py-10 text-center text-xs text-muted-foreground">
            Type to search your artifact library.
          </p>
        )}

        {hasQuery && !isSearching && !searchError && !hasResults && (
          <p className="px-5 py-10 text-center text-xs text-muted-foreground">
            No artifacts found for &ldquo;{query}&rdquo;.
          </p>
        )}

        {hasResults && (
          <ul className="py-1">
            {results.map((artifact) => {
              const isSelected = selectedSet.has(artifact.id);
              return (
                <li key={artifact.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() =>
                      onToggle({
                        id: artifact.id,
                        title: artifact.title,
                        type: artifact.type,
                        subtype: artifact.subtype,
                      })
                    }
                    onKeyDown={(e) => handleResultKeyDown(e, artifact)}
                    className={cn(
                      "flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors",
                      "hover:bg-accent focus:outline-none focus-visible:bg-accent",
                      isSelected && "bg-primary/5",
                    )}
                  >
                    {/* Checkbox indicator */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input",
                      )}
                    >
                      {isSelected && <Check className="size-3" />}
                    </span>

                    {/* Icon */}
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-muted">
                      <FileText
                        aria-hidden="true"
                        className="size-3.5 text-muted-foreground"
                      />
                    </span>

                    {/* Title + type */}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium leading-tight">
                        {artifact.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {artifact.type}
                        {artifact.subtype ? ` · ${artifact.subtype}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Selected chips */}
      <div className="border-b px-5 py-3">
        <div className="flex items-center justify-between gap-2">
          <span
            aria-live="polite"
            className="text-xs text-muted-foreground"
          >
            {selected.length === 0
              ? "No artifacts selected"
              : `${selected.length} artifact${selected.length === 1 ? "" : "s"} selected`}
          </span>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => selected.forEach((a) => onRemove(a.id))}
              className={cn(
                "text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline",
                "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded",
              )}
            >
              Clear all
            </button>
          )}
        </div>

        {selected.length > 0 && (
          <ul
            aria-label="Selected artifacts"
            className="mt-2.5 flex max-h-[88px] flex-wrap gap-1.5 overflow-y-auto"
          >
            {selected.map((artifact) => (
              <ArtifactChip
                key={artifact.id}
                artifact={artifact}
                onRemove={onRemove}
              />
            ))}
          </ul>
        )}

        {validationError && (
          <div
            role="alert"
            className="mt-2.5 flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-xs text-destructive"
          >
            <AlertCircle aria-hidden="true" className="size-3.5 shrink-0" />
            {validationError}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onNext}
          className="gap-1.5"
        >
          Next
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Compile pack confirmation
// ---------------------------------------------------------------------------

interface Step2Props {
  selected: SelectedArtifact[];
  projectId: string;
  onBack: () => void;
  onCancel: () => void;
  onSuccess: (result: SuccessResult) => void;
}

function Step2({ selected, projectId, onBack, onCancel, onSuccess }: Step2Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleCompile = useCallback(async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setSubmitError("Pack name is required.");
      return;
    }
    if (selected.length === 0) {
      setSubmitError("No artifacts selected. Go back and select at least one.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Step A: attach each selected artifact to the project
      // (best-effort; we continue even if some fail)
      const attachResults = await Promise.allSettled(
        selected.map((a) => attachArtifactToProject(projectId, a.id)),
      );
      const attachFailed = attachResults.filter((r) => r.status === "rejected");
      if (attachFailed.length === selected.length) {
        // All attach calls failed — surface as an error
        throw new Error(
          "Failed to attach artifacts to the project. Please try again.",
        );
      }

      // Step B: create the context pack
      const created = await createContextPack({
        name: trimmedName,
        description: description.trim() || null,
        artifact_ids: selected.map((a) => a.id),
      });

      onSuccess({
        packId: created.pack_id,
        packName: trimmedName,
        artifactCount: selected.length,
      });
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to create context pack.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [name, description, selected, projectId, onSuccess]);

  return (
    <div className="flex flex-col gap-0">
      {/* Artifact summary */}
      <div className="border-b px-5 pt-4 pb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Selected artifacts
          <span className="ml-1 font-mono text-foreground">
            ({selected.length})
          </span>
        </h3>
        <ul
          aria-label="Selected artifacts for context pack"
          className="mt-2.5 flex max-h-[160px] flex-col gap-1 overflow-y-auto"
        >
          {selected.map((artifact) => (
            <li
              key={artifact.id}
              className="flex items-center gap-2.5 rounded-md border bg-muted/30 px-2.5 py-2"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border bg-background">
                <FileText
                  aria-hidden="true"
                  className="size-3 text-muted-foreground"
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-foreground">
                  {artifact.title}
                </span>
                <span className="block truncate text-[10px] text-muted-foreground">
                  {artifact.type}
                  {artifact.subtype ? ` · ${artifact.subtype}` : ""}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Pack name + description */}
      <div className="grid gap-3 border-b px-5 py-4">
        <div className="grid gap-1.5">
          <label
            htmlFor="cpb-pack-name"
            className="text-xs font-medium text-foreground"
          >
            Pack name{" "}
            <span aria-hidden="true" className="text-destructive">
              *
            </span>
          </label>
          <input
            id="cpb-pack-name"
            value={name}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              setName(e.target.value);
              setSubmitError(null);
            }}
            placeholder="e.g. Q3 research briefing"
            maxLength={512}
            className={cn(
              "h-9 rounded-md border border-input bg-background px-3 text-sm",
              "placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          />
        </div>

        <div className="grid gap-1.5">
          <label
            htmlFor="cpb-pack-description"
            className="text-xs font-medium text-foreground"
          >
            Description{" "}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <textarea
            id="cpb-pack-description"
            value={description}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
              setDescription(e.target.value)
            }
            placeholder="What this pack is for, and how it should be used."
            rows={3}
            maxLength={8192}
            className={cn(
              "resize-y rounded-md border border-input bg-background px-3 py-2 text-sm",
              "placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          />
        </div>

        {/* Auto-compile notice (no dedicated compile endpoint) */}
        <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2.5 dark:border-blue-900/50 dark:bg-blue-950/30">
          <Info
            aria-hidden="true"
            className="mt-0.5 size-3.5 shrink-0 text-blue-600 dark:text-blue-400"
          />
          <p className="text-xs text-blue-800 dark:text-blue-200">
            Compilation will run automatically after the pack is created.
          </p>
        </div>

        {submitError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
          >
            <AlertCircle aria-hidden="true" className="mt-px size-3.5 shrink-0" />
            <span>
              {submitError}
              {" "}
              <button
                type="button"
                onClick={() => void handleCompile()}
                className="underline underline-offset-2 hover:no-underline focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
              >
                Retry
              </button>
            </span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onBack}
            disabled={isSubmitting}
            className="gap-1.5"
          >
            <ArrowLeft aria-hidden="true" className="size-3.5" />
            Back
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => void handleCompile()}
          disabled={isSubmitting}
          className="gap-1.5"
        >
          {isSubmitting ? (
            <>
              <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
              Compiling…
            </>
          ) : (
            <>
              <PackagePlus aria-hidden="true" className="size-3.5" />
              Compile pack
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Success view (shown inside the dialog after pack is created)
// ---------------------------------------------------------------------------

function SuccessView({
  result,
  onClose,
  onBuildAnother,
}: {
  result: SuccessResult;
  onClose: () => void;
  onBuildAnother: () => void;
}) {
  return (
    <div className="flex flex-col gap-0">
      <div className="px-5 py-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/50">
            <CheckCircle2
              aria-hidden="true"
              className="size-7 text-emerald-600 dark:text-emerald-400"
            />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Context pack created
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{result.packName}</span>{" "}
              is ready. Compilation will run automatically.
            </p>
          </div>

          <dl className="w-full rounded-lg border bg-muted/30 text-left">
            <div className="flex items-center justify-between border-b px-4 py-2.5">
              <dt className="text-xs font-medium text-muted-foreground">Pack ID</dt>
              <dd className="font-mono text-xs text-foreground">{result.packId}</dd>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <dt className="text-xs font-medium text-muted-foreground">Artifacts</dt>
              <dd className="font-mono text-xs text-foreground">{result.artifactCount}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onBuildAnother}
        >
          Build another
        </Button>
        <Button type="button" size="sm" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main dialog component
// ---------------------------------------------------------------------------

export function ContextPackBuilderDialog({
  open,
  onOpenChange,
  projectId,
  onSuccess,
}: ContextPackBuilderDialogProps) {
  const { add: addToast } = useToast();

  const [step, setStep] = useState<WizardStep>(1);
  const [selected, setSelected] = useState<SelectedArtifact[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<SuccessResult | null>(null);

  // Reset all state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      // Delay reset to allow close animation to finish
      const t = setTimeout(() => {
        setStep(1);
        setSelected([]);
        setValidationError(null);
        setSuccessResult(null);
      }, 250);
      return () => clearTimeout(t);
    }
  }, [open]);

  const handleToggle = useCallback((artifact: SelectedArtifact) => {
    setValidationError(null);
    setSelected((prev) => {
      const exists = prev.some((a) => a.id === artifact.id);
      if (exists) {
        return prev.filter((a) => a.id !== artifact.id);
      }
      return [...prev, artifact];
    });
  }, []);

  const handleRemove = useCallback((id: string) => {
    setSelected((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleNext = useCallback(() => {
    if (selected.length === 0) {
      setValidationError("Select at least one artifact to include in the pack.");
      return;
    }
    setValidationError(null);
    setStep(2);
  }, [selected.length]);

  const handleBack = useCallback(() => {
    setStep(1);
  }, []);

  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleSuccess = useCallback(
    (result: SuccessResult) => {
      setSuccessResult(result);
      addToast({
        message: `Context pack "${result.packName}" created with ${result.artifactCount} artifact${result.artifactCount === 1 ? "" : "s"}.`,
        type: "success",
      });
      onSuccess?.();
    },
    [addToast, onSuccess],
  );

  const handleBuildAnother = useCallback(() => {
    setStep(1);
    setSelected([]);
    setValidationError(null);
    setSuccessResult(null);
  }, []);

  const dialogTitle = successResult
    ? "Pack created"
    : step === 1
      ? "Build context pack — Step 1"
      : "Build context pack — Step 2";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex flex-col gap-0 p-0",
          "w-full max-w-lg",
        )}
        aria-describedby={undefined}
      >
        {/* Dialog header */}
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle className="text-base">{dialogTitle}</DialogTitle>
          {!successResult && (
            <div className="mt-2">
              <StepIndicator step={step} />
            </div>
          )}
          {!successResult && (
            <p className="mt-1 text-xs text-muted-foreground">
              {step === 1
                ? "Search and select the artifacts to include in the context pack."
                : "Name the pack and confirm to compile."}
            </p>
          )}
        </DialogHeader>

        {/* Body — step content */}
        {successResult ? (
          <SuccessView
            result={successResult}
            onClose={handleCancel}
            onBuildAnother={handleBuildAnother}
          />
        ) : step === 1 ? (
          <Step1
            selected={selected}
            onToggle={handleToggle}
            onRemove={handleRemove}
            onNext={handleNext}
            onCancel={handleCancel}
            validationError={validationError}
          />
        ) : (
          <Step2
            selected={selected}
            projectId={projectId}
            onBack={handleBack}
            onCancel={handleCancel}
            onSuccess={handleSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
