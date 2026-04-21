"use client";

/**
 * ArtifactDetailClient — fully interactive Artifact Detail screen.
 *
 * Implements P3-06 scope:
 *   - GET /api/artifacts/:id via useArtifact (TanStack Query)
 *   - Loading skeleton, 404 state, generic error state
 *   - Tabs: Source | Knowledge | Draft | Workflow OS
 *   - Source Reader: raw markdown in <pre><code> with monospace styling
 *   - Knowledge Reader: compiled content (compiled_content field)
 *   - Draft Reader: synthesis/draft content or empty state if absent
 *   - Workflow OS tab: "Coming in Phase 4" placeholder
 *   - Action buttons: Promote, Link, Review (have backend endpoints — disabled
 *     in v1 until POST handlers are wired to UI state); Compile Now + Lint Scope
 *     are engine triggers (deferred to P3-07); all show "not yet wired" tooltip
 *   - HandoffChain in sidebar using artifact_edges
 *   - Metadata sidebar: id (copy), created_at, updated_at, status, tags
 *   - Responsive: tabs natural flow on mobile, sidebar hidden on small screens
 *
 * Rendering decisions:
 *   - raw_content: displayed in <pre><code> block — no dangerouslySetInnerHTML.
 *   - compiled_content: rendered as raw HTML via dangerouslySetInnerHTML.
 *     Portal is local-only (bearer-token auth), so no DOMPurify needed in v1.
 *     If PORTAL_ALLOW_NETWORK=1 is ever used, add DOMPurify here.
 *   - draft_content: same as compiled_content.
 *   - react-markdown: NOT added. Backend compiled_content is expected to be HTML
 *     from the engine's compile step. Plain markdown fallback uses <pre> block.
 *
 * Stitch references:
 *   - "Artifact Detail" (ID: 7b5a1a093d1c454c96c913367c7e60fe)
 *   - "Research Artifact - Workflow OS Enhanced" (ID: ee5b9ed70061402c99b091998f9002d8)
 *
 * WCAG 2.1 AA: shadcn-style tab semantics; focusable action buttons with
 * aria-disabled; copy button with aria-live announcement.
 */

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { LensBadgeSet } from "@/components/workflow/lens-badge-set";
import { TypeBadge } from "@/components/ui/type-badge";
import { WorkspaceBadge } from "@/components/ui/workspace-badge";
import { HandoffChain } from "@/components/artifact/HandoffChain";
import { WorkflowOSTab } from "@/components/workflow/workflow-os-tab";
import { useArtifact } from "@/hooks/useArtifact";
import { ArtifactFreshnessBadge } from "@/components/artifact/freshness-badge";
import { ContradictionFlag } from "@/components/artifact/contradiction-flag";

// ---------------------------------------------------------------------------
// Tab definition
// ---------------------------------------------------------------------------

const TABS = ["Source", "Knowledge", "Draft", "Workflow OS"] as const;
type TabId = (typeof TABS)[number];

