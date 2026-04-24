"use client";

/**
 * @deprecated ArtifactBody is retired as of PU6-04 (unified-content-viewer-v1 Phase 6).
 *
 * New callers: import ArticleViewer from '@miethe/ui' directly and pass
 * variant="editorial", format="auto", sanitize={true}.
 *
 * This thin wrapper exists only for any residual import paths that have not yet
 * been migrated. It re-exports ArticleViewer with sensible defaults that match
 * the old ArtifactBody behaviour. It carries no DOMPurify / isomorphic-dompurify
 * dependency — sanitization is now handled internally by ArticleViewer via
 * rehype-sanitize.
 *
 * Empty-state copy is preserved from the original implementation so that
 * any callers that relied on variant-specific empty states still see the
 * correct message without changes.
 */

import { ArticleViewer } from "@miethe/ui";
import { cn } from "@/lib/utils";

interface ArtifactBodyProps {
  /** Raw HTML or plain markdown string from the API. */
  content: string | null | undefined;
  /** Controls which empty-state copy is shown. */
  variant?: "knowledge" | "draft";
  className?: string;
}

/** @deprecated Use ArticleViewer from '@miethe/ui' instead. */
export function ArtifactBody({ content, variant = "knowledge", className }: ArtifactBodyProps) {
  if (!content) {
    const label =
      variant === "draft" ? "No draft content" : "No compiled content yet.";
    const hint =
      variant === "draft"
        ? "Draft content appears here for synthesis and staged artifacts."
        : "Run Compile to generate the knowledge reader output.";
    return (
      <div
        role="status"
        className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed py-12 text-center"
      >
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-xs text-muted-foreground/60">{hint}</p>
      </div>
    );
  }

  return (
    <ArticleViewer
      content={content}
      format="auto"
      variant="editorial"
      frontmatter="hide"
      sanitize={true}
      generateHeadingIds={true}
      className={cn("rounded-md border bg-card p-6", className)}
    />
  );
}
