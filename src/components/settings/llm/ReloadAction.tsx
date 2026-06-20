"use client";

/**
 * ReloadAction — engine config reload button.
 *
 * Calls useTriggerReload() on click. While the mutation is pending the button
 * shows a spinner and is disabled to prevent double-submit.
 *
 * Error handling:
 *   - 409 RELOAD_IN_PROGRESS: non-retryable inline message (the in-flight
 *     reload will finish on its own — user should wait).
 *   - Any other ApiError: generic inline error message.
 *
 * On success: useTriggerReload's onSuccess handler updates the
 * RestartRequired context and invalidates all llm-settings queries, so the
 * banner and cached data reflect the new engine state automatically.
 *
 * Button styling matches the existing portal settings buttons (border variant,
 * text-xs, h-8, hover:bg-accent) — @miethe/ui ships no Button primitive.
 *
 * Traces: portal-llm-settings-frontend FE-P3.
 */

import { useState } from "react";
import { Spinner } from "@miethe/ui";
import { useTriggerReload } from "@/hooks/useLlmSettings";
import { ApiError } from "@/lib/api/client";
import type { LlmSettingsError } from "@/lib/api/llm-settings.types";

// ── ReloadAction ─────────────────────────────────────────────────────────────

export function ReloadAction() {
  const { mutateAsync, isPending } = useTriggerReload();
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [inProgress, setInProgress] = useState(false);

  async function handleReload() {
    setInlineError(null);
    setInProgress(false);

    try {
      await mutateAsync();
    } catch (err) {
      if (err instanceof ApiError) {
        // 409 RELOAD_IN_PROGRESS — non-retryable; the existing reload will finish.
        if (err.status === 409) {
          const body = err.body as LlmSettingsError | null;
          if (
            body !== null &&
            typeof body === "object" &&
            "code" in body &&
            body.code === "RELOAD_IN_PROGRESS"
          ) {
            setInProgress(true);
            return;
          }
        }
        // Any other API error — show the message from the body if present.
        const body = err.body as LlmSettingsError | null;
        const message =
          body !== null &&
          typeof body === "object" &&
          "message" in body &&
          typeof body.message === "string"
            ? body.message
            : `Request failed (${err.status})`;
        setInlineError(message);
      } else {
        setInlineError("Reload failed — is the backend running?");
      }
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={handleReload}
        aria-label="Reload engine configuration"
        className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? (
          <>
            <Spinner size="sm" aria-label="Reloading" />
            Reloading…
          </>
        ) : (
          "Reload config"
        )}
      </button>

      {/* Non-retryable in-progress notice */}
      {inProgress && (
        <p role="status" className="text-xs text-muted-foreground">
          A reload is already in progress — please wait for it to finish.
        </p>
      )}

      {/* Generic error */}
      {inlineError && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {inlineError}
        </p>
      )}
    </div>
  );
}
