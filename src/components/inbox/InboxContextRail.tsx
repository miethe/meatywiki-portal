"use client";

/**
 * InboxContextRail — inbox-specific ContextRail content wrapper.
 *
 * Composes the generic <ContextRail> with:
 *   - customTabs: single "Properties" tab showing inbox-item metadata
 *     (type, source, intake date, content length derived from raw_content /
 *     frontmatter_jsonb.word_count)
 *   - actions: five stub action buttons (verb-first, lucide icons)
 *   - footer: "Finalize Entry" primary CTA (stub)
 *   - empty state: "Select an inbox item to see details & actions"
 *
 * All actions and the footer CTA are stubs that console.debug only — no
 * backend flows are wired in v1.5 (per P5-03 spec).
 *
 * Task: P5-03
 * Stitch ref: "Inbox" screen (ID: 837a47df72a648749bafefd22988de7f)
 */

import {
  FlaskConical,
  Link2,
  GitMerge,
  Zap,
  ClipboardCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ContextRail,
  type ContextRailTab,
  type ContextRailAction,
} from "@/components/layout/ContextRail";
import type { ArtifactCard } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function deriveWordCount(item: ArtifactCard): number | null {
  // frontmatter_jsonb not on ArtifactCard — only on ArtifactDetail. Safe cast
  // via unknown so we don't break when the field is absent.
  const fm = (item as unknown as { frontmatter_jsonb?: Record<string, unknown> })
    .frontmatter_jsonb;
  const rawContent = (item as unknown as { raw_content?: string | null })
    .raw_content;

  const fmWordCount = fm?.["word_count"];
  if (typeof fmWordCount === "number") return fmWordCount;

  if (rawContent && typeof rawContent === "string") {
    return rawContent.trim().split(/\s+/).filter(Boolean).length;
  }
  return null;
}

function deriveSource(item: ArtifactCard): string | null {
  const fm = (item as unknown as { frontmatter_jsonb?: Record<string, unknown> })
    .frontmatter_jsonb;
  const meta = item.metadata as Record<string, unknown> | null | undefined;

  const src =
    (meta?.["source"] as string | null | undefined) ??
    (fm?.["source"] as string | null | undefined) ??
    null;
  return src ?? null;
}

// ---------------------------------------------------------------------------
// Inbox-specific Properties panel
// ---------------------------------------------------------------------------

interface InboxPropertiesPanelProps {
  item: ArtifactCard;
}

function InboxPropertiesPanel({ item }: InboxPropertiesPanelProps) {
  const source = deriveSource(item);
  const wordCount = deriveWordCount(item);
  const intakeDate = item.created ?? item.updated;

  return (
    <dl className="flex flex-col gap-2.5 text-xs">
      <div>
        <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Type
        </dt>
        <dd className="mt-0.5 capitalize">{item.type ?? "—"}</dd>
      </div>

      {item.status && (
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Status
          </dt>
          <dd className="mt-0.5 capitalize">{item.status}</dd>
        </div>
      )}

      {source && (
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Source
          </dt>
          <dd className="mt-0.5 break-all font-mono text-[11px] text-foreground/80">
            {source}
          </dd>
        </div>
      )}

      <div>
        <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Intake date
        </dt>
        <dd className="mt-0.5">
          {intakeDate ? (
            <time dateTime={intakeDate}>{formatDate(intakeDate)}</time>
          ) : (
            "—"
          )}
        </dd>
      </div>

      {wordCount !== null && (
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Content length
          </dt>
          <dd className="mt-0.5 tabular-nums">
            {wordCount.toLocaleString()} words
          </dd>
        </div>
      )}

      {item.file_path && (
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            File
          </dt>
          <dd className="mt-0.5 break-all font-mono text-[10px] text-foreground/60">
            {item.file_path}
          </dd>
        </div>
      )}
    </dl>
  );
}

// ---------------------------------------------------------------------------
// Action stubs
// ---------------------------------------------------------------------------

