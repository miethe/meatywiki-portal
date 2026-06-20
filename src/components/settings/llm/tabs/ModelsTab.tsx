"use client";

/**
 * ModelsTab — per-purpose model assignment panel.
 *
 * Renders 6 FormField+Input pairs (classify, extract, compile, query, lint,
 * embed) pre-filled from useModels(). On save, only changed fields are sent
 * in the PATCH body — unchanged fields are omitted.
 *
 * Behavior:
 *   - Loading → centred Spinner.
 *   - Fetch error → inline alert.
 *   - Save: diff inputs vs loaded values; only changed keys included in PATCH.
 *   - usePatchModels sets restartRequired when response.restart_required=true
 *     (the embed field triggers this server-side). The RestartRequiredBanner
 *     is mounted by the shell — no banner logic here.
 *   - 422 CONFIG_INVALID → form-level error via role="alert".
 *   - Disable submit while mutation is in-flight (no double-submit).
 *
 * Button styling follows ReloadAction.tsx (border variant, text-xs, h-8,
 * hover:bg-accent) — @miethe/ui ships no Button primitive.
 *
 * Traces: portal-llm-settings-frontend FE-P4 (P4-03).
 */

import React, { useEffect, useState } from "react";
import { FormField, Input, Spinner } from "@miethe/ui";
import { ApiError } from "@/lib/api/client";
import { useModels, usePatchModels } from "@/hooks/useLlmSettings";
import type { LlmSettingsError } from "@/lib/api/llm-settings.types";
import type { ModelMapPatchRequest, ModelMapResponse } from "@/lib/api/llm-settings.types";

// ---------------------------------------------------------------------------
// Purpose field configuration (display order per AC)
// ---------------------------------------------------------------------------

const MODEL_PURPOSES = [
  { key: "classify", label: "Classify" },
  { key: "extract",  label: "Extract"  },
  { key: "compile",  label: "Compile"  },
  { key: "query",    label: "Query"    },
  { key: "lint",     label: "Lint"     },
  { key: "embed",    label: "Embed"    },
] as const satisfies ReadonlyArray<{ key: keyof ModelMapPatchRequest; label: string }>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract only the 6 editable fields from the model map response. */
function toFieldValues(data: ModelMapResponse): Record<keyof ModelMapPatchRequest, string> {
  return {
    classify: data.classify ?? "",
    extract:  data.extract  ?? "",
    compile:  data.compile  ?? "",
    query:    data.query    ?? "",
    lint:     data.lint     ?? "",
    embed:    data.embed    ?? "",
  };
}

/** Return only the keys whose values differ from the loaded baseline. */
function diffFields(
  current: Record<keyof ModelMapPatchRequest, string>,
  loaded:  Record<keyof ModelMapPatchRequest, string>,
): ModelMapPatchRequest {
  const patch: ModelMapPatchRequest = {};
  for (const { key } of MODEL_PURPOSES) {
    if (current[key] !== loaded[key]) {
      // Normalise empty string → null so the backend receives null for "clear".
      patch[key] = current[key].trim() === "" ? null : current[key].trim();
    }
  }
  return patch;
}

/** Narrow unknown error bodies to LlmSettingsError shape. */
function toLlmErrorMessage(body: unknown): string | null {
  if (
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof (body as LlmSettingsError).message === "string"
  ) {
    return (body as LlmSettingsError).message;
  }
  return null;
}

// ---------------------------------------------------------------------------
// ModelsTab
// ---------------------------------------------------------------------------

export function ModelsTab() {
  const { data, isLoading, isError } = useModels();
  const { mutateAsync, isPending, reset } = usePatchModels();

  // Local form state — initialised from query data when it arrives.
  const [fields, setFields] = useState<Record<keyof ModelMapPatchRequest, string>>({
    classify: "",
    extract:  "",
    compile:  "",
    query:    "",
    lint:     "",
    embed:    "",
  });

  // Track the baseline values used to diff on save.
  const [baseline, setBaseline] = useState<Record<keyof ModelMapPatchRequest, string>>({
    classify: "",
    extract:  "",
    compile:  "",
    query:    "",
    lint:     "",
    embed:    "",
  });

  // Form-level error (422 CONFIG_INVALID or unexpected failure).
  const [formError, setFormError] = useState<string | null>(null);

  // Seed form when data loads (or reloads after invalidation).
  useEffect(() => {
    if (data) {
      const initialValues = toFieldValues(data);
      setFields(initialValues);
      setBaseline(initialValues);
    }
  }, [data]);

  function handleChange(key: keyof ModelMapPatchRequest) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setFields((prev) => ({ ...prev, [key]: e.target.value }));
    };
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    reset();

    const patch = diffFields(fields, baseline);

    // Nothing changed — nothing to send.
    if (Object.keys(patch).length === 0) return;

    try {
      const updated = await mutateAsync(patch);
      // Update baseline to the server-confirmed values so subsequent saves
      // only diff against the real persisted state.
      const confirmedValues = toFieldValues(updated);
      setBaseline(confirmedValues);
      setFields(confirmedValues);
    } catch (err) {
      if (err instanceof ApiError) {
        const message = toLlmErrorMessage(err.body)
          ?? `Save failed (${err.status}).`;
        setFormError(message);
      } else {
        setFormError("Save failed — is the backend running?");
      }
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="md" aria-label="Loading model configuration" />
      </div>
    );
  }

  // ── Fetch error ────────────────────────────────────────────────────────────

  if (isError || !data) {
    return (
      <div
        role="alert"
        className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400"
      >
        Could not load model configuration. Is the backend running?
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────

  return (
    <section aria-labelledby="models-tab-heading">
      <h2
        id="models-tab-heading"
        className="mb-4 text-sm font-medium text-muted-foreground"
      >
        Assign a model string to each compilation purpose. Leave blank to use the
        provider default.
      </h2>

      <form onSubmit={(e) => void handleSave(e)} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          {MODEL_PURPOSES.map(({ key, label }) => (
            <FormField
              key={key}
              label={label}
              htmlFor={`model-${key}`}
              hint={key === "embed" ? "Changing the embedding model requires a restart." : undefined}
            >
              <Input
                id={`model-${key}`}
                name={key}
                type="text"
                value={fields[key]}
                onChange={handleChange(key)}
                placeholder="e.g. claude-sonnet-4-6"
                disabled={isPending}
                autoComplete="off"
                spellCheck={false}
              />
            </FormField>
          ))}
        </div>

        {/* Form-level error (422 CONFIG_INVALID or network failure) */}
        {formError && (
          <p
            role="alert"
            className="mt-4 text-sm text-red-600 dark:text-red-400"
          >
            {formError}
          </p>
        )}

        {/* Save action */}
        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            aria-label="Save model configuration"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? (
              <>
                <Spinner size="sm" aria-label="Saving" />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </button>
        </div>
      </form>
    </section>
  );
}
