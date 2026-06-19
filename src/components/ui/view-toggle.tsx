"use client";

import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ViewMode = "grid" | "list";

// ---------------------------------------------------------------------------
// ViewToggle component
// ---------------------------------------------------------------------------

export function ViewToggle({
  view,
  onChange,
  className,
}: {
  view: ViewMode;
  onChange: (next: ViewMode) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="View layout"
      className={cn("flex rounded-md border", className)}
    >
      <button
        type="button"
        aria-label="List view"
        aria-pressed={view === "list"}
        onClick={() => onChange("list")}
        className={cn(
          "inline-flex min-h-[44px] items-center gap-1.5 rounded-l-md border-r px-3 text-xs font-medium transition-colors sm:h-8 sm:min-h-0",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          view === "list"
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
        )}
      >
        <List aria-hidden="true" className="size-3.5" />
        <span className="hidden sm:inline">List</span>
      </button>
      <button
        type="button"
        aria-label="Grid view"
        aria-pressed={view === "grid"}
        onClick={() => onChange("grid")}
        className={cn(
          "inline-flex min-h-[44px] items-center gap-1.5 rounded-r-md px-3 text-xs font-medium transition-colors sm:h-8 sm:min-h-0",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          view === "grid"
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
        )}
      >
        <LayoutGrid aria-hidden="true" className="size-3.5" />
        <span className="hidden sm:inline">Grid</span>
      </button>
    </div>
  );
}
