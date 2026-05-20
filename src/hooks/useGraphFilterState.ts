"use client";

/**
 * useGraphFilterState — URL-backed filter state for the vault graph page.
 *
 * Single source of truth: URL query string.
 *
 * Server-side dims (1-7) are stored as direct URL params:
 *   ws[], types[], edges[], freshness[], project[], domain[],
 *   date_from, date_to, updated_from, updated_to
 *   q (free-text, dim 16)
 *
 * Client-side dims (8-15) are preserved in local state and passed through to
 * GraphFilters — they are intentionally NOT serialized to the URL here
 * (P3-04 will handle base64 serialization of the `filters` blob).
 *
 * Debounce: URL commits are debounced 300ms. `isPending` is true between user
 * input and URL commit so the caller can show a loading indicator.
 *
 * v2.2 — graph explorer filter wiring (P3-03).
 */

import { useState, useCallback, useEffect, useRef, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  GRAPH_FILTERS_DEFAULT,
  type GraphFiltersValues,
} from "@/components/graph/GraphFilters";

// ---------------------------------------------------------------------------
// URL param names — per filter contract §2 and §4
// ---------------------------------------------------------------------------

const QP = {
  ws:           "ws[]",
  types:        "types[]",
  edges:        "edges[]",
  freshness:    "freshness[]",
  project:      "project[]",
  domain:       "domain[]",
  date_from:    "date_from",
  date_to:      "date_to",
  updated_from: "updated_from",
  updated_to:   "updated_to",
  q:            "q",
} as const;

// ---------------------------------------------------------------------------
// URL deserialization — reads server dims from URLSearchParams
// ---------------------------------------------------------------------------

function readServerFiltersFromUrl(sp: URLSearchParams): Pick<
  GraphFiltersValues,
  | "ws"
  | "types"
  | "edges"
  | "freshness"
  | "project"
  | "domain"
  | "date_from"
  | "date_to"
  | "updated_from"
  | "updated_to"
  | "q"
> {
  return {
    ws:           sp.getAll(QP.ws),
    types:        sp.getAll(QP.types),
    edges:        sp.getAll(QP.edges),
    freshness:    sp.getAll(QP.freshness),
    project:      sp.getAll(QP.project),
    domain:       sp.getAll(QP.domain),
    date_from:    sp.get(QP.date_from)    ?? "",
    date_to:      sp.get(QP.date_to)      ?? "",
    updated_from: sp.get(QP.updated_from) ?? "",
    updated_to:   sp.get(QP.updated_to)   ?? "",
    q:            sp.get(QP.q)            ?? "",
  };
}

// ---------------------------------------------------------------------------
// URL serialization — writes server dims into a new URLSearchParams
// Preserves any unrelated params already in the URL.
// ---------------------------------------------------------------------------

function writeServerFiltersToUrl(
  base: URLSearchParams,
  values: GraphFiltersValues,
): string {
  const next = new URLSearchParams(base.toString());

  // Wipe all managed keys before rewriting
  next.delete(QP.ws);
  next.delete(QP.types);
  next.delete(QP.edges);
  next.delete(QP.freshness);
  next.delete(QP.project);
  next.delete(QP.domain);
  next.delete(QP.date_from);
  next.delete(QP.date_to);
  next.delete(QP.updated_from);
  next.delete(QP.updated_to);
  next.delete(QP.q);

  for (const v of values.ws)        next.append(QP.ws, v);
  for (const v of values.types)     next.append(QP.types, v);
  for (const v of values.edges)     next.append(QP.edges, v);
  for (const v of values.freshness) next.append(QP.freshness, v);
  for (const v of values.project)   next.append(QP.project, v);
  for (const v of values.domain)    next.append(QP.domain, v);

  if (values.date_from)    next.set(QP.date_from,    values.date_from);
  if (values.date_to)      next.set(QP.date_to,      values.date_to);
  if (values.updated_from) next.set(QP.updated_from, values.updated_from);
  if (values.updated_to)   next.set(QP.updated_to,   values.updated_to);
  if (values.q)            next.set(QP.q,             values.q);

  return next.toString();
}

// ---------------------------------------------------------------------------
// Hook result
// ---------------------------------------------------------------------------

export interface UseGraphFilterStateResult {
  /** Current unified filter values (server + client dims). */
  values: GraphFiltersValues;
  /** Patch one or more filter keys. Debounces URL commit by 300ms for server dims. */
  setFilter: (patch: Partial<GraphFiltersValues>) => void;
  /** True between user interaction and URL commit (debounce window). */
  isPending: boolean;
  /** Reset all filters to defaults and clear URL params. */
  resetAll: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 300;

export function useGraphFilterState(): UseGraphFilterStateResult {
  const router   = useRouter();
  const pathname = usePathname();
  const sp       = useSearchParams();

  // React transition for URL navigation (marks as non-urgent)
  const [isPending, startTransition] = useTransition();

  // Pending-flag while debounce timer is running (before URL commit)
  const [isDebouncing, setIsDebouncing] = useState(false);

  // Combined pending = debounce window OR React transition
  const combinedPending = isPending || isDebouncing;

  // Hydrate from URL on first render (server dims only)
  const urlServerFilters = readServerFiltersFromUrl(sp);

  // Unified filter values: server dims from URL, client dims from local state.
  const [values, setValues] = useState<GraphFiltersValues>(() => ({
    ...GRAPH_FILTERS_DEFAULT,
    ...urlServerFilters,
  }));

  // Sync server dims whenever URL search params change (e.g., browser back/forward)
  const prevSpRef = useRef(sp.toString());
  useEffect(() => {
    const current = sp.toString();
    if (current === prevSpRef.current) return;
    prevSpRef.current = current;
    const fresh = readServerFiltersFromUrl(sp);
    setValues((prev) => ({
      ...prev,
      ...fresh,
    }));
  }, [sp]);

  // Debounce timer ref — cleared on each new patch
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commitToUrl = useCallback(
    (next: GraphFiltersValues) => {
      const qs = writeServerFiltersToUrl(sp, next);
      startTransition(() => {
        router.push(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
      });
      setIsDebouncing(false);
    },
    [router, pathname, sp],
  );

  const setFilter = useCallback(
    (patch: Partial<GraphFiltersValues>) => {
      setValues((prev) => {
        const next = { ...prev, ...patch };

        // Cancel any pending debounce
        if (debounceRef.current !== null) {
          clearTimeout(debounceRef.current);
        }

        // Mark as debouncing (so isPending is true during the window)
        setIsDebouncing(true);

        // Schedule URL commit after 300ms
        debounceRef.current = setTimeout(() => {
          commitToUrl(next);
        }, DEBOUNCE_MS);

        return next;
      });
    },
    [commitToUrl],
  );

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    };
  }, []);

  const resetAll = useCallback(() => {
    if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    setValues(GRAPH_FILTERS_DEFAULT);
    startTransition(() => {
      router.push(pathname, { scroll: false });
    });
    setIsDebouncing(false);
  }, [router, pathname]);

  return {
    values,
    setFilter,
    isPending: combinedPending,
    resetAll,
  };
}
