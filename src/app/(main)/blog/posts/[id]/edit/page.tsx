"use client";

/**
 * BlogEditorScreen — edit existing post.
 *
 * Fetches the post by ID and passes it to BlogEditor.
 *
 * P1.5-3-03: Blog workspace screens
 * Stitch reference: blog-editor.html (ID: e818bfb26a2b4c0dac09dbf10b0670af)
 */

import { use } from "react";
import Link from "next/link";
import { ChevronLeft, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { BlogEditor } from "@/components/blog/blog-editor";
import { useBlogPost } from "@/hooks/useBlogPost";

interface EditBlogPostPageProps {
  params: Promise<{ id: string }>;
}

function EditBlogPostContent({ id }: { id: string }) {
  const { post, isLoading, isError, error } = useBlogPost(id);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 animate-pulse">
        <div className="h-10 w-2/3 rounded bg-muted" />
        <div className="h-6 w-32 rounded bg-muted" />
        <div className="h-[400px] rounded bg-muted" />
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

  return <BlogEditor post={post} />;
}

export default function EditBlogPostPage({ params }: EditBlogPostPageProps) {
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
        <span aria-hidden="true" className="text-xs text-muted-foreground/50">/</span>
        <span className="text-xs text-muted-foreground">Edit</span>
      </div>

      <EditBlogPostContent id={id} />
    </div>
  );
}
