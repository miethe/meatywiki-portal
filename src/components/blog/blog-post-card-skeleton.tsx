"use client";

/**
 * BlogPostCardSkeleton — loading skeleton for BlogPostCard.
 *
 * Used while blog posts are being fetched.
 *
 * P1.5-3-03: Blog workspace screens
 */

import { cn } from "@/lib/utils";

function BlogPostCardSkeleton({
  variant = "grid",
  className,
}: {
  variant?: "list" | "grid";
  className?: string;
}) {
  if (variant === "list") {
    return (
      <div
        aria-hidden="true"
        className={cn(
          "flex items-start gap-4 rounded-lg border bg-card p-4 animate-pulse",
          className,
        )}
      >
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-4 w-48 rounded bg-muted" />
            <div className="h-4 w-16 rounded-full bg-muted" />
          </div>
          <div className="h-3 w-3/4 rounded bg-muted" />
        </div>
        <div className="h-3 w-12 shrink-0 rounded bg-muted" />
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-card p-4 animate-pulse",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="h-4 w-16 rounded-full bg-muted" />
        <div className="h-3 w-10 rounded bg-muted" />
      </div>
      <div className="space-y-1.5">
        <div className="h-4 w-full rounded bg-muted" />
        <div className="h-4 w-3/4 rounded bg-muted" />
      </div>
      <div className="space-y-1">
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-2/3 rounded bg-muted" />
      </div>
    </div>
  );
}

export function BlogPostCardSkeletonGrid({
  count = 6,
  variant = "grid",
}: {
  count?: number;
  variant?: "list" | "grid";
}) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <li key={i}>
          <BlogPostCardSkeleton variant={variant} />
        </li>
      ))}
    </>
  );
}
