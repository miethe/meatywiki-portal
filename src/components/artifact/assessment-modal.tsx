"use client";

/**
 * AssessmentModal — Lens dimension write path for an artifact.
 *
 * Triggered by clicking a Lens Badge on the Artifact Detail screen. Presents
 * all eight Lens dimensions in an editable form:
 *
 *   Numeric (0–10 range inputs):
 *     novelty, clarity, significance, originality, rigor, utility
 *
 *   Categorical (select):
 *     verification_status: unverified | partial | verified
 *     fidelity:            speculative | contested | established
 *
 *   Optional per-dimension rationale text area.
 *
 * On submit: PATCH /api/artifacts/:id/lens → success → close + onSuccess().
 * Cancel: close without save.
 * Error: inline error banner, no close.
 * Loading: submit button shows spinner; inputs disabled.
 *
 * Design invariants:
 *   - Only changed fields (diff from initialValues) are sent.
 *   - WCAG 2.1 AA: role="dialog", labelled by heading, focus-trapped via
 *     autoFocus on first input. All inputs have explicit <label>.
 *   - Follows QuickAddModal patterns (custom-built, no Radix dep).
 *
 * Portal v1.5 Phase 1 (P1.5-1-04).
 * Traces FR-1.5-02.
 */

import { useState, useId, useCallback } from "react";
import { cn } from "@/lib/utils";
import { patchArtifactLens } from "@/lib/api/artifacts";
import { ApiError } from "@/lib/api/client";
import type {
  ArtifactMetadataResponse,
  LensFidelityLevel,
  LensPatchRequest,
  LensRationaleMap,
  LensVerificationStatus,
} from "@/types/artifact";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NUMERIC_DIMS = [
  "novelty",
  "clarity",
  "significance",
  "originality",
  "rigor",
  "utility",
] as const;

type NumericDim = (typeof NUMERIC_DIMS)[number];

const VERIFICATION_OPTIONS: LensVerificationStatus[] = [
  "unverified",
  "partial",
  "verified",
];

const FIDELITY_OPTIONS: LensFidelityLevel[] = [
  "speculative",
  "contested",
  "established",
];

const DIM_LABELS: Record<string, string> = {
  novelty: "Novelty",
  clarity: "Clarity",
  significance: "Significance",
  originality: "Originality",
  rigor: "Rigor",
  utility: "Utility",
  verification_status: "Verification Status",
  fidelity: "Fidelity",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Initial values drawn from a loaded ArtifactMetadataResponse (or null). */
export interface AssessmentInitialValues {
  novelty?: number | null;
  clarity?: number | null;
  significance?: number | null;
  originality?: number | null;
  rigor?: number | null;
  utility?: number | null;
  verification_status?: LensVerificationStatus | null;
  fidelity?: LensFidelityLevel | null;
  lens_rationale_jsonb?: LensRationaleMap;
}

export interface AssessmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artifactId: string;
  /**
   * Current field values for pre-populating the form.
   * Pass `null` or `undefined` to start with blank form.
   */
  initialValues?: AssessmentInitialValues | null;
  /**
   * Called after a successful PATCH with the updated metadata.
   * Parent should use this to trigger badge re-render.
   */
  onSuccess?: (updated: ArtifactMetadataResponse) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse an input string to a nullable integer clamped 0–10.
 * Returns null for empty / non-numeric input.
 */
function parseScore(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(10, n));
}

/**
 * Build a LensPatchRequest containing only the fields that differ from
 * initial values. Sends null explicitly only when the user clears a field
 * that had a value.
 */
