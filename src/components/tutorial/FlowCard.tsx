"use client";

/**
 * FlowCard — card component for the /tutorial page.
 *
 * Each card represents one Portal flow (e.g. Ingest, Compile, Library Browse).
 * It surfaces:
 *   - title + summary (always visible)
 *   - optional screenshot (Next.js Image)
 *   - expandable long description (disclosure toggle, no external dep)
 *   - expected output bullet list (collapsible alongside long description)
 *   - "Open page" link — always active
 *   - "Start tour" button — active when tourId is non-null; disabled otherwise
 *   - CompletionBadge slot — renders when tour.isComplete is true
 *
 * The HTML id prop anchors TutorialNav scroll-spy links.
 *
 * WCAG 2.1 AA:
 *   - disclosure button uses aria-expanded + aria-controls
 *   - disabled tour button has aria-disabled + descriptive tooltip via title
 *   - "Open page" link has descriptive aria-label
 */

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CompletionBadge } from "@/components/tutorial/CompletionBadge";
import { useTour } from "@/hooks/use-tour";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FlowCardProps {
  /** HTML id — used as anchor target by TutorialNav */
  id: string;
  /** Flow name */
  title: string;
  /** 2-sentence overview shown at all times */
  summary: string;
  /** Expandable paragraph (collapsed by default) */
  longDescription?: string;
  /** Bullet list of what the user will produce */
  expectedOutput?: string[];
  /** "Open page" link target */
  deepLinkHref: string;
  /**
   * Tour id — null when no tour is defined for this flow.
   * When non-null the Start Tour button is active and wired to useTour.
   */
  tourId: string | null;
  /** Optional screenshot path (Next.js Image src) */
  screenshotSrc?: string;
  /** Completion indicator — driven by tour completion state */
  isComplete?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FlowCard({
  id,
  title,
  summary,
  longDescription,
  expectedOutput,
  deepLinkHref,
  tourId,
  screenshotSrc,
  isComplete: isCompleteProp = false,
}: FlowCardProps) {
  const [expanded, setExpanded] = useState(false);

  // useTour must be called unconditionally. When tourId is null we pass an
  // empty string as a sentinel; the result is discarded in that case.
  const tour = useTour(tourId ?? "");
  const hasTour = tourId !== null;
  const isComplete = hasTour ? tour.isComplete : isCompleteProp;
  const detailsId = `${id}-details`;
  const hasExpandable = Boolean(longDescription || (expectedOutput && expectedOutput.length > 0));

  return (
    <article
      id={id}
      aria-label={title}
      className={cn(
        "group relative flex flex-col gap-4 rounded-xl border bg-card text-card-foreground shadow-sm",
        "p-5 sm:p-6",
        "transition-shadow hover:shadow-md",
        isComplete && "ring-1 ring-emerald-500/30",
      )}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Header row: title + completion badge                                */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold leading-snug">{title}</h3>
        <CompletionBadge isComplete={isComplete} className="shrink-0 mt-0.5" />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Optional screenshot                                                  */}
      {/* ------------------------------------------------------------------ */}
      {screenshotSrc && (
        <div className="relative w-full overflow-hidden rounded-lg border bg-muted aspect-video">
          <Image
            src={screenshotSrc}
            alt={`Screenshot of the ${title} flow`}
            fill
            className="object-cover object-top"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
          />
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Summary — always visible                                            */}
      {/* ------------------------------------------------------------------ */}
      <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>

      {/* ------------------------------------------------------------------ */}
      {/* Expandable section: long description + expected output              */}
      {/* ------------------------------------------------------------------ */}
      {hasExpandable && (
        <div>
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={detailsId}
            onClick={() => setExpanded((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground",
              "transition-colors hover:text-foreground focus-visible:outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded",
            )}
          >
            {expanded ? (
              <ChevronDown className="size-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
            )}
            {expanded ? "Show less" : "Show more"}
          </button>

          <div
            id={detailsId}
            role="region"
            aria-label={`Details for ${title}`}
            className={cn(
              "overflow-hidden transition-all duration-200",
              expanded ? "mt-3 opacity-100 max-h-[1000px]" : "opacity-0 max-h-0",
            )}
          >
            {longDescription && (
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                {longDescription}
              </p>
            )}

            {expectedOutput && expectedOutput.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-foreground mb-1.5">
                  What you will produce
                </p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {expectedOutput.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span aria-hidden="true" className="mt-1.5 size-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Action row: Open page | Start tour (stub)                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center gap-2 pt-1 mt-auto">
        <Button asChild size="sm" variant="default">
          <Link
            href={deepLinkHref}
            aria-label={`Open ${title} page`}
          >
            <ExternalLink className="size-3.5" aria-hidden="true" />
            Open page
          </Link>
        </Button>

        <Button
          size="sm"
          variant="outline"
          disabled={!hasTour}
          aria-disabled={!hasTour}
          title={hasTour ? undefined : "No tour available"}
          onClick={hasTour ? tour.start : undefined}
          className={cn(!hasTour && "cursor-not-allowed opacity-60")}
        >
          <Play className="size-3.5" aria-hidden="true" />
          Start tour
        </Button>
      </div>
    </article>
  );
}
