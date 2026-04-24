"use client";

/**
 * ContradictionDetailModal — side-by-side detail view for a contradiction pair.
 *
 * Renders two artifact panes side-by-side (stacked on mobile) inside an
 * accessible modal dialog. Each pane shows the artifact title, its excerpt
 * (if available), and a link to the full artifact detail page.
 *
 * The shared_topic tag and flagged_at date are shown in the modal header.
 *
 * Accessibility:
 *   - Leverages the existing Dialog / DialogContent / DialogTitle primitives
 *     from @/components/ui/dialog (focus trap, Esc-to-close, scroll lock,
 *     role="dialog", aria-modal="true", aria-labelledby).
 *   - Each pane has an aria-label identifying which artifact it contains.
 *   - Close button includes aria-label.
 *   - Link to full page has descriptive aria-label.
 *
 * Portal v1.6 Phase 7 (P7-02).
 */

import Link from "next/link";
import { X, Tag, Clock, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ContradictionPair, ContradictionArtifactStub } from "@/lib/api/research";

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

/**
 * Format an ISO 8601 date string as a human-readable relative time.
 * Mirrors the same helper in StaleArtifactsPanel for consistency.
 */
function formatRelativeDate(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

// ---------------------------------------------------------------------------
// Artifact pane
// ---------------------------------------------------------------------------

interface ArtifactPaneProps {
  artifact: ContradictionArtifactStub;
  side: "a" | "b";
}

function ArtifactPane({ artifact, side }: ArtifactPaneProps) {
  const label = side === "a" ? "First artifact" : "Second artifact";
  const artifactHref = `/library/${encodeURIComponent(artifact.id)}`;

  return (
    <article
      aria-label={`${label}: ${artifact.title}`}
      className={cn(
        "flex min-w-0 flex-1 flex-col gap-3 rounded-lg border p-4",
        side === "a"
          ? "border-rose-200 bg-rose-50/60 dark:border-rose-800/40 dark:bg-rose-950/10"
          : "border-amber-200 bg-amber-50/60 dark:border-amber-800/40 dark:bg-amber-950/10",
      )}
    >
      {/* Label badge */}
      <div>
        <span
          className={cn(
            "inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            side === "a"
              ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400"
              : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
          )}
        >
          Artifact {side.toUpperCase()}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold leading-tight text-foreground">
        {artifact.title}
      </h3>

      {/* Excerpt */}
      {artifact.excerpt ? (
        <p className="line-clamp-4 text-xs leading-relaxed text-muted-foreground">
          {artifact.excerpt}
        </p>
      ) : (
        <p className="text-xs italic text-muted-foreground/60">
          No excerpt available.
        </p>
      )}

      {/* Link to full artifact */}
      <Link
        href={artifactHref}
        className={cn(
          "mt-auto inline-flex items-center gap-1.5 text-xs font-medium",
          "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded",
          side === "a"
            ? "text-rose-600 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300"
            : "text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300",
        )}
        aria-label={`Open full page for ${artifact.title}`}
      >
        Open full page
        <ExternalLink aria-hidden="true" className="size-3 shrink-0" />
      </Link>
    </article>
  );
}

// ---------------------------------------------------------------------------
// ContradictionDetailModal
// ---------------------------------------------------------------------------

export interface ContradictionDetailModalProps {
  pair: ContradictionPair | null;
  open: boolean;
  onCloseAction: () => void;
}

/**
 * Modal dialog showing a side-by-side view of two contradicting artifacts.
 *
 * Pass `pair=null` to render nothing (dialog is closed).
 * The modal header shows the shared topic tag and flagged_at date.
 * Each pane links to the full artifact detail page.
 */
export function ContradictionDetailModal({
  pair,
  open,
  onCloseAction,
}: ContradictionDetailModalProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCloseAction(); }}>
      <DialogContent
        className="mx-4 max-w-3xl"
        aria-describedby="contradiction-modal-description"
      >
        {pair && (
          <>
            <DialogHeader className="border-b border-border pb-3 px-4 pt-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <DialogTitle className="text-base">
                    Contradiction Detail
                  </DialogTitle>
                  {/* Meta row */}
                  <div
                    id="contradiction-modal-description"
                    className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground"
                  >
                    <span className="inline-flex items-center gap-1">
                      <Tag aria-hidden="true" className="size-3 shrink-0" />
                      Topic:{" "}
                      <strong className="ml-0.5 font-medium text-foreground">
                        {pair.shared_topic}
                      </strong>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock aria-hidden="true" className="size-3 shrink-0" />
                      <time dateTime={pair.flagged_at}>
                        Flagged {formatRelativeDate(pair.flagged_at)}
                      </time>
                    </span>
                  </div>
                </div>

                {/* Close button */}
                <button
                  type="button"
                  onClick={onCloseAction}
                  aria-label="Close contradiction detail"
                  className={cn(
                    "shrink-0 rounded-md p-1 text-muted-foreground",
                    "hover:bg-muted hover:text-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "transition-colors",
                  )}
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              </div>
            </DialogHeader>

            {/* Side-by-side panes — stack on mobile, row on sm+ */}
            <div className="flex flex-col gap-3 overflow-y-auto p-4 sm:flex-row sm:gap-4">
              <ArtifactPane artifact={pair.artifact_a} side="a" />
              <ArtifactPane artifact={pair.artifact_b} side="b" />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
