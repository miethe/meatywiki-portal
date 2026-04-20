"use client";

/**
 * BlogEditorScreen — new post creation.
 *
 * Renders the BlogEditor in create mode (no existing post).
 *
 * P1.5-3-03: Blog workspace screens
 * Stitch reference: blog-editor.html (ID: e818bfb26a2b4c0dac09dbf10b0670af)
 */

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { BlogEditor } from "@/components/blog/blog-editor";

export default function NewBlogPostPage() {
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
        <span className="text-xs text-muted-foreground">New Post</span>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight">New Blog Post</h1>

      <BlogEditor />
    </div>
  );
}