function buildPatch(
  numeric: Record<NumericDim, string>,
  verificationStatus: LensVerificationStatus | "",
  fidelity: LensFidelityLevel | "",
  rationale: Record<string, string>,
  initial: AssessmentInitialValues | null | undefined,
): LensPatchRequest {
  const patch: LensPatchRequest = {};

  for (const dim of NUMERIC_DIMS) {
    const parsed = parseScore(numeric[dim]);
    const init = initial?.[dim] ?? null;
    if (parsed !== init) {
      patch[dim] = parsed;
    }
  }

  const newVS = verificationStatus || null;
  if (newVS !== (initial?.verification_status ?? null)) {
    patch.verification_status = newVS as LensVerificationStatus | null;
  }

  const newFid = fidelity || null;
  if (newFid !== (initial?.fidelity ?? null)) {
    patch.fidelity = newFid as LensFidelityLevel | null;
  }

  // Build rationale map from any non-empty rationale entries
  const existingRationale = initial?.lens_rationale_jsonb ?? {};
  const allDims = [...NUMERIC_DIMS, "verification_status", "fidelity"] as const;

  let rationaleChanged = false;
  const rationaleMap: LensRationaleMap = {};

  for (const dim of allDims) {
    const newText = rationale[dim]?.trim() ?? "";
    const oldText = existingRationale[dim]?.rationale?.trim() ?? "";
    if (newText !== oldText) {
      rationaleChanged = true;
    }
    if (newText) {
      rationaleMap[dim] = { rationale: newText };
    } else if (existingRationale[dim]) {
      // Preserve existing entry structure but with cleared rationale
      rationaleMap[dim] = { ...existingRationale[dim], rationale: null };
    }
  }

  if (rationaleChanged) {
    patch.rationale = rationaleMap;
  }

  return patch;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface NumericFieldProps {
  id: string;
  dim: NumericDim;
  value: string;
  onChange: (val: string) => void;
  rationaleValue: string;
  onRationaleChange: (val: string) => void;
  disabled: boolean;
  initialRationale?: string | null;
}

function NumericField({
  id,
  dim,
  value,
  onChange,
  rationaleValue,
  onRationaleChange,
  disabled,
}: NumericFieldProps) {
  const inputId = `${id}-${dim}`;
  const rationaleId = `${id}-${dim}-rationale`;
  const parsed = parseScore(value);
  const pct = parsed !== null ? (parsed / 10) * 100 : 0;
  const showBar = parsed !== null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-3">
        <label
          htmlFor={inputId}
          className="w-28 shrink-0 text-sm font-medium text-foreground"
        >
          {DIM_LABELS[dim]}
        </label>
        <input
          id={inputId}
          type="number"
          min={0}
          max={10}
          step={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="—"
          disabled={disabled}
          aria-describedby={`${inputId}-range`}
          className={cn(
            "w-16 rounded-md border bg-background px-2 py-1 text-sm text-center",
            "placeholder:text-muted-foreground",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:opacity-50",
          )}
        />
        <span
          id={`${inputId}-range`}
          className="text-xs text-muted-foreground"
          aria-label="Score range"
        >
          / 10
        </span>
        {showBar && (
          <div
            role="presentation"
            className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden"
            aria-hidden="true"
          >
            <div
              className={cn(
                "h-full rounded-full transition-all",
                pct >= 70
                  ? "bg-emerald-500"
                  : pct >= 40
                  ? "bg-amber-500"
                  : "bg-rose-400",
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>
      <div className="pl-[calc(7rem+0.75rem)]">
        <label htmlFor={rationaleId} className="sr-only">
          {DIM_LABELS[dim]} rationale
        </label>
        <textarea
          id={rationaleId}
          value={rationaleValue}
          onChange={(e) => onRationaleChange(e.target.value)}
          rows={1}
          placeholder="Rationale (optional)"
          disabled={disabled}
          className={cn(
            "w-full resize-none rounded-md border bg-background px-2 py-1.5 text-xs",
            "placeholder:text-muted-foreground",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:opacity-50",
          )}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main modal
// ---------------------------------------------------------------------------

export function AssessmentModal({
  open,
  onOpenChange,
  artifactId,
  initialValues,
  onSuccess,
}: AssessmentModalProps) {
  const baseId = useId();

  // Numeric dimension state — stored as strings to handle empty/partial input
  const [numeric, setNumeric] = useState<Record<NumericDim, string>>(() => {
    const init: Record<NumericDim, string> = {
      novelty: "",
      clarity: "",
      significance: "",
      originality: "",
      rigor: "",
      utility: "",
    };
    for (const dim of NUMERIC_DIMS) {
      const v = initialValues?.[dim];
      init[dim] = v != null ? String(v) : "";
    }
    return init;
  });

  const [verificationStatus, setVerificationStatus] = useState<
    LensVerificationStatus | ""
  >(initialValues?.verification_status ?? "");

  const [fidelity, setFidelity] = useState<LensFidelityLevel | "">(
    initialValues?.fidelity ?? "",
  );

  // Rationale per dimension
  const [rationale, setRationale] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    const existing = initialValues?.lens_rationale_jsonb ?? {};
    for (const dim of [...NUMERIC_DIMS, "verification_status", "fidelity"]) {
      init[dim] = existing[dim]?.rationale ?? "";
    }
    return init;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleNumericChange = useCallback(
    (dim: NumericDim, val: string) => {
      setNumeric((prev) => ({ ...prev, [dim]: val }));
    },
    [],
  );

  const handleRationaleChange = useCallback((dim: string, val: string) => {
    setRationale((prev) => ({ ...prev, [dim]: val }));
  }, []);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const patch = buildPatch(
      numeric,
      verificationStatus,
      fidelity,
      rationale,
      initialValues,
    );

    // Nothing changed — close without calling API
    if (Object.keys(patch).length === 0) {
      handleClose();
      return;
    }

    setIsSubmitting(true);
    try {
      const envelope = await patchArtifactLens(artifactId, patch);
      const updated = envelope.data[0];
      onSuccess?.(updated);
      handleClose();
    } catch (err) {
      if (err instanceof ApiError) {
        const body = err.body as
          | { detail?: string | Array<{ msg?: string }> }
          | string
          | null;
        if (typeof body === "object" && body !== null && "detail" in body) {
          const detail = body.detail;
          if (typeof detail === "string") {
            setErrorMessage(detail);
          } else if (Array.isArray(detail)) {
            setErrorMessage(
              detail.map((d) => d?.msg ?? String(d)).join("; "),
            );
          } else {
            setErrorMessage(`API error ${err.status}`);
          }
        } else {
          setErrorMessage(`API error ${err.status}`);
        }
      } else {
        setErrorMessage(
          err instanceof Error ? err.message : "Submission failed — please try again.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${baseId}-title`}
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2",
          "rounded-xl border bg-card shadow-xl",
          "focus:outline-none",
          "max-h-[90dvh] flex flex-col",
        )}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-4">
          <h2
            id={`${baseId}-title`}
            className="text-base font-semibold tracking-tight"
          >
            Lens Assessment
          </h2>
          <button
            type="button"
            aria-label="Close assessment modal"
            onClick={handleClose}
            disabled={isSubmitting}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-md",
              "text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            <svg
              aria-hidden="true"
              className="size-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Scrollable form body */}
        <form
          id={`${baseId}-form`}
          onSubmit={handleSubmit}
          noValidate
          className="flex min-h-0 flex-1 flex-col overflow-y-auto"
        >
          <div className="flex flex-col gap-5 p-5">
            {/* Numeric dimensions */}
            <fieldset>
              <legend className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Dimension Scores
              </legend>
              <div className="flex flex-col gap-3">
                {NUMERIC_DIMS.map((dim, idx) => (
                  <NumericField
                    key={dim}
                    id={baseId}
                    dim={dim}
                    value={numeric[dim]}
                    onChange={(val) => handleNumericChange(dim, val)}
                    rationaleValue={rationale[dim] ?? ""}
                    onRationaleChange={(val) =>
                      handleRationaleChange(dim, val)
                    }
                    disabled={isSubmitting}
                    // autoFocus on first field when modal opens
                    {...(idx === 0 ? { autoFocus: true } : {})}
                    initialRationale={
                      initialValues?.lens_rationale_jsonb?.[dim]?.rationale
                    }
                  />
                ))}
              </div>
            </fieldset>

            {/* Categorical dimensions */}
            <fieldset>
              <legend className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Categorical Dimensions
              </legend>
              <div className="flex flex-col gap-4">
                {/* Verification status */}
                <div>
                  <label
                    htmlFor={`${baseId}-verification-status`}
                    className="mb-1.5 block text-sm font-medium"
                  >
                    Verification Status
                  </label>
                  <select
                    id={`${baseId}-verification-status`}
                    value={verificationStatus}
                    onChange={(e) =>
                      setVerificationStatus(
                        e.target.value as LensVerificationStatus | "",
                      )
                    }
                    disabled={isSubmitting}
                    className={cn(
                      "w-full rounded-md border bg-background px-3 py-2 text-sm",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "disabled:opacity-50",
                    )}
                  >
                    <option value="">— not set —</option>
                    {VERIFICATION_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  <label
                    htmlFor={`${baseId}-verification-status-rationale`}
                    className="sr-only"
                  >
                    Verification Status rationale
                  </label>
                  <textarea
                    id={`${baseId}-verification-status-rationale`}
                    value={rationale["verification_status"] ?? ""}
                    onChange={(e) =>
                      handleRationaleChange("verification_status", e.target.value)
                    }
                    rows={1}
                    placeholder="Rationale (optional)"
                    disabled={isSubmitting}
                    className={cn(
                      "mt-1.5 w-full resize-none rounded-md border bg-background px-2 py-1.5 text-xs",
                      "placeholder:text-muted-foreground",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "disabled:opacity-50",
                    )}
                  />
                </div>

                {/* Fidelity */}
                <div>
                  <label
                    htmlFor={`${baseId}-fidelity`}
                    className="mb-1.5 block text-sm font-medium"
                  >
                    Fidelity
                  </label>
                  <select
                    id={`${baseId}-fidelity`}
                    value={fidelity}
                    onChange={(e) =>
                      setFidelity(e.target.value as LensFidelityLevel | "")
                    }
                    disabled={isSubmitting}
                    className={cn(
                      "w-full rounded-md border bg-background px-3 py-2 text-sm",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "disabled:opacity-50",
                    )}
                  >
                    <option value="">— not set —</option>
                    {FIDELITY_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  <label
                    htmlFor={`${baseId}-fidelity-rationale`}
                    className="sr-only"
                  >
                    Fidelity rationale
                  </label>
                  <textarea
                    id={`${baseId}-fidelity-rationale`}
                    value={rationale["fidelity"] ?? ""}
                    onChange={(e) =>
                      handleRationaleChange("fidelity", e.target.value)
                    }
                    rows={1}
                    placeholder="Rationale (optional)"
                    disabled={isSubmitting}
                    className={cn(
                      "mt-1.5 w-full resize-none rounded-md border bg-background px-2 py-1.5 text-xs",
                      "placeholder:text-muted-foreground",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "disabled:opacity-50",
                    )}
                  />
                </div>
              </div>
            </fieldset>

            {/* Error banner */}
            {errorMessage && (
              <div
                role="alert"
                className={cn(
                  "rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5",
                  "flex items-start gap-2",
                )}
              >
                <svg
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-destructive"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                  />
                </svg>
                <p className="text-sm text-destructive">{errorMessage}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex shrink-0 justify-end gap-2 border-t px-5 py-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className={cn(
                "inline-flex min-h-[44px] items-center rounded-md px-3 text-sm font-medium sm:h-8 sm:min-h-0",
                "border border-input bg-background text-foreground",
                "transition-colors hover:bg-accent hover:text-accent-foreground",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:pointer-events-none disabled:opacity-50",
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              aria-disabled={isSubmitting}
              className={cn(
                "inline-flex min-h-[44px] items-center rounded-md px-4 text-sm font-medium sm:h-8 sm:min-h-0",
                "bg-primary text-primary-foreground",
                "transition-colors hover:bg-primary/90",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:pointer-events-none disabled:opacity-50",
              )}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-1.5">
                  <svg
                    aria-hidden="true"
                    className="size-3.5 animate-spin"
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
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                  Saving…
                </span>
              ) : (
                "Save assessment"
              )}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
