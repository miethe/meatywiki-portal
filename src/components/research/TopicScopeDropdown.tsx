"use client";

/**
 * TopicScopeDropdown — topic-scoped filter for the Research Home bento.
 *
 * Replaces the generic lens filter as the primary scoping control on the
 * Research Home surface (ADR-DPI-004 DP1-06 #6).
 *
 * v1.5: topic list is fetched from GET /api/topics (v1.6 endpoint — missing
 * in v1.5 backend). While the endpoint is unavailable the dropdown renders a
 * "coming in v1.6" affordance so the page does not block.
 *
 * Missing endpoint: GET /api/topics
 *   Returns: { data: { items: Array<{ id: string; title: string; article_count: number }> } }
 *   Query params: workspace=research, limit, cursor
 *   Doc ref: docs/project_plans/llm_wiki/portal/ADRs/ADR-DPI-004-research-home-scope.md §6
 *
 * When the endpoint ships (v1.6) replace the hardcoded STUB_TOPICS with a
 * hook call and remove the "coming in v1.6" notice.
 *
 * WCAG 2.1 AA: select element carries labelled-by association.
 *
 * Stitch reference: Research Home (0cf6fb7b…) — topic dropdown scoped filter.
 */

import { BookOpen, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TopicItem {
  id: string;
  title: string;
  article_count?: number;
}

export interface TopicScopeDropdownProps {
  /** Currently selected topic ID; null / undefined = "All topics" */
  selectedTopicId?: string | null;
  onChange: (topicId: string | null) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// v1.5 placeholder — no backend endpoint yet
// The SELECT is rendered but pre-populated with a notice row rather than
// live data. Replace with a real hook when GET /api/topics ships in v1.6.
// ---------------------------------------------------------------------------

const ENDPOINT_MISSING_NOTICE =
  "Topic list requires GET /api/topics — shipping in v1.6.";

export function TopicScopeDropdown({
  selectedTopicId,
  onChange,
  className,
}: TopicScopeDropdownProps) {
  const selectId = "research-topic-scope";

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
          disabled
          title={ENDPOINT_MISSING_NOTICE}
        >
          <option value="">All topics</option>
          <option value="_placeholder" disabled>
            — topic list available in v1.6 —
          </option>
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
        />
      </div>

      {/* Coming-in-v1.6 notice */}
      <p className="text-[11px] text-muted-foreground" role="note">
        Topic filter requires{" "}
        <code className="rounded bg-muted px-1 font-mono text-[10px]">
          GET /api/topics
        </code>{" "}
        — coming in v1.6.
      </p>
    </div>
  );
}
