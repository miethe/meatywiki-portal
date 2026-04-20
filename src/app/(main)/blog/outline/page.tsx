"use client";

/**
 * BlogOutlineBuilderScreen — scope selection + outline generation.
 *
 * P1.5-3-03: Blog workspace screens
 * Stitch reference: blog-outline-builder.html (ID: 9107e33c0ca2490c90d9101f5816b8a8)
 */

import { BlogOutlineBuilder } from "@/components/blog/blog-outline-builder";

export default function BlogOutlinePage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Outline Builder</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Generate a structured outline from your research artifacts.
        </p>
      </div>

      <BlogOutlineBuilder />
    </div>
  );
}
