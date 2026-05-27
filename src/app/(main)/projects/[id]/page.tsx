"use client";

/**
 * Project detail page with sub-tabs — P5-FE-002.
 *
 * Fetches a single ContextPack from GET /api/projects/{id} and renders a
 * tabbed workspace with URL-synced tab state via ?view= query param.
 *
 * Tabs:
 *   overview   — name, description, created date, artifact count (read-only)
 *               + "Build Context Pack" CTA (P5-FE-006)
 *   resources  — placeholder; implemented by a separate agent
 *   milestones — placeholder; implemented by a separate agent
 *   decisions  — placeholder; implemented by a separate agent
 *
 * URL query param: ?view=overview|resources|milestones|decisions
 * Default tab: "overview"
 * Deep-linking: ?view=decisions navigates directly to the Decisions tab.
 * Back navigation: ← Projects header link returns to /projects.
 *
 * Patterns followed:
 *   - artifact/[id]/page.tsx — server component shell delegates to client island
 *   - ArtifactDetailClient — tab bar ARIA pattern (role="tablist", role="tab",
 *     role="tabpanel", hidden attribute, border-b-2 active indicator)
 *   - TanStack Query for data fetching (useQuery)
 *
 * WCAG 2.1 AA: tablist/tab/tabpanel semantics, focus-visible rings, labelled
 * nav for breadcrumb.
 */

import { use, useCallback, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  FolderKanban,
  Calendar,
  Package,
  FileText,
  AlertCircle,
  ChevronRight,
  BookOpen,
  Milestone,
  Scale,
  PackagePlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getContextPack } from "@/lib/api/projects";
import type { ContextPack } from "@/types/projects";
import { ResourcesTab } from "@/components/projects/ResourcesTab";
import { MilestonesTab } from "@/components/projects/MilestonesTab";
import { DecisionsTab } from "@/components/projects/DecisionsTab";
import { ContextPackBuilderDialog } from "@/components/projects/ContextPackBuilderDialog";

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

const TABS = ["overview", "resources", "milestones", "decisions"] as const;
type TabId = (typeof TABS)[number];

const TAB_LABELS: Record<TabId, string> = {
  overview: "Overview",
  resources: "Resources",
  milestones: "Milestones",
  decisions: "Decisions",
};

const TAB_ICONS: Record<TabId, React.ElementType> = {
  overview: BookOpen,
  resources: Package,
  milestones: Milestone,
  decisions: Scale,
};

function isValidTab(value: string | null): value is TabId {
  return TABS.includes(value as TabId);
}

