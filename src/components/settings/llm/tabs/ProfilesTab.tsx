"use client";

/**
 * ProfilesTab — displays available LLM provider profiles and lets the user
 * switch the active one.
 *
 * Behavior:
 *   - Lists all profiles from useProfiles() as Cards.
 *   - Marks the active profile (from useActiveProfile()) with a Badge.
 *   - Each non-active profile has a "Use" button that calls useSwitchProfile().
 *   - Optimistic: the "Use" button spins while the mutation is in-flight;
 *     queries are invalidated on settle (success or 409 PROFILE_ALREADY_ACTIVE).
 *   - 404 PROFILE_NOT_FOUND → non-retryable inline error message on the card.
 *   - 409 PROFILE_ALREADY_ACTIVE → treated as benign; just refetch (no error).
 *   - Loading → centred Spinner; error → inline alert; empty → static message.
 *
 * No create / edit UI — profiles are CLI-managed (DEC-FE-3).
 *
 * Traces: portal-llm-settings-frontend FE-P4 (P4-02).
 */

import React, { useState } from "react";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  Spinner,
} from "@miethe/ui";
import { ApiError } from "@/lib/api/client";
import { useActiveProfile, useProfiles, useSwitchProfile } from "@/hooks/useLlmSettings";
import { cn } from "@/lib/utils";
import type { LlmSettingsErrorCode } from "@/lib/api/llm-settings.types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isLlmSettingsError(body: unknown): body is { code: LlmSettingsErrorCode; message: string } {
  return (
    typeof body === "object" &&
    body !== null &&
    "code" in body &&
    typeof (body as Record<string, unknown>)["code"] === "string"
  );
}

// ---------------------------------------------------------------------------
// ProfileCard
// ---------------------------------------------------------------------------

interface ProfileCardProps {
  name: string;
  description?: string | null;
  provider?: string | null;
  isActive: boolean;
  onUse: (name: string) => Promise<void>;
}

function ProfileCard({
  name,
  description,
  provider,
  isActive,
  onUse,
}: ProfileCardProps) {
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [isNotRetryable, setIsNotRetryable] = useState(false);

  async function handleUse() {
    setSwitching(true);
    setSwitchError(null);
    setIsNotRetryable(false);

    try {
      await onUse(name);
    } catch (err) {
      if (err instanceof ApiError && isLlmSettingsError(err.body)) {
        const code = err.body.code;

        if (code === "PROFILE_ALREADY_ACTIVE") {
          // Benign — someone else already switched; treat as success.
          // The parent's onUse already called refetch on settle; nothing to show.
        } else if (code === "PROFILE_NOT_FOUND") {
          setSwitchError(`Profile "${name}" was not found. It may have been removed from the config.`);
          setIsNotRetryable(true);
        } else {
          setSwitchError(err.body.message ?? `Failed to switch to profile "${name}".`);
        }
      } else {
        setSwitchError(`Failed to switch to profile "${name}".`);
      }
    } finally {
      setSwitching(false);
    }
  }

  return (
    <Card
      aria-label={`Profile: ${name}${isActive ? " (active)" : ""}`}
      className={cn(
        "flex flex-col gap-0",
        isActive && "ring-2 ring-primary ring-offset-1",
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{name}</p>
          {provider && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Provider: {provider}
            </p>
          )}
        </div>

        {isActive ? (
          <Badge variant="default" className="shrink-0">
            Active
          </Badge>
        ) : (
          <button
            type="button"
            disabled={switching || isNotRetryable}
            onClick={() => void handleUse()}
            aria-label={`Use profile ${name}`}
            className="inline-flex h-7 shrink-0 items-center rounded-md border px-2.5 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {switching ? (
              <span className="inline-flex items-center gap-1.5">
                <Spinner size="sm" aria-label="Switching profile" />
                Switching…
              </span>
            ) : (
              "Use"
            )}
          </button>
        )}
      </CardHeader>

      {(description || switchError) && (
        <CardContent className="pt-0">
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
          {switchError && (
            <p
              role="alert"
              aria-live="polite"
              className="mt-1 text-xs text-red-600 dark:text-red-400"
            >
              {switchError}
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// ProfilesTab
// ---------------------------------------------------------------------------

export function ProfilesTab() {
  const { profiles, isLoading: profilesLoading, isError: profilesError } = useProfiles();
  const { data: activeProfileData, isLoading: activeLoading } = useActiveProfile();
  const { mutateAsync: switchProfile, reset } = useSwitchProfile();

  const isLoading = profilesLoading || activeLoading;
  const activeProfileName = activeProfileData?.active_profile ?? null;

  async function handleUse(name: string): Promise<void> {
    // Reset any prior mutation error before switching.
    reset();
    await switchProfile(name);
  }

  // ── Loading ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="md" aria-label="Loading profiles" />
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────

  if (profilesError) {
    return (
      <div
        role="alert"
        className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400"
      >
        Could not load profiles. Is the backend running?
      </div>
    );
  }

  // ── Empty ────────────────────────────────────────────────────────────────

  if (profiles.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No profiles configured. Add profiles via the CLI (
        <code className="rounded bg-muted px-1 text-xs">meatywiki profile list</code>
        ).
      </p>
    );
  }

  // ── Profile list ─────────────────────────────────────────────────────────

  return (
    <section aria-labelledby="profiles-tab-heading">
      <h2
        id="profiles-tab-heading"
        className="mb-4 text-sm font-medium text-muted-foreground"
      >
        Profiles are configured via the CLI and cannot be created or edited here.
      </h2>

      <ul className="grid gap-3 sm:grid-cols-2" role="list">
        {profiles.map((profile) => (
          <li key={profile.name}>
            <ProfileCard
              name={profile.name}
              description={profile.description}
              provider={profile.provider}
              isActive={profile.name === activeProfileName}
              onUse={handleUse}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
