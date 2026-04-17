/**
 * ArtifactCardSkeleton — loading placeholder for ArtifactCard.
 *
 * Matches the visual structure of ArtifactCard grid/list variants so that
 * the layout does not shift when real data arrives (CLS prevention).
 *
 * Used in Library screen (grid variant) during initial load.
 */

import { cn } from "@/lib/utils";

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-sm bg-muted",
        className,
      )}
    />
  );
}

interface ArtifactCardSkeletonProps {
  variant?: "list" | "grid";
  className?: string;
}

export function ArtifactCardSkeleton({
  variant = "grid",
  className,
}: ArtifactCardSkeletonProps) {
  if (variant === "list") {
    return (
      <div
        aria-hidden="true"
        className={cn(
          "flex items-start gap-3 rounded-md border bg-card p-3",
          className,
        )}
      >
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex gap-1">
            <Shimmer className="h-4 w-14" />
            <Shimmer className="h-4 w-10" />
          </div>
          <Shimmer className="h-4 w-2/3" />
          <Shimmer className="h-3 w-full" />
          <Shimmer className="h-3 w-4/5" />
          <div className="flex justify-between pt-0.5">
            <div className="flex gap-1">
              <Shimmer className="h-4 w-10" />
              <Shimmer className="h-4 w-10" />
            </div>
            <Shimmer className="h-3 w-12" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex flex-col gap-2 rounded-md border bg-card p-4",
        className,
      )}
    >
      <div className="flex gap-1">
        <Shimmer className="h-4 w-14" />
        <Shimmer className="h-4 w-10" />
      </div>
      <Shimmer className="h-4 w-3/4" />
      <Shimmer className="h-3 w-full" />
      <Shimmer className="h-3 w-4/5" />
      <div className="flex items-center justify-between pt-0.5">
        <div className="flex gap-1">
          <Shimmer className="h-4 w-10" />
          <Shimmer className="h-4 w-10" />
        </div>
        <Shimmer className="h-3 w-12" />
      </div>
    </div>
  );
}

/** Grid of N skeleton cards to fill a grid during initial load */
export function ArtifactCardSkeletonGrid({
  count = 9,
  variant = "grid",
}: {
  count?: number;
  variant?: "list" | "grid";
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} aria-hidden="true">
          <ArtifactCardSkeleton variant={variant} />
        </li>
      ))}
    </>
  );
}
