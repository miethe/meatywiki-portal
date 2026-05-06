"use client";

import Link from "next/link";
import { Clock, ExternalLink, Link2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ArtifactCard,
  ArtifactLinkedPreview,
} from "@/types/artifact";
import { TypeBadge } from "@/components/ui/type-badge";
import { LensBadgeSet } from "@/components/workflow/lens-badge-set";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

interface ArtifactPreviewSheetProps {
  artifact: ArtifactCard | null;
  open: boolean;
  onClose: () => void;
}

function humanise(value?: string | null): string {
  if (!value) return "Unknown";
  return value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function groupLinkedItems(items: ArtifactLinkedPreview[] = []) {
  const grouped = new Map<string, ArtifactLinkedPreview[]>();
  for (const item of items) {
    const relationship = humanise(item.relationship_type);
    const direction = humanise(item.direction);
    const key = `${relationship} ${direction}`.trim();
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }
  return Array.from(grouped.entries());
}

function Properties({ artifact }: { artifact: ArtifactCard }) {
  const rows = [
    ["Workspace", humanise(artifact.workspace)],
    ["Status", humanise(artifact.status)],
    ["Type", humanise(artifact.type)],
    artifact.subtype ? ["Subtype", humanise(artifact.subtype)] : null,
    artifact.created ? ["Created", formatDateTime(artifact.created)] : null,
    artifact.updated ? ["Updated", formatDateTime(artifact.updated)] : null,
    artifact.metadata?.fidelity
      ? ["Fidelity", humanise(artifact.metadata.fidelity)]
      : null,
    artifact.metadata?.freshness
      ? ["Freshness", humanise(artifact.metadata.freshness)]
      : null,
    artifact.metadata?.verification_state
      ? ["Verification", humanise(artifact.metadata.verification_state)]
      : null,
  ].filter((row): row is [string, string] => row !== null);

  return (
    <section aria-labelledby="preview-properties" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 id="preview-properties" className="text-xs font-semibold uppercase text-muted-foreground">
          Properties
        </h3>
        <LensBadgeSet artifact={artifact} variant="compact" />
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        {rows.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-[11px] text-muted-foreground">{label}</dt>
            <dd className="truncate font-medium text-foreground" title={value}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function LinkedItems({ artifact }: { artifact: ArtifactCard }) {
  const graphContext = artifact.graph_context;
  const groups = groupLinkedItems(graphContext?.linked_previews ?? []);
  const connectionCount =
    (graphContext?.incoming_count ?? 0) + (graphContext?.outgoing_count ?? 0);

  return (
    <section aria-labelledby="preview-linked" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 id="preview-linked" className="text-xs font-semibold uppercase text-muted-foreground">
          Linked Items
        </h3>
        {connectionCount > 0 && (
          <span className="text-[11px] text-muted-foreground">
            {connectionCount} total
          </span>
        )}
      </div>
      {groups.length === 0 ? (
        <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
          No linked items in the card context.
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(([group, items]) => (
            <div key={group} className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                {group}
              </p>
              <ul className="space-y-1" aria-label={group}>
                {items.map((item) => (
                  <li key={`${group}-${item.artifact_id}`}>
                    <Link
                      href={`/artifact/${item.artifact_id}`}
                      className={cn(
                        "flex items-center gap-2 rounded-md border bg-background px-2 py-1.5",
                        "text-xs text-foreground transition-colors hover:bg-accent",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      )}
                    >
                      <Link2 aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">
                        {item.title ?? item.artifact_id}
                      </span>
                      {item.artifact_type && (
                        <TypeBadge type={item.artifact_type} className="shrink-0" />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Activity({ artifact }: { artifact: ArtifactCard }) {
  const activity = [
    { label: "Updated", timestamp: artifact.updated ?? null },
    { label: "Created", timestamp: artifact.created ?? null },
  ].filter((item) => item.timestamp);

  return (
    <section aria-labelledby="preview-activity" className="space-y-3">
      <h3 id="preview-activity" className="text-xs font-semibold uppercase text-muted-foreground">
        Activity
      </h3>
      {activity.length === 0 ? (
        <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
          No activity timestamps in the card context.
        </div>
      ) : (
        <ol className="space-y-3">
          {activity.map((item) => (
            <li key={`${item.label}-${item.timestamp}`} className="flex gap-3">
              <Clock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground">{item.label}</p>
                {item.timestamp && (
                  <time
                    dateTime={item.timestamp}
                    className="text-[11px] text-muted-foreground"
                  >
                    {formatDateTime(item.timestamp)}
                  </time>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function ArtifactPreviewSheet({
  artifact,
  open,
  onClose,
}: ArtifactPreviewSheetProps) {
  if (!artifact) return null;

  const summary = artifact.preview;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent
        aria-describedby={undefined}
        className={cn(
          "fixed inset-y-0 right-0 max-h-none w-full max-w-[520px] translate-x-0 rounded-none",
          "flex flex-col border-l bg-background shadow-xl ring-0",
          "animate-in slide-in-from-right duration-200",
        )}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <TypeBadge type={artifact.type} />
              {(artifact.owners ?? []).slice(0, 2).map((owner) => (
                <span
                  key={owner}
                  className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                >
                  {owner}
                </span>
              ))}
            </div>
            <DialogTitle className="line-clamp-2 text-lg font-semibold leading-tight text-foreground">
              {artifact.title}
            </DialogTitle>
          </div>
          <button
            type="button"
            aria-label="Close preview"
            onClick={onClose}
            className={cn(
              "inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground",
              "transition-colors hover:bg-accent hover:text-accent-foreground",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-6">
            <section aria-labelledby="preview-summary" className="space-y-2">
              <h3 id="preview-summary" className="text-xs font-semibold uppercase text-muted-foreground">
                Summary
              </h3>
              <p className="text-sm leading-relaxed text-foreground">
                {summary || "No summary in the card context."}
              </p>
            </section>
            <Properties artifact={artifact} />
            <LinkedItems artifact={artifact} />
            <Activity artifact={artifact} />
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t px-5 py-4">
          <p className="truncate text-xs text-muted-foreground">{artifact.file_path}</p>
          <Link
            href={`/artifact/${artifact.id}`}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-2 rounded-md border px-3",
              "text-xs font-medium text-foreground transition-colors hover:bg-accent",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <ExternalLink aria-hidden="true" className="size-3.5" />
            Open full page
          </Link>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
