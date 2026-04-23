"use client";

/**
 * RecentCapturesSection — 3–4 most recent intake artifacts as compact cards.
 *
 * Design spec §4.5: Recent Captures section, compact ArtifactCard variant.
 * - Fetches from inbox workspace (same data source as InboxPage).
 * - On fetch error or empty list, renders a graceful empty state.
 * - No spinner on initial render — shows skeleton placeholders.
 *
 * Data source: listArtifacts({ workspace: "inbox", limit: 4 }) via
 * native fetch (same pattern as useInboxArtifacts).
 *
 * Created for Portal v1.5 Stitch Reskin Phase 6 (P6-01).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { listArtifacts } from "@/lib/api/artifacts";
import { ArtifactCard } from "@/components/ui/artifact-card";
import { ArtifactCardSkeleton } from "@/components/ui/artifact-card-skeleton";
import type { ArtifactCard as ArtifactCardType } from "@/types/artifact";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Skeleton row — used during loading
// ---------------------------------------------------------------------------

function CaptureSkeletonRow() {
  return (
    <li aria-hidden="true">
      <ArtifactCardSkeleton variant="list" />
    </li>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyCaptures() {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-md",
        "border border-dashed py-10 text-center",
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-muted">
        <Inbox aria-hidden="true" className="size-5 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">Inbox is empty</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Captured artifacts will appear here.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------

interface RecentCapturesSectionProps {
  className?: string;
}

export function RecentCapturesSection({ className }: RecentCapturesSectionProps) {
  const [artifacts, setArtifacts] = useState<ArtifactCardType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Silently swallowed — no API error surfaced on the home page (graceful degradation)

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      setIsLoading(true);
      try {
        const envelope = await listArtifacts({ workspace: "inbox", limit: 4 });
        if (!cancelled) {
          setArtifacts(envelope.data ?? []);
        }
      } catch {
        // Graceful degradation: empty state renders on any error
        if (!cancelled) {
          setArtifacts([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void fetch();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section aria-labelledby="recent-captures-heading" className={className}>
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <h2
          id="recent-captures-heading"
          className="text-sm font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Recent Captures
        </h2>
        <Link
          href="/inbox"
          className={cn(
            "text-xs font-medium text-primary hover:text-primary/80",
            "underline-offset-2 hover:underline transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded",
          )}
        >
          View all
        </Link>
      </div>

      {/* Cards list */}
      {isLoading ? (
        <ul role="list" className="flex flex-col gap-2" aria-busy="true">
          {[1, 2, 3].map((i) => (
            <CaptureSkeletonRow key={i} />
          ))}
        </ul>
      ) : artifacts.length === 0 ? (
        <EmptyCaptures />
      ) : (
        <ul role="list" className="flex flex-col gap-2">
          {artifacts.map((artifact) => (
            <li key={artifact.id}>
              <ArtifactCard
                artifact={artifact}
                variant="list"
                displayVariant="compact"
                typeAccent
                activeRun={artifact.active_run ?? undefined}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
