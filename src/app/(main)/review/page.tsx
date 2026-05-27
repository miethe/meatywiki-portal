"use client";

/**
 * Review screen — human-in-the-loop review surface.
 *
 * P4-FE-009: Two-tab review surface:
 *   - Low Confidence: artifacts with verification_status=human_review_pending,
 *     shown with suggested_links inline and accept/reject actions.
 *   - Transcript Pending: audio artifacts awaiting transcription (read-only).
 *
 * Tab selection is managed via the URL query param `?tab=` so links are
 * bookmarkable. Defaults to "low-confidence" when param is absent or invalid.
 *
 * Follows the Library page pattern:
 *   - Full-height flex column inside the shell <main> area
 *   - Header with title + count
 *   - Tabs from shadcn/ui Tabs pattern (built inline with Radix under the hood
 *     via the existing tab-like pattern — uses URL-synced state + ARIA tabs)
 */

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useCallback } from "react";
import { ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { LowConfidenceList } from "@/components/review/LowConfidenceList";
import { TranscriptPendingList } from "@/components/review/TranscriptPendingList";

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

type ReviewTab = "low-confidence" | "transcript-pending";

const TABS: { id: ReviewTab; label: string; description: string }[] = [
  {
    id: "low-confidence",
    label: "Low Confidence",
    description:
      "Artifacts flagged for human review due to low classification confidence. Accept to mark as verified, or reject.",
  },
  {
    id: "transcript-pending",
    label: "Transcript Pending",
    description: "Audio artifacts awaiting transcription by the processing pipeline.",
  },
];

function isValidTab(value: string | null): value is ReviewTab {
  return value === "low-confidence" || value === "transcript-pending";
}

// ---------------------------------------------------------------------------
// Tab bar
// ---------------------------------------------------------------------------

interface TabBarProps {
  activeTab: ReviewTab;
  onTabChange: (tab: ReviewTab) => void;
}

function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <div
      role="tablist"
      aria-label="Review filters"
      className="flex gap-0.5 rounded-lg border bg-muted p-0.5 w-fit"
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`review-tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`review-panel-${tab.id}`}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inner page (reads searchParams — must be wrapped in Suspense)
// ---------------------------------------------------------------------------

function ReviewPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const rawTab = searchParams.get("tab");
  const activeTab: ReviewTab = isValidTab(rawTab) ? rawTab : "low-confidence";

  const handleTabChange = useCallback(
    (tab: ReviewTab) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      router.push(`/review?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const activeTabMeta = TABS.find((t) => t.id === activeTab)!;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4 md:p-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck
              aria-hidden="true"
              className="size-5 text-muted-foreground"
            />
            <h1 className="text-2xl font-semibold tracking-tight">Review</h1>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Human-in-the-loop review surface for flagged and pending artifacts.
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="shrink-0">
        <TabBar activeTab={activeTab} onTabChange={handleTabChange} />
      </div>

      {/* Active tab description */}
      <p
        key={activeTab}
        className="shrink-0 text-xs text-muted-foreground"
        aria-live="polite"
      >
        {activeTabMeta.description}
      </p>

      {/* Tab panels */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        {TABS.map((tab) => (
          <div
            key={tab.id}
            role="tabpanel"
            id={`review-panel-${tab.id}`}
            aria-labelledby={`review-tab-${tab.id}`}
            hidden={activeTab !== tab.id}
            className={cn(activeTab === tab.id ? "block" : "hidden")}
          >
            {activeTab === tab.id && (
              <>
                {tab.id === "low-confidence" && <LowConfidenceList />}
                {tab.id === "transcript-pending" && <TranscriptPendingList />}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export — Suspense boundary required for useSearchParams
// ---------------------------------------------------------------------------

export default function ReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full min-h-0 flex-col gap-4 p-4 md:p-6">
          <div className="shrink-0">
            <div className="flex items-center gap-2">
              <ClipboardCheck
                aria-hidden="true"
                className="size-5 text-muted-foreground"
              />
              <h1 className="text-2xl font-semibold tracking-tight">Review</h1>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Human-in-the-loop review surface for flagged and pending artifacts.
            </p>
          </div>
          <div className="animate-pulse flex gap-0.5 rounded-lg border bg-muted p-0.5 w-fit">
            <div className="h-8 w-32 rounded-md bg-muted-foreground/10" />
            <div className="h-8 w-36 rounded-md bg-muted-foreground/10" />
          </div>
        </div>
      }
    >
      <ReviewPageInner />
    </Suspense>
  );
}
