"use client";

/**
 * StoryDetailClient — rich detail view for a single op story.
 *
 * Sections (per task UX spec):
 *   1. Metadata           — title, project, lifecycle status badge, date, domains
 *   2. After-Action Review — AAR markdown body via ArticleViewer; empty-state when absent
 *   3. Status timeline    — lifecycle dates + reason_code
 *   4. Safety / scrub     — sensitivity badge + scrub.summary + issue count
 *   5. Publication        — draft_pr_url, published_url, post_slug
 *   6. Source             — safe_ref/safe_uri (only when present; omitted if held)
 *   7. Related refs       — ccdash_session, ccdash_feature, routing_tags
 *   8. Primary action     — View Draft PR / View Published / no-op
 *
 * "Held" UX: when sensitivity.level != "public", source.safe_ref/safe_uri
 * are null. Render "Details hidden (held)" + scrub.summary instead.
 *
 * Stale sync: amber badge + timestamp when sync.synced_at is old.
 *
 * Accessibility: WCAG 2.1 AA — status not colour-alone, focus-visible rings.
 */

import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  ExternalLink,
  GitPullRequest,
  Globe,
  Lock,
  Shield,
} from "lucide-react";
import { ArticleViewer } from "@miethe/ui";
import { cn } from "@/lib/utils";
import { STORIES_REDACTION_DISABLED } from "@/lib/env";
import type { StoryDetail } from "@/types/stories";
import { StoryStatusBadge } from "@/components/ui/StoryStatusBadge";

// ---------------------------------------------------------------------------
// Constants / helpers
// ---------------------------------------------------------------------------

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

