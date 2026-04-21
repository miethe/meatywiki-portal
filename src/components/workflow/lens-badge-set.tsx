"use client";

/**
 * LensBadgeSet (workflow) — artifact-object-driven Lens Badge Set component.
 *
 * Accepts a full ArtifactCard or ArtifactDetail object and derives badge
 * values from artifact.metadata. This is the primary reusable entry-point
 * for P4-06 scope; the lower-level primitives live in
 * src/components/ui/lens-badge.tsx.
 *
 * Variants:
 *   compact — max 3 badges: fidelity / freshness / verification_state.
 *             Used on artifact cards in Library, Inbox, Research.
 *   detail  — all five dimensions: adds reusability_tier + sensitivity_profile
 *             when present. Used in Artifact Detail header.
 *
 * Workspace-aware styling (P5-06):
 *   When researchOrigin=true the badge container receives an amber accent ring
 *   and a subtle amber background tint to visually distinguish research-workflow
 *   artifacts from regular Library items. Normal (non-research) styling is
 *   unchanged. Safe default: researchOrigin=false/undefined → no accent.
 *
 * Design invariants (design spec §3.3):
 *   - Missing fields: render nothing for that badge (no placeholder, no crash).
 *   - All fields null/undefined: renders nothing (no DOM node at all) so the
 *     caller's layout is never disrupted by an empty container.
 *   - Read-only in v1; write path deferred to Portal v1.5 (DF-007).
 *   - WCAG 2.1 AA: badges carry aria-label (colour + text label, not colour-only);
 *     research accent uses colour + aria-label supplement (never colour-only).
 *
 * Stitch reference: §3.1 LensBadgeSet; addendum §3.1.
 * PRD: FR-29, A17.
 * Phase: P4-06 (base), P5-06 (workspace-aware styling).
 */

import { cn } from "@/lib/utils";
import {
  FidelityBadge,
  FreshnessBadge,
  VerificationBadge,
} from "@/components/ui/lens-badge";
import type { ArtifactCard, ArtifactDetail } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Extra badge primitives for detail-only fields
// ---------------------------------------------------------------------------

interface ExtraStringBadgeProps {
  label: string;
  value: string | null | undefined;
  className?: string;
}

/**
 * Generic pill for free-form Lens fields (reusability_tier, sensitivity_profile).
 * Uses neutral muted styling — no semantic colour mapping since values are
 * arbitrary strings from the engine (not a closed enum in v1).
 */
function ExtraStringBadge({ label, value, className }: ExtraStringBadgeProps) {
  if (!value) return null;
  return (
    <span
      aria-label={`${label}: ${value}`}
      className={cn(
        "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[11px] font-medium leading-tight",
        "bg-muted text-muted-foreground",
        className,
      )}
    >
      {value}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/**
 * LensBadgeSet accepts either an ArtifactCard (list view) or an ArtifactDetail
 * (single-artifact view). Both share the optional `metadata` field.
 */
export interface LensBadgeSetProps {
  artifact: ArtifactCard | ArtifactDetail;
  /**
   * compact — 3 core badges (fidelity / freshness / verification_state).
   * detail  — all 5 badges (adds reusability_tier + sensitivity_profile).
   * Defaults to "compact".
   */
  variant?: "compact" | "detail";
  /**
   * Whether the artifact originates from a research workflow.
   * When true, applies an amber accent ring + background tint to the badge
   * container to visually distinguish research items from library items.
   *
   * Maps to ArtifactCard.research_origin (P5-06 workspace-aware styling).
   * Safe default: false/undefined → normal styling unchanged.
   */
  researchOrigin?: boolean | null;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * LensBadgeSet renders artifact Lens dimension badges from frontmatter.
 *
 * Compact variant: renders up to 3 badges for Inbox and Library cards.
 * Detail variant:  renders up to 5 badges for the Artifact Detail header.
 *
 * Returns null when no lens fields are present (layout-stable; no empty shell).
 */
export function LensBadgeSet({
  artifact,
  variant = "compact",
  researchOrigin,
  className,
}: LensBadgeSetProps) {
  const metadata = artifact.metadata;

  const fidelity = metadata?.fidelity;
  const freshness = metadata?.freshness;
  const verificationState = metadata?.verification_state;
  const reusabilityTier = variant === "detail" ? metadata?.reusability_tier : null;
  const sensitivityProfile =
    variant === "detail" ? metadata?.sensitivity_profile : null;

  // Render nothing when all visible fields are absent — preserves layout.
  const hasAny =
    fidelity ||
    freshness ||
    verificationState ||
    reusabilityTier ||
    sensitivityProfile;

  if (!hasAny) return null;

  const isResearch = researchOrigin === true;

  return (
    <div
      aria-label={isResearch ? "Lens badges (research origin)" : "Lens badges"}
      className={cn(
        "flex flex-wrap items-center",
        variant === "compact" ? "gap-1" : "gap-1.5",
        // Workspace-aware accent: amber ring + tint for research-origin items.
        isResearch && "rounded px-1 py-0.5 ring-1 ring-amber-400/60 bg-amber-50/50 dark:ring-amber-500/50 dark:bg-amber-950/30",
        className,
      )}
    >
      <FidelityBadge value={fidelity} />
      <FreshnessBadge value={freshness} />
      <VerificationBadge value={verificationState} />
      {variant === "detail" && (
        <>
          <ExtraStringBadge label="Reusability" value={reusabilityTier} />
          <ExtraStringBadge label="Sensitivity" value={sensitivityProfile} />
        </>
      )}
    </div>
  );
}
