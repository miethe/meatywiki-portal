"use client";

/**
 * BlogPostCard — card component for blog post list views.
 *
 * Used in BlogWorkspaceScreen (grid and list variants).
 * Renders title, status badge, timestamps.
 *
 * P1.5-3-03: Blog workspace screens
 * Stitch reference: blog-workspace.html
 */

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { BlogPost, BlogPostStatus } from "@/lib/api/blog";

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<BlogPostStatus, string> = {
  draft: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  compiled: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  published: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  archived: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

const STATUS_LABELS: Record<BlogPostStatus, string> = {
  draft: "Draft",
  compiled: "Compiled",
  published: "Published",
  archived: "Archived",
};

function BlogStatusBadge({ status }: { status: BlogPostStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        STATUS_STYLES[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Time formatter
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Card component
// ---------------------------------------------------------------------------

interface BlogPostCardProps {
  post: BlogPost;
  variant?: "list" | "grid";
  className?: string;
}

export function BlogPostCard({
  post,
  variant = "grid",
  className,
}: BlogPostCardProps) {
  const { artifact_id, title, status, updated_at, summary } = post;
  const href = `/blog/${artifact_id}`;

  if (variant === "list") {
    return (
      <article
        aria-label={title}
        className={cn(
          "group relative flex items-start gap-4 rounded-lg border bg-card p-4",
          "hover:bg-accent/30 transition-colors",
          className,
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={href}
              className={cn(
                "text-sm font-medium text-foreground truncate",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                "after:absolute after:inset-0",
              )}
            >
              {title}
            </Link>
            <BlogStatusBadge status={status} />
          </div>
          {summary && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
              {summary}
            </p>
          )}
        </div>
        <time
          dateTime={updated_at}
          className="shrink-0 text-xs text-muted-foreground"
        >
          {formatRelativeTime(updated_at)}
        </time>
      </article>
    );
  }

  return (
    <article
      aria-label={title}
      className={cn(
        "group relative flex flex-col gap-3 rounded-lg border bg-card p-4",
        "hover:bg-accent/30 transition-colors",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <BlogStatusBadge status={status} />
        <time
          dateTime={updated_at}
          className="shrink-0 text-xs text-muted-foreground"
        >
          {formatRelativeTime(updated_at)}
        </time>
      </div>

      <Link
        href={href}
        className={cn(
          "text-sm font-semibold text-foreground line-clamp-2 leading-snug",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          "after:absolute after:inset-0",
        )}
      >
        {title}
      </Link>

      {summary && (
        <p className="text-xs text-muted-foreground line-clamp-2">{summary}</p>
      )}
    </article>
  );
}
