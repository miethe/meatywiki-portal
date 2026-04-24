"use client";

/**
 * SettingsConfigClient — interactive config sections for Settings page.
 *
 * Implements FE-05 (Inbox Directory) and FE-07 (Auto-compile toggle).
 *
 * Fetches GET /api/config on mount; writes via PATCH /api/config.
 * Rendered as a client island inside the server-rendered settings page.
 */

import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

interface ConfigResponse {
  inbox_dir: string | null;
  auto_compile: boolean;
  portal_version: string;
}

// ── Inbox Directory section (FE-05) ────────────────────────────────────────

function InboxDirectorySection({
  initialValue,
  onSaved,
}: {
  initialValue: string | null;
  onSaved: (newValue: string) => void;
}) {
  const [value, setValue] = useState(initialValue ?? "");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const testTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep local value in sync if parent re-loads config
  useEffect(() => {
    setValue(initialValue ?? "");
  }, [initialValue]);

  function clearTimers() {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    if (testTimer.current) clearTimeout(testTimer.current);
  }

  async function patchInboxDir(
    dir: string,
    mode: "save" | "test",
  ): Promise<void> {
    clearTimers();
    setError(null);
    setTestResult(null);

    if (mode === "save") setSaving(true);
    else setTesting(true);

    try {
      await api.patch<ConfigResponse>("/api/config", { inbox_dir: dir });

      if (mode === "save") {
        onSaved(dir);
        setSavedFeedback(true);
        feedbackTimer.current = setTimeout(() => setSavedFeedback(false), 2500);
      } else {
        setTestResult({ ok: true, message: "Path accessible" });
        testTimer.current = setTimeout(() => setTestResult(null), 3000);
      }
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? typeof err.body === "object" &&
            err.body !== null &&
            "detail" in err.body
            ? String((err.body as { detail: unknown }).detail)
            : `Error ${err.status}`
          : "Request failed";

      if (mode === "save") {
        setError(msg);
      } else {
        setTestResult({ ok: false, message: msg });
        testTimer.current = setTimeout(() => setTestResult(null), 4000);
      }
    } finally {
      if (mode === "save") setSaving(false);
      else setTesting(false);
    }
  }

  const isWatching = (initialValue ?? "") !== "";

  return (
    <section aria-labelledby="settings-inbox-dir-heading">
      <h2
        id="settings-inbox-dir-heading"
        className="mb-3 text-base font-semibold"
      >
        Inbox Directory
      </h2>
      <div className="rounded-md border p-4 space-y-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Watch directory</p>
            <p className="text-xs text-muted-foreground">
              Absolute path on the server that the intake watcher monitors for
              new files
            </p>
          </div>
          {/* Status badge */}
          <span
            aria-label={isWatching ? "Status: Watching" : "Status: Not configured"}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-sm px-2 py-0.5 text-[11px] font-medium leading-tight",
              isWatching
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                : "bg-muted text-muted-foreground",
            )}
          >
            {isWatching && (
              <span
                aria-hidden="true"
                className="size-1.5 animate-pulse rounded-full bg-current"
              />
            )}
            {isWatching ? "Watching" : "Not configured"}
          </span>
        </div>

        {/* Input + actions */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              aria-label="Inbox directory path"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
                setTestResult(null);
              }}
              placeholder="/absolute/path/to/inbox"
              spellCheck={false}
              className={cn(
                "flex-1 rounded-md border bg-transparent px-3 py-1.5 text-sm font-mono",
                "placeholder:text-muted-foreground/50",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                error ? "border-red-500 dark:border-red-400" : "",
              )}
            />

            {/* Test button */}
            <button
              type="button"
              disabled={testing || saving || value.trim() === ""}
              onClick={() => patchInboxDir(value.trim(), "test")}
              aria-label="Test path accessibility"
              className="inline-flex h-9 shrink-0 items-center rounded-md border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              {testing ? (
                <span className="inline-flex items-center gap-1.5">
                  <Spinner />
                  Testing…
                </span>
              ) : (
                "Test"
              )}
            </button>

            {/* Save button */}
            <button
              type="button"
              disabled={saving || testing}
              onClick={() => patchInboxDir(value.trim(), "save")}
              aria-label="Save inbox directory"
              className="inline-flex h-9 shrink-0 items-center rounded-md border px-3 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <span className="inline-flex items-center gap-1.5">
                  <Spinner />
                  Saving…
                </span>
              ) : savedFeedback ? (
                <span className="text-emerald-700 dark:text-emerald-400">
                  Saved
                </span>
              ) : (
                "Save"
              )}
            </button>
          </div>

          {/* Inline feedback */}
          {error && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          {testResult && (
            <p
              role="status"
              className={cn(
                "text-xs",
                testResult.ok
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400",
              )}
            >
              {testResult.message}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

// ── Auto-compile section (FE-07) ────────────────────────────────────────────

function AutoCompileSection({
  initialValue,
  onChanged,
}: {
  initialValue: boolean;
  onChanged: (newValue: boolean) => void;
}) {
  const [enabled, setEnabled] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEnabled(initialValue);
  }, [initialValue]);

  async function toggle() {
    const next = !enabled;
    setEnabled(next); // optimistic
    setError(null);
    setSaving(true);

    try {
      await api.patch<ConfigResponse>("/api/config", { auto_compile: next });
      onChanged(next);
    } catch (err) {
      // Revert optimistic update
      setEnabled(!next);
      const msg =
        err instanceof ApiError
          ? typeof err.body === "object" &&
            err.body !== null &&
            "detail" in err.body
            ? String((err.body as { detail: unknown }).detail)
            : `Error ${err.status}`
          : "Request failed";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="settings-auto-compile-heading">
      <h2
        id="settings-auto-compile-heading"
        className="mb-3 text-base font-semibold"
      >
        Auto-compile
      </h2>
      <div className="rounded-md border p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Auto-compile after ingest</p>
            <p className="text-xs text-muted-foreground">
              When enabled, artifacts are automatically compiled after ingestion
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {saving && (
              <span
                aria-live="polite"
                className="flex items-center gap-1 text-xs text-muted-foreground"
              >
                <Spinner />
                Saving…
              </span>
            )}

            {/* Toggle switch */}
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label={`Auto-compile: ${enabled ? "enabled" : "disabled"}`}
              disabled={saving}
              onClick={toggle}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent",
                "transition-colors duration-200 ease-in-out",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                "disabled:cursor-not-allowed disabled:opacity-50",
                enabled
                  ? "bg-primary"
                  : "bg-input",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "pointer-events-none inline-block size-4 rounded-full bg-white shadow-md ring-0",
                  "transition-transform duration-200 ease-in-out",
                  enabled ? "translate-x-4" : "translate-x-0",
                )}
              />
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

// ── Root client component ───────────────────────────────────────────────────

export function SettingsConfigClient() {
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<ConfigResponse>("/api/config")
      .then((data) => setConfig(data))
      .catch(() =>
        setFetchError("Could not load configuration. Is the backend running?"),
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <>
        <ConfigSectionSkeleton label="Inbox Directory" />
        <ConfigSectionSkeleton label="Auto-compile" />
      </>
    );
  }

  if (fetchError || !config) {
    return (
      <div
        role="alert"
        className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400"
      >
        {fetchError ?? "Configuration unavailable."}
      </div>
    );
  }

  return (
    <>
      <InboxDirectorySection
        initialValue={config.inbox_dir}
        onSaved={(newValue) =>
          setConfig((prev) => (prev ? { ...prev, inbox_dir: newValue } : prev))
        }
      />
      <AutoCompileSection
        initialValue={config.auto_compile}
        onChanged={(newValue) =>
          setConfig((prev) =>
            prev ? { ...prev, auto_compile: newValue } : prev,
          )
        }
      />
    </>
  );
}

// ── Small shared atoms ──────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      aria-hidden="true"
      className="size-3 animate-spin"
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

function ConfigSectionSkeleton({ label }: { label: string }) {
  return (
    <section aria-label={`${label} loading`}>
      <div className="mb-3 h-5 w-32 animate-pulse rounded bg-muted" />
      <div className="rounded-md border p-4">
        <div className="h-9 animate-pulse rounded bg-muted" />
      </div>
    </section>
  );
}
