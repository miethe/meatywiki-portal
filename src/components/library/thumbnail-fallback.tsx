"use client";

/**
 * ArtifactThumbnailFallback — procedural thumbnail for artifacts without a
 * real thumbnail URL.
 *
 * Renders the first two uppercase letters of the artifact title on a
 * deterministic gradient background chosen by artifact type.
 * The color map mirrors the type-accent palette in artifact-card.tsx so
 * the gradient and stripe visually echo each other.
 *
 * Stitch Reskin P3-02 (portal-v1.5-stitch-reskin OQ-1 fallback).
 *
 * API contract: accepts `title` + `artifactType`, renders an aspect-video
 * div (16:9) that fills its container. When the backend ships real thumbnail
 * URLs, callers can swap this component out for an <img> without changing
 * the surrounding layout.
 *
 * NOTE: This component produces no network requests and no runtime deps
 * beyond what is already in the tree.
 */

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Type → gradient map
// The "from" and "to" colours are chosen to complement the type-accent stripe
// colours used in artifact-card.tsx without precisely copying them, so the
// gradient reads as thematic rather than garish.
// ---------------------------------------------------------------------------

interface GradientSpec {
  from: string;
  to: string;
  textColor: string;
}

const TYPE_GRADIENTS: Record<string, GradientSpec> = {
  raw_note:    { from: "#475569", to: "#1e293b", textColor: "#cbd5e1" }, // slate
  concept:     { from: "#1d4ed8", to: "#1e3a8a", textColor: "#bfdbfe" }, // blue
  entity:      { from: "#6d28d9", to: "#3b0764", textColor: "#ddd6fe" }, // violet
  topic:       { from: "#b45309", to: "#78350f", textColor: "#fde68a" }, // amber
  synthesis:   { from: "#047857", to: "#064e3b", textColor: "#a7f3d0" }, // emerald
  evidence:    { from: "#be123c", to: "#881337", textColor: "#fecdd3" }, // rose
  glossary:    { from: "#334155", to: "#0f172a", textColor: "#94a3b8" }, // slate-600
  contradiction:{ from: "#c2410c", to: "#7c2d12", textColor: "#fed7aa" }, // orange
};

const FALLBACK_GRADIENT: GradientSpec = {
  from: "#334155",
  to: "#0f172a",
  textColor: "#94a3b8",
};

function gradientForType(artifactType: string): GradientSpec {
  return TYPE_GRADIENTS[artifactType] ?? FALLBACK_GRADIENT;
}

/**
 * Derive the two-letter initials from a title string.
 * Splits on word boundaries; takes first letter of first word and first
 * letter of second word (if present). Falls back to first two chars.
 * Always uppercase.
 */
function titleInitials(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "–";
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ArtifactThumbnailFallbackProps {
  title: string;
  artifactType: string;
  /** Additional CSS classes applied to the outer wrapper */
  className?: string;
}

export function ArtifactThumbnailFallback({
  title,
  artifactType,
  className,
}: ArtifactThumbnailFallbackProps) {
  const { from, to, textColor } = gradientForType(artifactType);
  const initials = titleInitials(title);

  return (
    <div
      aria-hidden="true"
      className={cn(
        // Aspect ratio 16:9 to match real thumbnail slot
        "aspect-video w-full flex items-center justify-center overflow-hidden select-none",
        className,
      )}
      style={{
        background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
      }}
    >
      <span
        className="font-semibold tracking-widest uppercase"
        style={{
          color: textColor,
          // Scale the initials relative to container: use a viewport-independent
          // approach (clamp between readable floor and natural ceiling).
          fontSize: "clamp(1.25rem, 3vw, 2.5rem)",
          lineHeight: 1,
          opacity: 0.85,
        }}
      >
        {initials}
      </span>
    </div>
  );
}
