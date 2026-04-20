"use client";

/**
 * BlogArtifactDetailScreen — view a blog post with edit / archive / publish actions.
 *
 * Shows compiled_content (HTML) or raw_content (markdown) based on availability.
 * Provides Edit, Publish, and Archive action buttons.
 *
 * P1.5-3-03: Blog workspace screens
 * Stitch reference: blog-artifact-detail.html (ID: 6e662562eeb346a5a49bd9dab6696ef1)
 */

import { use, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Pencil, Archive, Globe, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBlogPost } from "@/hooks/useBlogPost";
import { publishBlogPost, archiveBlogPost } from "@/lib/api/blog";
import type { BlogPostStatus } from "@/lib/api/blog";

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

// ---------------------------------------------------------------------------
// Page params
// ---------------------------------------------------------------------------

interface BlogArtifactDetailPageProps {
  params: Promise<{ id: string }>;
}

// ---------------------------------------------------------------------------
// Detail content
// ---------------------------------------------------------------------------

function BlogDetailContent({ id }: { id: string }) {
  const { post, isLoading, isError, error } = useBlogPost(id);
  const queryClient = useQueryClient();
  const router = useRouter();

  const [isPublishing, setIsPublishing] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handlePublish = useCallback(async () => {
    setIsPublishing(true);
    setActionError(null);
    try {
      await publishBlogPost(id);
      await queryClient.invalidateQueries({ queryKey: ["blog"] });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setIsPublishing(false);
    }
  }, [id, queryClient]);

  const handleArchive = useCallback(async () => {
    setIsArchiving(true);
    setActionError(null);
    try {
      await archiveBlogPost(id);
      await queryClient.invalidateQueries({ queryKey: ["blog"] });
      router.push("/blog/posts");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Archive failed");
      setIsArchiving(false);
    }
  }, [id, queryClient, router]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="h-9 w-3/4 rounded bg-muted" />
        <div className="h-5 w-24 rounded-full bg-muted" />
        <div className="space-y-2">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className={cn("h-4 rounded bg-muted", i % 3 === 2 ? "w-2/3" : "w-full")} />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
      >
        <AlertCircle aria-hidden="true" className="size-4 shrink-0" />
        {error?.message ?? "Failed to load post"}
      </div>
    );
  }

  if (!post) return null;

  const {
    title,
    status,
    updated_at,
    created_at,
    summary,
    content,
  } = post;

  const isArchived = status === "archived";
  const isPublished = status === "published";
  const canPublish = status === "compiled" && !isPublished && !isArchived;
  const canArchive = !isArchived;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                STATUS_STYLES[status],
              )}
            >
              {STATUS_LABELS[status]}
            </span>
            <span className="text-xs text-muted-foreground">
              Updated{" "}
              <time dateTime={updated_at}>
                {new Date(updated_at).toLocaleDateString()}
              </time>
            </span>
            <span className="text-xs text-muted-foreground">
              Created{" "}
              <time dateTime={created_at}>
                {new Date(created_at).toLocaleDateString()}
              </time>
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {!isArchived && (
            <Link
              href={`/blog/posts/${id}/edit`}
              aria-label="Edit post"
              className={cn(
                "inline-flex min-h-[44px] items-center gap-1.5 rounded-md border px-3 text-sm font-medium sm:h-8 sm:min-h-0",
                "transition-colors hover:bg-accent hover:text-accent-foreground",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              )}
            >
              <Pencil aria-hidden="true" className="size-4" />
              Edit
            </Link>
          )}

          {canPublish && (
            <button
              type="button"
              onClick={() => void handlePublish()}
              disabled={isPublishing}
              aria-label="Publish post"
              className={cn(
                "inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 text-sm font-medium text-emerald-700 dark:text-emerald-300 sm:h-8 sm:min-h-0",
                "transition-colors hover:bg-emerald-500/20",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                "disabled:pointer-events-none disabled:opacity-50",
              )}
            >
              {isPublishing ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <Globe aria-hidden="true" className="size-4" />
              )}
              {isPublishing ? "Publishing…" : "Publish"}
            </button>
          )}

          {canArchive && (
            <button
              type="button"
              onClick={() => void handleArchive()}
              disabled={isArchiving}
              aria-label="Archive post"
              className={cn(
                "inline-flex min-h-[44px] items-center gap-1.5 rounded-md border px-3 text-sm font-medium text-muted-foreground sm:h-8 sm:min-h-0",
                "transition-colors hover:bg-accent/50 hover:text-foreground",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                "disabled:pointer-events-none disabled:opacity-50",
              )}
            >
              {isArchiving ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <Archive aria-hidden="true" className="size-4" />
              )}
              {isArchiving ? "Archiving…" : "Archive"}
            </button>
          )}
        </div>
      </div>

      {/* Action error */}
      {actionError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
        >
          <AlertCircle aria-hidden="true" className="size-3.5 shrink-0" />
          {actionError}
        </div>
      )}

      {/* Summary */}
      {summary && (
        <p className="rounded-md bg-muted/50 px-4 py-3 text-sm text-muted-foreground italic">
          {summary}
        </p>
      )}

      {/* Divider */}
      <hr className="border-border" />

      {/* Content — render raw markdown as plain preformatted text */}
      <article
        aria-label={`Blog post: ${title}`}
        className={cn(
          "prose prose-sm dark:prose-invert max-w-none",
          "text-foreground",
        )}
      >
        {content ? (
          <pre
            className={cn(
              "whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground",
              "p-0 bg-transparent border-0 m-0",
            )}
          >
            {content}
          </pre>
        ) : (
          <p className="text-muted-foreground italic">No content yet.</p>
        )}
      </article>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BlogArtifactDetailPage({
  params,
}: BlogArtifactDetailPageProps) {
  const { id } = use(params);

  return (
    <div className="flex flex-col gap-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link
          href="/blog/posts"
          aria-label="Back to blog posts"
          className={cn(
            "inline-flex items-center gap-1 text-xs text-muted-foreground",
            "hover:text-foreground transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          )}
        >
          <ChevronLeft aria-hidden="true" className="size-3.5" />
          Blog Posts
        </Link>
      </div>

      <BlogDetailContent id={id} />
    </div>
  );
}
