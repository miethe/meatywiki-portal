"use client";

/**
 * RestartRequiredBanner — persistent amber status banner.
 *
 * Reads restartRequired from <RestartRequiredProvider>. Renders nothing when
 * false; renders a full-width amber warning bar when true.
 *
 * Per DEC-FE-4: no dismiss button. The banner clears only when the engine
 * reports restart_required=false in a subsequent reload response.
 *
 * role="status" is correct here: the banner announces itself to AT users
 * when it appears without requiring immediate action (role="alert" is for
 * urgent/disruptive announcements).
 *
 * Traces: portal-llm-settings-frontend FE-P3.
 */

import { useRestartRequired } from "@/components/settings/llm/restart-required-context";

export function RestartRequiredBanner() {
  const { restartRequired } = useRestartRequired();

  if (!restartRequired) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
    >
      {/* Warning icon */}
      <svg
        aria-hidden="true"
        className="size-4 shrink-0"
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
      <span>
        Portal restart required to apply the embedding model change.
      </span>
    </div>
  );
}