function tabPanelId(tab: TabId) {
  return `project-tab-panel-${tab}`;
}
function tabButtonId(tab: TabId) {
  return `project-tab-btn-${tab}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading project">
      {/* Breadcrumb */}
      <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      {/* Title */}
      <div className="h-7 w-56 animate-pulse rounded bg-muted" />
      {/* Tab bar */}
      <div className="flex gap-1 border-b pb-px">
        {TABS.map((t) => (
          <div key={t} className="h-8 w-20 animate-pulse rounded bg-muted" />
        ))}
      </div>
      {/* Content */}
      <div className="space-y-3">
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
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
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link
          href="/projects"
          className="transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          Projects
        </Link>
        <ChevronRight aria-hidden="true" className="size-3.5" />
        <span>Not found</span>
      </nav>
      <div
        role="alert"
        className="rounded-md border border-destructive/30 bg-destructive/5 px-6 py-8 text-center"
      >
        <p className="text-sm font-semibold text-destructive">Project not found</p>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{id}</p>
        <p className="mt-3 text-xs text-muted-foreground">
          This project may have been deleted or the ID is incorrect.
        </p>
        <Link
          href="/projects"
          className={cn(
            "mt-4 inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium",
            "transition-colors hover:bg-accent hover:text-accent-foreground",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          Back to Projects
        </Link>
      </div>
    </div>
  );
}

function FetchErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/30 bg-destructive/5 px-6 py-8 text-center"
    >
      <AlertCircle aria-hidden="true" className="mx-auto mb-3 size-8 text-destructive" />
      <p className="text-sm font-semibold text-destructive">Failed to load project</p>
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
// Overview tab content
// ---------------------------------------------------------------------------

interface OverviewTabProps {
  pack: ContextPack;
  projectId: string;
}

function OverviewTab({ pack, projectId }: OverviewTabProps) {
  const [builderOpen, setBuilderOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      {/* Build Context Pack CTA */}
      <div className="flex items-center justify-between gap-4 rounded-lg border border-dashed bg-muted/20 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Context packs</p>
          <p className="text-xs text-muted-foreground">
            Bundle artifacts into a compiled context pack for this project.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setBuilderOpen(true)}
          className={cn(
            "inline-flex shrink-0 items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground",
            "transition-colors hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          )}
        >
          <PackagePlus aria-hidden="true" className="size-4" />
          Build context pack
        </button>
      </div>

      <ContextPackBuilderDialog
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        projectId={projectId}
      />

      {/* Summary stat cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-amber-50 dark:bg-amber-950/30">
            <Package aria-hidden="true" className="size-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Artifacts</p>
            <p className="text-lg font-semibold tabular-nums">{pack.artifact_count}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-50 dark:bg-blue-950/30">
            <Calendar aria-hidden="true" className="size-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Created</p>
            <p className="text-sm font-medium">{formatDate(pack.created_at)}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-purple-50 dark:bg-purple-950/30">
            <FileText aria-hidden="true" className="size-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Version</p>
            <p className="text-lg font-semibold tabular-nums">v{pack.version}</p>
          </div>
        </div>
      </div>

      {/* Description */}
      {pack.description ? (
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Description
          </h2>
          <p className="text-sm leading-relaxed text-foreground">{pack.description}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-4 text-center">
          <p className="text-xs text-muted-foreground">No description provided.</p>
        </div>
      )}

      {/* Metadata table */}
      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Details
          </h2>
        </div>
        <dl className="divide-y">
          <div className="flex items-center justify-between px-4 py-3">
            <dt className="text-xs font-medium text-muted-foreground">Pack ID</dt>
            <dd className="font-mono text-xs text-foreground">{pack.pack_id}</dd>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <dt className="text-xs font-medium text-muted-foreground">Created</dt>
            <dd className="text-xs text-foreground">{formatDate(pack.created_at)}</dd>
          </div>
          {pack.updated_at && (
            <div className="flex items-center justify-between px-4 py-3">
              <dt className="text-xs font-medium text-muted-foreground">Last updated</dt>
              <dd className="text-xs text-foreground">{formatDate(pack.updated_at)}</dd>
            </div>
          )}
          <div className="flex items-center justify-between px-4 py-3">
            <dt className="text-xs font-medium text-muted-foreground">Artifact count</dt>
            <dd className="text-xs text-foreground">{pack.artifact_count}</dd>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <dt className="text-xs font-medium text-muted-foreground">Version</dt>
            <dd className="text-xs text-foreground">{pack.version}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main detail client component
// ---------------------------------------------------------------------------

interface ProjectDetailClientProps {
  id: string;
}

function ProjectDetailClient({ id }: ProjectDetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Derive active tab from URL, defaulting to "overview"
  const rawView = searchParams.get("view");
  const activeTab: TabId = isValidTab(rawView) ? rawView : "overview";

  const { data: pack, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["projects", "detail", id],
    queryFn: () => getContextPack(id),
    staleTime: 30_000,
    retry: false,
  });

  // Sync tab to URL without adding to history stack on initial default
  const handleTabChange = useCallback(
    (tab: TabId) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "overview") {
        params.delete("view");
      } else {
        params.set("view", tab);
      }
      const qs = params.toString();
      router.replace(`/projects/${encodeURIComponent(id)}${qs ? `?${qs}` : ""}`, {
        scroll: false,
      });
    },
    [id, router, searchParams],
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="p-4 md:p-6">
        <PageSkeleton />
      </div>
    );
  }

  // 404 / generic error
  if (isError) {
    const err = error instanceof Error ? error : new Error(String(error));
    // Treat 404-ish errors as not-found
    const isNotFound = err.message.includes("404") || err.message.toLowerCase().includes("not found");
    if (isNotFound) {
      return (
        <div className="p-4 md:p-6">
          <NotFoundState id={id} />
        </div>
      );
    }
    return (
      <div className="p-4 md:p-6">
        <FetchErrorState error={err} onRetry={() => void refetch()} />
      </div>
    );
  }

  if (!pack) {
    return (
      <div className="p-4 md:p-6">
        <NotFoundState id={id} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      {/* Breadcrumb + back navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link
          href="/projects"
          className={cn(
            "inline-flex items-center gap-1 transition-colors hover:text-foreground",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded",
          )}
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          Projects
        </Link>
        <ChevronRight aria-hidden="true" className="size-3.5" />
        <span className="truncate max-w-[200px] text-foreground">{pack.name}</span>
      </nav>

      {/* Page header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-amber-50 dark:bg-amber-950/30">
          <FolderKanban aria-hidden="true" className="size-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight">{pack.name}</h1>
          {pack.description && (
            <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
              {pack.description}
            </p>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="sticky top-0 z-10 shrink-0 border-b bg-background">
        <div
          role="tablist"
          aria-label="Project sections"
          className="-mx-1 flex overflow-x-auto px-1 scrollbar-none [-webkit-overflow-scrolling:touch]"
        >
          {TABS.map((tab) => {
            const Icon = TAB_ICONS[tab];
            return (
              <button
                key={tab}
                id={tabButtonId(tab)}
                role="tab"
                type="button"
                aria-selected={tab === activeTab}
                aria-controls={tabPanelId(tab)}
                onClick={() => handleTabChange(tab)}
                className={cn(
                  "inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  tab === activeTab
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                <Icon aria-hidden="true" className="size-3.5" />
                {TAB_LABELS[tab]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab panels */}
      <div className="min-w-0">
        {/* Overview */}
        <div
          id={tabPanelId("overview")}
          role="tabpanel"
          aria-labelledby={tabButtonId("overview")}
          hidden={activeTab !== "overview"}
        >
          <OverviewTab pack={pack} projectId={id} />
        </div>

        {/* Resources */}
        <div
          id={tabPanelId("resources")}
          role="tabpanel"
          aria-labelledby={tabButtonId("resources")}
          hidden={activeTab !== "resources"}
        >
          <ResourcesTab projectId={id} />
        </div>

        {/* Milestones */}
        <div
          id={tabPanelId("milestones")}
          role="tabpanel"
          aria-labelledby={tabButtonId("milestones")}
          hidden={activeTab !== "milestones"}
        >
          <MilestonesTab projectId={id} />
        </div>

        {/* Decisions */}
        <div
          id={tabPanelId("decisions")}
          role="tabpanel"
          aria-labelledby={tabButtonId("decisions")}
          hidden={activeTab !== "decisions"}
        >
          <DecisionsTab projectId={id} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page — server component shell (Next.js 15 App Router pattern)
// ---------------------------------------------------------------------------

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ProjectDetailClient id={id} />;
}