function buildActions(item: ArtifactCard): ContextRailAction[] {
  const stub = (label: string) => () => {
    console.debug("[inbox-rail] action:", label, item.id);
  };

  return [
    {
      label: "Move to Research",
      ariaLabel: "Move this item to the Research workspace",
      hasEndpoint: false,
      description: "Route this artifact into the Research workflow (v1.6)",
      onClick: stub("Move to Research"),
      icon: FlaskConical,
    },
    {
      label: "Link to Project Nexus",
      ariaLabel: "Link this item to a Project Nexus entry",
      hasEndpoint: false,
      description: "Associate this artifact with a project (v1.6)",
      onClick: stub("Link to Project Nexus"),
      icon: Link2,
    },
    {
      label: "Add to Synthesis",
      ariaLabel: "Add this item to a Synthesis artifact",
      hasEndpoint: false,
      description: "Merge into an existing synthesis document (v1.6)",
      onClick: stub("Add to Synthesis"),
      icon: GitMerge,
    },
    {
      label: "Start Compilation",
      ariaLabel: "Trigger compilation for this artifact",
      hasEndpoint: false,
      description: "Begin the compile stage for this artifact (v1.6)",
      onClick: stub("Start Compilation"),
      icon: Zap,
    },
    {
      label: "Request Review",
      ariaLabel: "Request a review for this artifact",
      hasEndpoint: false,
      description: "Flag this artifact for manual review (v1.6)",
      onClick: stub("Request Review"),
      icon: ClipboardCheck,
    },
  ];
}

// ---------------------------------------------------------------------------
// Inbox-specific tab set (single Properties tab)
// ---------------------------------------------------------------------------

function buildCustomTabs(item: ArtifactCard): ContextRailTab[] {
  return [
    {
      id: "properties",
      label: "Properties",
      renderContent: () => <InboxPropertiesPanel item={item} />,
    },
  ];
}

// ---------------------------------------------------------------------------
// Empty state (no item selected)
// ---------------------------------------------------------------------------

function RailEmptyState() {
  return (
    <div
      role="status"
      aria-label="No inbox item selected"
      className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed px-4 py-10 text-center"
    >
      <svg
        aria-hidden="true"
        className="size-8 text-muted-foreground/30"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.25}
          d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 0 2-2h2a2 2 0 0 0 2 2"
        />
      </svg>
      <p className="text-xs text-muted-foreground">
        Select an inbox item to see details &amp; actions
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// InboxContextRail — public component
// ---------------------------------------------------------------------------

export interface InboxContextRailProps {
  /** The currently-selected inbox item, or null when nothing is selected. */
  selectedItem: ArtifactCard | null;
  className?: string;
}

/**
 * InboxContextRail wires a selected inbox item into the shared <ContextRail>
 * with inbox-specific tabs (Properties) and suggested action stubs.
 *
 * A "Finalize Entry" primary CTA sits below the rail for direct promotion.
 *
 * Usage:
 * ```tsx
 * <aside className="hidden w-72 shrink-0 xl:block">
 *   <InboxContextRail selectedItem={selectedItem} />
 * </aside>
 * ```
 */
export function InboxContextRail({
  selectedItem,
  className,
}: InboxContextRailProps) {
  if (!selectedItem) {
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        <RailEmptyState />
      </div>
    );
  }

  const customTabs = buildCustomTabs(selectedItem);
  const actions = buildActions(selectedItem);

  const handleFinalize = () => {
    console.debug("[inbox-rail] action: Finalize Entry", selectedItem.id);
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Rail: actions + Properties tab */}
      <ContextRail
        customTabs={customTabs}
        actions={actions}
        ariaLabel="Inbox item context"
      />

      {/* Footer CTA — "Finalize Entry" */}
      <div className="border-t pt-3">
        <button
          type="button"
          aria-label={`Finalize entry: ${selectedItem.title}`}
          onClick={handleFinalize}
          className={cn(
            "inline-flex h-9 w-full items-center justify-center rounded-md",
            "bg-primary px-4 text-sm font-medium text-primary-foreground",
            "transition-colors hover:bg-primary/90",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          )}
        >
          Finalize Entry
        </button>
      </div>
    </div>
  );
}