function isStale(syncedAt: string): boolean {
  return Date.now() - new Date(syncedAt).getTime() > STALE_THRESHOLD_MS;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Shared layout components
// ---------------------------------------------------------------------------

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={`section-${title.toLowerCase().replace(/\s+/g, "-")}`}
      className={cn("flex flex-col gap-3", className)}
    >
      <h2
        id={`section-${title.toLowerCase().replace(/\s+/g, "-")}`}
        className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      <dt className="w-28 shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="flex-1 text-xs text-foreground">{children}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sensitivity badge (inline)
// ---------------------------------------------------------------------------

function SensitivityBadge({ level }: { level: string }) {
  const configs: Record<string, { colours: string; icon: React.ReactNode }> = {
    public: {
      colours:
        "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
      icon: <Globe aria-hidden="true" className="size-3 shrink-0" />,
    },
    internal: {
      colours:
        "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
      icon: <Shield aria-hidden="true" className="size-3 shrink-0" />,
    },
    blocked: {
      colours:
        "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
      icon: <Lock aria-hidden="true" className="size-3 shrink-0" />,
    },
  };
  const cfg = configs[level] ?? {
    colours: "bg-muted text-muted-foreground",
    icon: null,
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-medium",
        cfg.colours,
      )}
    >
      {cfg.icon}
      {level}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Stale sync badge
// ---------------------------------------------------------------------------

function StaleSyncBadge({ syncedAt }: { syncedAt: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-sm bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
      role="status"
      aria-label={`Stale sync — last synced ${new Date(syncedAt).toLocaleString()}`}
    >
      <Clock aria-hidden="true" className="size-3 shrink-0" />
      Stale sync — {formatDateTime(syncedAt)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// External link helper
// ---------------------------------------------------------------------------

function ExtLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-1 text-xs text-primary hover:underline",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded",
      )}
    >
      {label}
      <ExternalLink aria-hidden="true" className="size-3 shrink-0" />
    </a>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface StoryDetailClientProps {
  story: StoryDetail;
}

export function StoryDetailClient({ story }: StoryDetailClientProps) {
  const isHeld =
    !STORIES_REDACTION_DISABLED && story.sensitivity.level !== "public";
  const stale = isStale(story.sync.synced_at);

  // Primary action: View Published > View Draft PR > none
  const primaryAction = story.publication.published_url ? (
    <a
      href={story.publication.published_url}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "inline-flex min-h-[40px] items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground sm:h-9 sm:min-h-0",
        "transition-colors hover:bg-primary/90",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      )}
      aria-label="View published story"
    >
      <Globe aria-hidden="true" className="size-4" />
      View Published
    </a>
  ) : story.publication.draft_pr_url ? (
    <a
      href={story.publication.draft_pr_url}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "inline-flex min-h-[40px] items-center gap-2 rounded-md border px-4 text-sm font-medium sm:h-9 sm:min-h-0",
        "transition-colors hover:bg-accent hover:text-accent-foreground",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      )}
      aria-label="View draft pull request"
    >
      <GitPullRequest aria-hidden="true" className="size-4" />
      View Draft PR
    </a>
  ) : null;

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Back navigation */}
      <div>
        <Link
          href="/stories"
          className={cn(
            "inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded",
          )}
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          Stories
        </Link>
      </div>

      {/* Stale sync banner */}
      {stale && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/30">
          <StaleSyncBadge syncedAt={story.sync.synced_at} />
          <span className="text-xs text-amber-700 dark:text-amber-300">
            This story&apos;s sync data may be outdated.
          </span>
        </div>
      )}

      {/* Held banner */}
      {isHeld && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 dark:border-amber-800 dark:bg-amber-950/30"
        >
          <Lock
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400"
          />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Details hidden (held)
            </p>
            {story.scrub.summary && (
              <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                {story.scrub.summary}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Section 1: Metadata */}
      <Section title="Metadata">
        <dl className="flex flex-col gap-2">
          <MetaRow label="Title">
            {isHeld ? (
              <span className="italic text-muted-foreground">
                details hidden (held)
              </span>
            ) : (
              <span className="font-medium">
                {story.title ?? (
                  <span className="text-muted-foreground/70">{story.story_id}</span>
                )}
              </span>
            )}
          </MetaRow>

          <MetaRow label="Status">
            <div className="flex flex-wrap items-center gap-1.5">
              <StoryStatusBadge lifecycleState={story.lifecycle_state} />
              {story.story_status !== story.lifecycle_state && (
                <span className="text-xs text-muted-foreground">
                  ({story.story_status})
                </span>
              )}
            </div>
          </MetaRow>

          {story.project_id && (
            <MetaRow label="Project">
              <Link
                href={`/projects/${encodeURIComponent(story.project_id)}`}
                className="text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                {story.project_id}
              </Link>
            </MetaRow>
          )}

          <MetaRow label="Date">{formatDate(story.date)}</MetaRow>

          <MetaRow label="Source type">
            <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
              {story.source_type}
            </code>
          </MetaRow>

          {story.domains.length > 0 && (
            <MetaRow label="Domains">
              <div className="flex flex-wrap gap-1">
                {story.domains.map((d) => (
                  <span
                    key={d}
                    className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
                  >
                    {d}
                  </span>
                ))}
              </div>
            </MetaRow>
          )}

          <MetaRow label="Updated">{formatDateTime(story.updated_at)}</MetaRow>
        </dl>

        {primaryAction && (
          <div className="flex flex-wrap gap-2 pt-1">{primaryAction}</div>
        )}
      </Section>

      {/* Section 2: After-Action Review body */}
      <Section title="After-Action Review">
        {story.body ? (
          <ArticleViewer
            content={story.body}
            variant="editorial"
            format="auto"
            frontmatter="hide"
            sanitize={true}
            generateHeadingIds={true}
            className="rounded-md border bg-card p-6"
          />
        ) : (
          <div
            role="status"
            className="flex items-center justify-center rounded-md border border-dashed py-10 text-center"
          >
            <p className="text-sm text-muted-foreground">No AAR body available.</p>
          </div>
        )}
      </Section>

      {/* Section 3: Status timeline */}
      <Section title="Status Timeline">
        <dl className="flex flex-col gap-2">
          <MetaRow label="Current status">
            {/* Optional-chain guard: backend guarantees non-null, but be resilient */}
            <span className="text-xs font-medium">
              {story.lifecycle?.status ?? "—"}
            </span>
          </MetaRow>
          <MetaRow label="Created">{formatDateTime(story.lifecycle?.created_at)}</MetaRow>
          <MetaRow label="Updated">{formatDateTime(story.lifecycle?.updated_at)}</MetaRow>
          {story.lifecycle?.archived_at && (
            <MetaRow label="Archived">{formatDateTime(story.lifecycle.archived_at)}</MetaRow>
          )}
          {story.lifecycle?.reason_code && (
            <MetaRow label="Reason code">
              <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                {story.lifecycle.reason_code}
              </code>
            </MetaRow>
          )}
          {story.reason && (
            <MetaRow label="Reason">
              <span className="text-xs text-muted-foreground">{story.reason}</span>
            </MetaRow>
          )}
        </dl>
      </Section>

      {/* Section 4: Safety / Scrub */}
      <Section title="Safety and Scrub">
        <dl className="flex flex-col gap-2">
          <MetaRow label="Sensitivity">
            <SensitivityBadge level={story.sensitivity.level} />
          </MetaRow>
          <MetaRow label="Agent access">
            <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
              {story.sensitivity.agent_access}
            </code>
          </MetaRow>
          <MetaRow label="Scrub status">
            <span className="text-xs">{story.scrub.status}</span>
          </MetaRow>
          {story.scrub.issue_count > 0 && (
            <MetaRow label="Issues">
              <span className="text-xs text-amber-700 dark:text-amber-400">
                {story.scrub.issue_count} issue
                {story.scrub.issue_count !== 1 ? "s" : ""}
              </span>
            </MetaRow>
          )}
          {story.scrub.summary && (
            <MetaRow label="Summary">
              <p className="text-xs text-muted-foreground">{story.scrub.summary}</p>
            </MetaRow>
          )}
        </dl>
      </Section>

      {/* Section 5: Publication */}
      <Section title="Publication">
        <dl className="flex flex-col gap-2">
          <MetaRow label="State">
            <span className="text-xs font-medium">{story.publication.state}</span>
          </MetaRow>
          {story.publication.post_slug && (
            <MetaRow label="Post slug">
              <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                {story.publication.post_slug}
              </code>
            </MetaRow>
          )}
          {story.publication.draft_pr_url && (
            <MetaRow label="Draft PR">
              <ExtLink
                href={story.publication.draft_pr_url}
                label="View pull request"
              />
            </MetaRow>
          )}
          {story.publication.published_url && (
            <MetaRow label="Published URL">
              <ExtLink
                href={story.publication.published_url}
                label="View published story"
              />
            </MetaRow>
          )}
        </dl>
      </Section>

      {/* Section 6: Source (only when not held) */}
      {!isHeld && (story.source.safe_ref || story.source.safe_uri) && (
        <Section title="Source">
          <dl className="flex flex-col gap-2">
            {story.source.safe_ref && (
              <MetaRow label="Reference">
                <code className="rounded bg-muted px-1 py-0.5 text-[11px] break-all">
                  {story.source.safe_ref}
                </code>
              </MetaRow>
            )}
            {story.source.safe_uri && (
              <MetaRow label="URI">
                <ExtLink href={story.source.safe_uri} label="Open source" />
              </MetaRow>
            )}
          </dl>
        </Section>
      )}

      {/* Section 7: Related refs */}
      {/* Optional-chain guards: backend guarantees non-null but be resilient */}
      {(story.related_refs?.ccdash_session ||
        story.related_refs?.ccdash_feature ||
        story.routing_tags.length > 0) && (
        <Section title="Related Refs">
          <dl className="flex flex-col gap-2">
            {story.related_refs?.ccdash_session && (
              <MetaRow label="CCDash session">
                <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                  {story.related_refs.ccdash_session ?? "—"}
                </code>
              </MetaRow>
            )}
            {story.related_refs?.ccdash_feature && (
              <MetaRow label="CCDash feature">
                <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                  {story.related_refs.ccdash_feature ?? "—"}
                </code>
              </MetaRow>
            )}
            {story.routing_tags.length > 0 && (
              <MetaRow label="Routing tags">
                <div className="flex flex-wrap gap-1">
                  {story.routing_tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </MetaRow>
            )}
          </dl>
        </Section>
      )}

      {/* Sync info footer */}
      <div className="border-t pt-3 text-[11px] text-muted-foreground">
        <span>
          Synced from{" "}
          <code className="rounded bg-muted px-1 py-0.5">
            {story.sync.source_system}
          </code>{" "}
          at {formatDateTime(story.sync.synced_at)}
        </span>
      </div>
    </div>
  );
}
