"use client";

/**
 * Vault Graph Page — `/graph`
 *
 * P3-01: Page scaffold + graph fetch (vault-wide, all types, limit 100)
 * P3-02: Filter sidebar — artifact type facets
 * P3-03: Filter sidebar — edge type facets
 * P3-04: Pagination + "N of M" label
 * P3-05: Click-to-focus neighborhood filter
 * P3-06: Hover + click interactions + GraphLegend
 * P3-07: Degraded fallback — list view
 * P3-08: Performance optimisation (memoization, sampling transparency)
 * P3-10: Keyboard navigation
 * P3-11: A11y fallback + semantic structure
 *
 * Architecture:
 *   - useVaultGraph() owns fetching, pagination, URL param sync, sampling detection.
 *   - FilterSidebar: checkboxes for node/edge types (P3-02, P3-03).
 *   - VaultGraphCanvas (sigma.js): renders graph, hover/click interactions (P3-06).
 *   - DegradedFallback: list view toggle when sampled/above-cap (P3-07).
 *   - Neighborhood mode: fetches /graph/neighborhood, shows "Back to vault" (P3-05).
 *   - GraphLegend: shared legend component from P2 (P3-06).
 *
 * SSR: sigma.js requires WebGL/window; VaultGraphCanvas is dynamically imported
 * with { ssr: false }.
 *
 * v2.1 — vault graph page (P3 Phase 3).
 */

import { Suspense } from "react";
import dynamic from "next/dynamic";

// Dynamic import for the client-only graph inner component
const VaultGraphPageClient = dynamic(
  () => import("./VaultGraphPageClient").then((m) => ({ default: m.VaultGraphPageClient })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <div
          aria-busy="true"
          aria-label="Loading vault graph"
          className="flex flex-col items-center gap-3"
        >
          <svg
            aria-hidden="true"
            className="size-8 animate-spin text-muted-foreground/40"
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
          <p className="text-sm text-muted-foreground">Loading knowledge graph…</p>
        </div>
      </div>
    ),
  },
);

export default function VaultGraphPage() {
  return (
    <Suspense>
      <VaultGraphPageClient />
    </Suspense>
  );
}
