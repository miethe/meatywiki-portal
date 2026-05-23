"use client";

/**
 * ProcessedSection — collapsible list of recently compiled artifacts.
 *
 * Renders below the inbox queue when `include_processed=true` data is
 * available from the server. Shows artifacts that have left inbox within
 * the past 24 h (compiled_at is set by the backend; client shows relative time).
 *
 * Collapse state: persisted in `sessionStorage` keyed by
 * `inbox-processed-collapsed`. Default: collapsed when empty, expanded
 * after items appear (to draw attention to newly processed items).
 *
 * Each row is clickable and links to the artifact detail page
 * (/artifacts/{id}), matching the existing inbox row click pattern.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ProcessedItemDTO } from "@/types/compileEvents";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SESSION_KEY = "inbox-processed-collapsed";

function readCollapsedPref(hasItems: boolean): boolean {
  // Default: collapsed when empty, expanded when items exist.
  const defaultValue = !hasItems;
  if (typeof window === "undefined") return defaultValue;
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored === null) return defaultValue;
    return stored === "true";
  } catch {
    return defaultValue;
  }
}

function writeCollapsedPref(collapsed: boolean): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_KEY, String(collapsed));
  } catch {
    // sessionStorage unavailable — ignore
  }
}

/** Format a relative timestamp: "2 min ago", "1 h ago", "3 d ago". */
function relativeTime(isoString: string | null | undefined): string {
  if (!isoString) return "";
  const diffMs = Date.now() - new Date(isoString).getTime();
  if (diffMs < 0) return "just now";
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} h ago`;
  return `${Math.floor(diffH / 24)} d ago`;
}

/** Map workspace slug to a human-readable label. */
function workspaceLabel(workspace: string): string {
  const map: Record<string, string> = {
    library: "Library",
    blog: "Blog",
    projects: "Projects",
    research: "Research",
    wiki: "Wiki",
  };
  return map[workspace] ?? workspace.charAt(0).toUpperCase() + workspace.slice(1);
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ProcessedSectionProps {
  items: ProcessedItemDTO[];
  /**
   * Override the initial collapsed state. If omitted, the component reads
   * from sessionStorage (default: collapsed when empty).
   */
  defaultCollapsed?: boolean;
  /**
   * Optional info element rendered inline next to the "Processed" heading.
   * Accepts any ReactNode — typically an <InfoTooltip> icon. When undefined,
   * no extra element is rendered and existing callers are unaffected.
   */
  info?: React.ReactNode;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProcessedSection({
  items,
  defaultCollapsed,
  info,
  className,
}: ProcessedSectionProps) {
  const hasItems = items.length > 0;

  // Initialise from prop or sessionStorage. Use a ref to avoid
  // re-reading storage on every render.
  const initRef = useRef(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (defaultCollapsed !== undefined) return defaultCollapsed;
    return readCollapsedPref(hasItems);
  });

  // When items first appear (empty → non-empty), auto-expand so the user
  // sees the newly processed items without having to click.
  const prevHasItems = useRef(hasItems);
  useEffect(() => {
    if (!prevHasItems.current && hasItems && !initRef.current) {
      setCollapsed(false);
      writeCollapsedPref(false);
    }
    prevHasItems.current = hasItems;
    initRef.current = true;
  }, [hasItems]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      writeCollapsedPref(next);
      return next;
    });
  }, []);

  // Don't render the section at all when there are no items.
  if (!hasItems) return null;

  return (
    <section
      aria-label="Recently processed artifacts"
      className={cn("mt-6 border-t pt-4", className)}
    >
      {/* Collapsible header */}
      <button
        type="button"
        aria-expanded={!collapsed}
        aria-controls="processed-section-body"
        onClick={toggleCollapsed}
        className={cn(
          "flex w-full items-center justify-between gap-2 py-1",
          "text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1">
            <h2 className="text-sm font-medium text-foreground">
              Processed
            </h2>
            {info ?? null}
          </span>
          <span
            className={cn(
              "inline-flex h-5 min-w-[20px] items-center justify-center rounded-full",
              "bg-muted px-1.5 text-[11px] font-medium tabular-nums text-muted-foreground",
            )}
          >
            {items.length}
          </span>
        </div>

        {/* Chevron icon */}
        <svg
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-150",
            collapsed ? "rotate-0" : "rotate-180",
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="m6 9 6 6 6-6"
          />
        </svg>
      </button>

      {/* Body — hidden when collapsed */}
      <div
        id="processed-section-body"
        hidden={collapsed}
      >
        <ul
          role="list"
          aria-label="Processed artifacts"
          className="mt-2 flex flex-col gap-1"
        >
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/artifacts/${item.id}`}
                aria-label={`${item.title} — moved to ${workspaceLabel(item.workspace)}`}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-md px-3 py-2",
                  "text-sm transition-colors",
                  "hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                {/* Left: title + destination */}
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate font-medium text-foreground">
                    {item.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    → {workspaceLabel(item.workspace)}
                  </span>
                </div>

                {/* Right: relative time */}
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground/70">
                  {relativeTime(item.compiled_at ?? item.updated)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
