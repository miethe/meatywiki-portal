"use client";

/**
 * ArtifactCard — unified card component for artifact list views.
 *
 * Used in Inbox (list layout) and Library (grid/list toggle).
 * Accepts all optional fields gracefully — missing lens/workflow data
 * renders with stable neutral fallbacks (design spec §3.3 invariant).
 *
 * Props shape matches ArtifactCard DTO from portal.api.schemas; downstream
 * tasks (P3-03, P3-05) wire real data by passing the API response directly.
 *
 * Stitch reference: §3.1 artifact card hierarchy.
 * WCAG 2.1 AA: interactive card has role="article" + focusable inner link.
 */

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ArtifactCard as ArtifactCardType } from "@/types/artifact";
import { TypeBadge } from "./type-badge";
import { WorkspaceBadge } from "./workspace-badge";
import { WorkflowStatusBadge } from "./workflow-status-badge";
import { LensBadgeSet } from "@/components/workflow/lens-badge-set";
import { ArtifactFreshnessBadge } from "@/components/artifact/freshness-badge";

interface ArtifactCardProps {
  artifact: ArtifactCardType;
  /** Variant: "list" for Inbox (full-width row), "grid" for Library grid */
  variant?: "list" | "grid";
  className?: string;
}

function formatRelativeTime(iso?: string | null): string {
  if (!iso) return "";
  try {
    const date = new Date(iso);
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return "";
  }
}

export function ArtifactCard({
  artifact,
  variant = "list",
  className,
}: ArtifactCardProps) {
  const {
    id,
    title,
    type,
    workspace,
    updated,
    workflow_status,
    preview,
  } = artifact;

  const relativeTime = formatRelativeTime(updated);

  return (
    <article
      className={cn(
        "group relative rounded-md border bg-card transition-shadow hover:shadow-sm",
        variant === "list" && "flex items-start gap-3 p-3",
        variant === "grid" && "flex flex-col gap-2 p-4",
        className,
      )}
      aria-label={title}
    >
      {/* Stretch link covers entire card for click; title provides label */}
      <Link
        href={`/artifact/${id}`}
        aria-label={`View ${title}`}
        className="absolute inset-0 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        tabIndex={0}
      />

      {/* Content — visually above the stretch link, but pointer-events pass through
          so clicks land on the underlying <Link>.  Interactive children re-enable
          their own pointer events via `pointer-events-auto`. */}
      <div className={cn("pointer-events-none relative flex min-w-0 flex-col gap-1.5", variant === "list" && "flex-1")}>
        {/* Badge row */}
        <div className="flex flex-wrap items-center gap-1">
          <TypeBadge type={type} />
          <WorkspaceBadge workspace={workspace} />
          {workflow_status && <WorkflowStatusBadge status={workflow_status} />}
        </div>

        {/* Title */}
        <h3
          className={cn(
            "font-medium leading-snug text-foreground",
            variant === "list" ? "text-sm" : "text-sm",
          )}
        >
          {title}
        </h3>

        {/* Preview text */}
        {preview && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{preview}</p>
        )}

        {/* Footer row: lens badges + timestamp */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex flex-wrap items-center gap-1">
            <LensBadgeSet artifact={artifact} variant="compact" />
            {/* Freshness indicator from metadata (P4-04): compact, cards-only */}
            <ArtifactFreshnessBadge
              freshness={artifact.metadata?.freshness}
            />
          </div>
          {relativeTime && updated && (
            <time
              dateTime={updated}
              className="shrink-0 text-[11px] text-muted-foreground"
            >
              {relativeTime}
            </time>
          )}
        </div>
      </div>
    </article>
  );
}
