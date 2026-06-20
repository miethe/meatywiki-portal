"use client";

/**
 * KeysTab — write-only secret key management tab (FE-P4 / P4-05).
 *
 * SECURITY CONTRACT (DEC-FE-5/6):
 *   - Secret VALUES are NEVER fetched, held in state, or rendered.
 *     useSecrets() returns { key, is_set } only; SecretField receives no value.
 *   - FORBIDDEN_KEYS rows render locked/disabled with no write affordance.
 *   - 403 SECRET_KEY_FORBIDDEN is surfaced as a non-retryable inline message.
 *   - 204 success → "Saved — trigger a reload to activate".
 *   - 422 CONFIG_INVALID → inline error.
 *
 * Traces: portal-llm-settings-frontend FE-P4 (P4-05).
 */

import React, { useState } from "react";
import { Lock } from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  SecretField,
  Spinner,
} from "@miethe/ui";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ApiError } from "@/lib/api/client";
import { useSecrets, usePutSecret } from "@/hooks/useLlmSettings";
import { cn } from "@/lib/utils";
import type { LlmSettingsErrorCode } from "@/lib/api/llm-settings.types";

// ---------------------------------------------------------------------------
// Forbidden keys (DEC-FE-6) — these rows are always locked/disabled.
// The backend also enforces this; this is defence-in-depth on the client.
// ---------------------------------------------------------------------------

const FORBIDDEN_KEYS = ["PORTAL_DISABLE_AUTH", "PORTAL_ALLOW_NETWORK"] as const;
type ForbiddenKey = (typeof FORBIDDEN_KEYS)[number];

function isForbiddenKey(key: string): key is ForbiddenKey {
  return (FORBIDDEN_KEYS as readonly string[]).includes(key);
}

// ---------------------------------------------------------------------------
// Error code narrowing
// ---------------------------------------------------------------------------

function isLlmSettingsError(
  body: unknown,
): body is { code: LlmSettingsErrorCode; message: string } {
  return (
    typeof body === "object" &&
    body !== null &&
    "code" in body &&
    typeof (body as Record<string, unknown>)["code"] === "string"
  );
}

// ---------------------------------------------------------------------------
// Per-row state type
// ---------------------------------------------------------------------------

type RowStatus =
  | { kind: "idle" }
  | { kind: "success" }
  | { kind: "error"; message: string; retryable: boolean };

// ---------------------------------------------------------------------------
// SecretRow — a single key row
// ---------------------------------------------------------------------------

interface SecretRowProps {
  secretKey: string;
  isSet: boolean;
  onSave: (key: string, value: string) => Promise<void>;
}

function SecretRow({ secretKey, isSet, onSave }: SecretRowProps) {
  const [status, setStatus] = useState<RowStatus>({ kind: "idle" });
  const forbidden = isForbiddenKey(secretKey);

  async function handleSubmit(newValue: string): Promise<void> {
    setStatus({ kind: "idle" });
    try {
      await onSave(secretKey, newValue);
      setStatus({ kind: "success" });
    } catch (err) {
      if (err instanceof ApiError && isLlmSettingsError(err.body)) {
        const code = err.body.code;
        if (code === "SECRET_KEY_FORBIDDEN") {
          setStatus({
            kind: "error",
            message: "This key cannot be modified from the UI",
            retryable: false,
          });
        } else if (code === "CONFIG_INVALID") {
          setStatus({
            kind: "error",
            message: err.body.message ?? "Invalid configuration value.",
            retryable: true,
          });
        } else {
          setStatus({
            kind: "error",
            message: err.body.message ?? "Failed to save secret.",
            retryable: true,
          });
        }
      } else {
        setStatus({
          kind: "error",
          message: "Failed to save secret.",
          retryable: true,
        });
      }
    }
  }

  return (
    <Card
      aria-label={`Secret key: ${secretKey}${forbidden ? " (locked)" : ""}`}
      className={cn("flex flex-col gap-0", forbidden && "opacity-60")}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
        <div className="min-w-0">
          <code className="text-sm font-mono font-semibold break-all">
            {secretKey}
          </code>
        </div>

        {forbidden && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                aria-label="Cannot be modified from the UI"
                className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
              >
                <Lock
                  size={14}
                  aria-hidden="true"
                  className="shrink-0"
                />
                <Badge variant="secondary" className="text-xs">
                  Locked
                </Badge>
              </span>
            </TooltipTrigger>
            <TooltipContent side="left">
              Cannot be modified from the UI
            </TooltipContent>
          </Tooltip>
        )}
      </CardHeader>

      <CardContent className="pt-0 space-y-2">
        {forbidden ? (
          // No SecretField write affordance for forbidden keys.
          <p className="text-xs text-muted-foreground">
            This key is managed by the system and cannot be edited here.
          </p>
        ) : (
          <>
            <SecretField
              label={secretKey}
              isSet={isSet}
              onSubmit={(v) => void handleSubmit(v)}
              // Only surface retryable errors via SecretField's inline error slot
              // (inline next to the input). Non-retryable errors appear separately.
              error={
                status.kind === "error" && status.retryable
                  ? status.message
                  : undefined
              }
            />

            {status.kind === "success" && (
              <p
                role="status"
                aria-live="polite"
                className="text-xs text-green-600 dark:text-green-400"
              >
                Saved — trigger a reload to activate.
              </p>
            )}

            {status.kind === "error" && !status.retryable && (
              <p
                role="alert"
                className="text-xs text-destructive"
              >
                {status.message}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// KeysTab
// ---------------------------------------------------------------------------

export function KeysTab() {
  const { secrets, isLoading, isError } = useSecrets();
  const { mutateAsync: putSecretMutate } = usePutSecret();

  async function handleSave(key: string, value: string): Promise<void> {
    await putSecretMutate({ key, value });
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="md" aria-label="Loading secrets" />
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────

  if (isError) {
    return (
      <div
        role="alert"
        className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400"
      >
        Could not load secret keys. Is the backend running?
      </div>
    );
  }

  // ── Empty ──────────────────────────────────────────────────────────────────

  if (secrets.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No secret keys configured. Add keys via the CLI.
      </p>
    );
  }

  // ── Key list ───────────────────────────────────────────────────────────────

  return (
    <section aria-labelledby="keys-tab-heading">
      <h2
        id="keys-tab-heading"
        className="mb-4 text-sm font-medium text-muted-foreground"
      >
        Secret values are write-only and are never displayed. Each key is
        stored server-side; only whether a value is configured is shown here.
      </h2>

      <ul className="grid gap-3" role="list">
        {secrets.map((secret) => (
          <li key={secret.key}>
            <SecretRow
              secretKey={secret.key}
              isSet={secret.is_set}
              onSave={handleSave}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
