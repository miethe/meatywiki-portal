"use client";

/**
 * useGroupingMode — URL-backed state for the graph grouping selector.
 *
 * Reads the `grouping` URL param (defaults to 'none').
 * Writes via router.push({ scroll: false }) to keep URL shareable.
 *
 * v2.2 — graph explorer grouping selector (P3-09).
 */

import { useCallback, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  type GroupingMode,
  DEFAULT_GROUPING_MODE,
  GROUPING_MODES,
} from "@/lib/graph/groupingModes";

// ---------------------------------------------------------------------------
// URL param name
// ---------------------------------------------------------------------------

const QP_GROUPING = "grouping" as const;

// ---------------------------------------------------------------------------
// Validation helper
// ---------------------------------------------------------------------------

const VALID_VALUES = new Set<string>(GROUPING_MODES.map((m) => m.value));

function parseGroupingParam(raw: string | null): GroupingMode {
  if (raw && VALID_VALUES.has(raw)) return raw as GroupingMode;
  return DEFAULT_GROUPING_MODE;
}

// ---------------------------------------------------------------------------
// Hook result
// ---------------------------------------------------------------------------

export interface UseGroupingModeResult {
  /** Current active grouping mode. */
  mode: GroupingMode;
  /** Update the grouping mode (immediately updates URL param). */
  setMode: (mode: GroupingMode) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGroupingMode(): UseGroupingModeResult {
  const router   = useRouter();
  const pathname = usePathname();
  const sp       = useSearchParams();

  const [, startTransition] = useTransition();

  const mode = parseGroupingParam(sp.get(QP_GROUPING));

  const setMode = useCallback(
    (next: GroupingMode) => {
      const params = new URLSearchParams(sp.toString());

      if (next === DEFAULT_GROUPING_MODE) {
        // Remove the param when restoring the default to keep URLs clean.
        params.delete(QP_GROUPING);
      } else {
        params.set(QP_GROUPING, next);
      }

      const qs = params.toString();
      startTransition(() => {
        router.push(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
      });
    },
    [router, pathname, sp],
  );

  return { mode, setMode };
}
