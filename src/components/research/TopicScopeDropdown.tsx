"use client";

/**
 * TopicScopeDropdown — topic-scoped filter for the Research Home bento.
 *
 * Replaces the generic lens filter as the primary scoping control on the
 * Research Home surface (ADR-DPI-004 DP1-06 #6).
 *
 * Topic list is fetched from GET /api/topics via the useTopics hook.
 *
 * WCAG 2.1 AA: select element carries labelled-by association.
 *
 * Stitch reference: Research Home (0cf6fb7b…) — topic dropdown scoped filter.
 *
 * Portal v1.7 Phase 4 (P4-02).
 */

import { BookOpen, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTopics } from "@/hooks/useTopics";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TopicScopeDropdownProps {
  /** Currently selected topic ID; null / undefined = "All topics" */
  selectedTopicId?: string | null;
  onChange: (topicId: string | null) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Skeleton rows — shown while topics are loading
// ---------------------------------------------------------------------------

function SkeletonOption() {
  return (
    <option value="" disabled>
      Loading topics…
    </option>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TopicScopeDropdown({
  selectedTopicId,
  onChange,
  className,
}: TopicScopeDropdownProps) {
  const selectId = "research-topic-scope";
  const { topics, isLoading, isError } = useTopics();

  const isDisabled = isLoading || isError;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center gap-1.5">
        <BookOpen aria-hidden="true" className="size-3.5 text-muted-foreground" />
        <label
          htmlFor={selectId}
          className="text-xs font-medium text-muted-foreground"
        >
          Topic
        </label>
      </div>

      {/* Wrapper for custom chevron */}
      <div className="relative">
        <select
          id={selectId}
          aria-label="Filter by topic"
          value={selectedTopicId ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === "" ? null : v);
          }}
          className={cn(
            "w-full appearance-none rounded-md border bg-background py-1.5 pl-3 pr-7",
            "text-sm text-foreground",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
          disabled={isDisabled}
        >
          {isLoading ? (
            <SkeletonOption />
          ) : isError ? (
            <>
              <option value="">All topics</option>
              <option value="" disabled>
                — failed to load topics —
              </option>
            </>
          ) : topics.length === 0 ? (
            <>
              <option value="">All topics</option>
              <option value="" disabled>
                — No topics found —
              </option>
            </>
          ) : (
            <>
              <option value="">All topics</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.title}
                </option>
              ))}
            </>
          )}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
        />
      </div>
    </div>
  );
}