function tabPanelId(tab: TabId) {
  return `artifact-tab-panel-${tab.toLowerCase().replace(/\s+/g, "-")}`;
}
function tabButtonId(tab: TabId) {
  return `artifact-tab-btn-${tab.toLowerCase().replace(/\s+/g, "-")}`;
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function DetailSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading artifact"
      className="flex flex-col gap-4 animate-pulse"
    >
      {/* Breadcrumb */}
      <div className="h-3.5 w-32 rounded bg-muted" />
      {/* Badge row */}
      <div className="flex gap-2">
        <div className="h-5 w-16 rounded-sm bg-muted" />
        <div className="h-5 w-12 rounded-sm bg-muted" />
      </div>
      {/* Title */}
      <div className="h-7 w-2/3 rounded bg-muted" />
      {/* Action buttons — 5 distinct static widths */}
      <div className="flex gap-2">
        <div className="h-8 w-20 rounded-md bg-muted" />
        <div className="h-8 w-16 rounded-md bg-muted" />
        <div className="h-8 w-20 rounded-md bg-muted" />
        <div className="h-8 w-28 rounded-md bg-muted" />
        <div className="h-8 w-24 rounded-md bg-muted" />
      </div>
      {/* Tab bar */}
      <div className="flex gap-4 border-b pb-px">
        {TABS.map((t) => (
          <div key={t} className="h-4 w-16 rounded bg-muted" />
        ))}
      </div>
      {/* Content */}
      <div className="flex gap-4">
        <div className="h-48 flex-1 rounded-md bg-muted" />
        <div className="hidden h-48 w-60 rounded-md bg-muted lg:block" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error states
// ---------------------------------------------------------------------------

function NotFoundState({ id }: { id: string }) {
  return (
    <div className="flex flex-col gap-4">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-sm text-muted-foreground"
      >
        <Link
          href="/library"
          className="hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          Library
        </Link>
        <span aria-hidden="true">/</span>
        <span>Not found</span>
      </nav>
      <div
        role="alert"
        className="rounded-md border border-destructive/30 bg-destructive/5 px-6 py-8 text-center"
      >
        <p className="text-sm font-semibold text-destructive">Artifact not found</p>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{id}</p>
        <p className="mt-3 text-xs text-muted-foreground">
          This artifact may have been deleted or the ID is incorrect.
        </p>
        <Link
          href="/library"
          className={cn(
            "mt-4 inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium",
            "transition-colors hover:bg-accent hover:text-accent-foreground",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          Back to Library
        </Link>
      </div>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/30 bg-destructive/5 px-6 py-8 text-center"
    >
      <p className="text-sm font-semibold text-destructive">Failed to load artifact</p>
      <p className="mt-1 text-xs text-muted-foreground">{error.message}</p>
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          "mt-4 inline-flex h-8 items-center rounded-md border border-destructive/40 px-3 text-xs font-medium text-destructive",
          "transition-colors hover:bg-destructive/10",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        Try again
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Source Reader — raw markdown / text
// ---------------------------------------------------------------------------

function SourceReader({ content }: { content: string | null | undefined }) {
  if (!content) {
    return (
      <div
        role="status"
        className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed py-12 text-center"
      >
        <p className="text-sm text-muted-foreground">No source content available.</p>
        <p className="text-xs text-muted-foreground/60">
          Source content is populated after the first vault read.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-md border bg-muted/30">
      <pre className="whitespace-pre-wrap break-words p-4 font-mono text-sm leading-relaxed text-foreground/80">
        <code>{content}</code>
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Knowledge Reader — compiled HTML output
// ---------------------------------------------------------------------------

function KnowledgeReader({ content }: { content: string | null | undefined }) {
  if (!content) {
    return (
      <div
        role="status"
        className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed py-12 text-center"
      >
        <p className="text-sm text-muted-foreground">No compiled content yet.</p>
        <p className="text-xs text-muted-foreground/60">
          Run Compile to generate the knowledge reader output.
        </p>
      </div>
    );
  }

  // Detect if content looks like HTML (starts with <) or plain text/markdown.
  // If HTML, render with dangerouslySetInnerHTML (Portal is local-only auth).
  // If plain text, fall back to pre block.
  const isHtml = content.trimStart().startsWith("<");

  if (isHtml) {
    return (
      <div
        className={cn(
          "rounded-md border bg-card p-6",
          "[&_h1]:mb-4 [&_h1]:text-2xl [&_h1]:font-bold",
          "[&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold",
          "[&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold",
          "[&_p]:mb-3 [&_p]:text-sm [&_p]:leading-relaxed",
          "[&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-sm",
          "[&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:text-sm",
          "[&_li]:mb-1",
          "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs",
          "[&_pre]:overflow-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-4 [&_pre]:text-xs",
          "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground",
          "[&_a]:text-primary [&_a]:underline-offset-2 [&_a]:hover:underline",
          "[&_hr]:border-border",
          "[&_table]:w-full [&_table]:text-sm",
          "[&_th]:border-b [&_th]:pb-2 [&_th]:text-left [&_th]:font-semibold",
          "[&_td]:border-b [&_td]:border-border/50 [&_td]:py-1.5",
        )}
        // Portal is local-only with bearer-token auth — HTML is from the engine.
        // Add DOMPurify here before enabling PORTAL_ALLOW_NETWORK=1.
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  // Plain text / markdown fallback
  return (
    <div className="overflow-auto rounded-md border bg-muted/30">
      <pre className="whitespace-pre-wrap break-words p-4 font-mono text-sm leading-relaxed text-foreground/80">
        {content}
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Draft Reader — synthesis/draft content
// ---------------------------------------------------------------------------

function DraftReader({ content }: { content: string | null | undefined }) {
  if (!content) {
    return (
      <div
        role="status"
        className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed py-12 text-center"
      >
        <svg
          aria-hidden="true"
          className="size-8 text-muted-foreground/40"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.25}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <div>
          <p className="text-sm font-medium text-foreground">No draft content</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Draft content appears here for synthesis and staged artifacts.
          </p>
        </div>
      </div>
    );
  }

  const isHtml = content.trimStart().startsWith("<");

  // DP3-02 #7: Draft prose wrapper uses same full typography ruleset as
  // KnowledgeReader to avoid density drift between readers.
  if (isHtml) {
    return (
      <div
        className={cn(
          "rounded-md border bg-card p-6",
          "[&_h1]:mb-4 [&_h1]:text-2xl [&_h1]:font-bold",
          "[&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold",
          "[&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold",
          "[&_p]:mb-3 [&_p]:text-sm [&_p]:leading-relaxed",
          "[&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-sm",
          "[&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:text-sm",
          "[&_li]:mb-1",
          "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs",
          "[&_pre]:overflow-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-4 [&_pre]:text-xs",
          "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground",
          "[&_a]:text-primary [&_a]:underline-offset-2 [&_a]:hover:underline",
          "[&_hr]:border-border",
          "[&_table]:w-full [&_table]:text-sm",
          "[&_th]:border-b [&_th]:pb-2 [&_th]:text-left [&_th]:font-semibold",
          "[&_td]:border-b [&_td]:border-border/50 [&_td]:py-1.5",
        )}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  return (
    <div className="overflow-auto rounded-md border bg-muted/30">
      <pre className="whitespace-pre-wrap break-words p-4 font-mono text-sm leading-relaxed text-foreground/80">
        {content}
      </pre>
    </div>
  );
}

// WorkflowOSPlaceholder removed — replaced by WorkflowOSTab (P4-10).

// ---------------------------------------------------------------------------
// Action buttons definition
// ---------------------------------------------------------------------------

interface ActionButton {
  label: string;
  ariaLabel: string;
  /** True when the backend endpoint exists (promote/link/review). */
  hasEndpoint: boolean;
  description: string;
}

const ACTION_BUTTONS: ActionButton[] = [
  {
    label: "Promote",
    ariaLabel: "Promote artifact lifecycle stage",
    hasEndpoint: true,
    description: "POST /api/artifacts/:id/promote — wired in a future P3 task",
  },
  {
    label: "Link",
    ariaLabel: "Link artifact to another artifact",
    hasEndpoint: true,
    description: "POST /api/artifacts/:id/link — wired in a future P3 task",
  },
  {
    label: "Review",
    ariaLabel: "Add artifact to review queue",
    hasEndpoint: true,
    description: "POST /api/artifacts/:id/review — wired in a future P3 task",
  },
  {
    label: "Compile Now",
    ariaLabel: "Trigger compilation workflow",
    hasEndpoint: false,
    description: "Engine trigger — wired in P3-07",
  },
  {
    label: "Lint Scope",
    ariaLabel: "Trigger lint workflow on this artifact scope",
    hasEndpoint: false,
    description: "Engine trigger — wired in P3-07",
  },
];

// ---------------------------------------------------------------------------
// Copy-to-clipboard button
// ---------------------------------------------------------------------------

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (insecure context)
    }
  }, [value]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "Copied to clipboard" : "Copy ID to clipboard"}
      title={copied ? "Copied!" : "Copy ID"}
      className={cn(
        "ml-1 inline-flex h-4 w-4 items-center justify-center rounded text-[10px]",
        "text-muted-foreground transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
      )}
    >
      {copied ? (
        <svg
          aria-hidden="true"
          className="size-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="m5 13 4 4L19 7" />
        </svg>
      ) : (
        <svg
          aria-hidden="true"
          className="size-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-2M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
      )}
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied" : ""}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ArtifactDetailClientProps {
  id: string;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ArtifactDetailClient({ id }: ArtifactDetailClientProps) {
  const [activeTab, setActiveTab] = useState<TabId>("Source");
  const { artifact, isLoading, isError, error, isNotFound, refetch } =
    useArtifact(id);

  // ---- Loading state ----
  if (isLoading) {
    return <DetailSkeleton />;
  }

  // ---- Error states ----
  if (isNotFound) {
    return <NotFoundState id={id} />;
  }

  if (isError && error) {
    return <ErrorState error={error} onRetry={refetch} />;
  }

  // Guard: artifact may still be undefined if query is disabled
  if (!artifact) {
    return <DetailSkeleton />;
  }

  const tags = Array.isArray(artifact.frontmatter_jsonb?.["tags"])
    ? (artifact.frontmatter_jsonb["tags"] as string[])
    : [];

  return (
    <div className="flex flex-col gap-4">
      {/* ------------------------------------------------------------------ */}
      {/* Breadcrumbs                                                         */}
      {/* ------------------------------------------------------------------ */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-sm text-muted-foreground"
      >
        <Link
          href="/library"
          className="hover:text-foreground rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Library
        </Link>
        <span aria-hidden="true">/</span>
        <span className="max-w-[240px] truncate text-foreground">
          {artifact.title}
        </span>
      </nav>

      {/* ------------------------------------------------------------------ */}
      {/* Artifact header                                                     */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-2">
        {/* Lens Badge Set — FULL variant, above the title per manifest §3.4 */}
        {/* DP3-02: badge row is tab-agnostic and does not re-mount on tab switch */}
        <LensBadgeSet artifact={artifact} variant="detail" />

        {/* Type / workspace / indicator badge row */}
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={artifact.type} />
          <WorkspaceBadge workspace={artifact.workspace} />
          {/* Freshness indicator from raw frontmatter fields (P4-04) */}
          <ArtifactFreshnessBadge
            freshness={artifact.frontmatter_jsonb?.["lens_freshness"] as string | null | undefined}
            staleAfter={artifact.frontmatter_jsonb?.["stale_after"] as string | null | undefined}
          />
          {/* Contradiction flag from edges endpoint (P4-04) */}
          <ContradictionFlag artifactId={artifact.id} />
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">{artifact.title}</h1>

        {/* Action buttons — all aria-disabled in v1; wired in later P3 tasks */}
        <div
          role="group"
          aria-label="Artifact actions"
          className="flex flex-wrap items-center gap-2"
        >
          {ACTION_BUTTONS.map(({ label, ariaLabel, description }) => (
            <button
              key={label}
              type="button"
              aria-label={ariaLabel}
              aria-disabled="true"
              title={description}
              className={cn(
                "inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium",
                "cursor-not-allowed text-muted-foreground opacity-60 transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Tab bar                                                             */}
      {/* DP3-02 #10: horizontal scroll on mobile; no line-wrap (tabs stay   */}
      {/* single-row at all breakpoints to preserve scan order invariant).   */}
      {/* ------------------------------------------------------------------ */}
      <div
        role="tablist"
        aria-label="Artifact readers"
        className="flex overflow-x-auto border-b scrollbar-none [-webkit-overflow-scrolling:touch]"
      >
        {TABS.map((tab) => (
          <button
            key={tab}
            id={tabButtonId(tab)}
            role="tab"
            type="button"
            aria-selected={tab === activeTab}
            aria-controls={tabPanelId(tab)}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              tab === activeTab
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Content area: reader + sidebar                                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex gap-6">
        {/* Main reader area */}
        <div className="min-w-0 flex-1">
          {/* Source tab */}
          <div
            id={tabPanelId("Source")}
            role="tabpanel"
            aria-labelledby={tabButtonId("Source")}
            hidden={activeTab !== "Source"}
          >
            <SourceReader content={artifact.raw_content} />
          </div>

          {/* Knowledge tab */}
          <div
            id={tabPanelId("Knowledge")}
            role="tabpanel"
            aria-labelledby={tabButtonId("Knowledge")}
            hidden={activeTab !== "Knowledge"}
          >
            <KnowledgeReader content={artifact.compiled_content} />
          </div>

          {/* Draft tab */}
          <div
            id={tabPanelId("Draft")}
            role="tabpanel"
            aria-labelledby={tabButtonId("Draft")}
            hidden={activeTab !== "Draft"}
          >
            <DraftReader content={artifact.draft_content} />
          </div>

          {/* Workflow OS tab */}
          <div
            id={tabPanelId("Workflow OS")}
            role="tabpanel"
            aria-labelledby={tabButtonId("Workflow OS")}
            hidden={activeTab !== "Workflow OS"}
          >
            <WorkflowOSTab
              artifact={artifact}
              enabled={activeTab === "Workflow OS"}
            />
          </div>
        </div>

        {/* Metadata sidebar — hidden on mobile, visible lg+ */}
        <aside
          aria-label="Artifact metadata"
          className="hidden w-64 shrink-0 flex-col gap-4 lg:flex"
        >
          {/* Details card */}
          <div className="rounded-md border p-3">
            <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Details
            </h3>
            <dl className="flex flex-col gap-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">ID</dt>
                <dd className="flex items-center">
                  <span className="truncate font-mono text-[11px] text-foreground/80">
                    {artifact.id}
                  </span>
                  <CopyButton value={artifact.id} />
                </dd>
              </div>

              <div>
                <dt className="text-xs text-muted-foreground">Status</dt>
                <dd className="text-xs font-medium capitalize">{artifact.status}</dd>
              </div>

              {artifact.created && (
                <div>
                  <dt className="text-xs text-muted-foreground">Created</dt>
                  <dd className="text-xs">
                    <time dateTime={artifact.created}>
                      {new Date(artifact.created).toLocaleString()}
                    </time>
                  </dd>
                </div>
              )}

              {artifact.updated && (
                <div>
                  <dt className="text-xs text-muted-foreground">Updated</dt>
                  <dd className="text-xs">
                    <time dateTime={artifact.updated}>
                      {new Date(artifact.updated).toLocaleString()}
                    </time>
                  </dd>
                </div>
              )}

              {artifact.slug && (
                <div>
                  <dt className="text-xs text-muted-foreground">Slug</dt>
                  <dd className="font-mono text-[11px] text-foreground/80">
                    {artifact.slug}
                  </dd>
                </div>
              )}

              {artifact.file_path && (
                <div>
                  <dt className="text-xs text-muted-foreground">File</dt>
                  <dd className="break-all font-mono text-[11px] text-foreground/60">
                    {artifact.file_path}
                  </dd>
                </div>
              )}

              {tags.length > 0 && (
                <div>
                  <dt className="text-xs text-muted-foreground">Tags</dt>
                  <dd className="flex flex-wrap gap-1 pt-0.5">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Lineage / Handoff Chain sidebar section (DP3-02 manifest §3.1) */}
          {/* Shown only when edges are present; hidden entirely when empty   */}
          {/* per manifest rule. Full lineage timeline (runs joined) deferred */}
          {/* to TODO-P2-01 (GET /api/artifacts/:id/lineage not yet shipped). */}
          {artifact.artifact_edges && artifact.artifact_edges.length > 0 && (
            <div className="rounded-md border p-3">
              <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Lineage
              </h3>
              <HandoffChain
                currentArtifactId={artifact.id}
                edges={artifact.artifact_edges}
              />
            </div>
          )}

          {/* Summary card */}
          {artifact.summary && (
            <div className="rounded-md border p-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Summary
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {artifact.summary}
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
