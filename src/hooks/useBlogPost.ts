"use client";

/**
 * useBlogPost — TanStack Query hook for a single blog post.
 *
 * Wraps GET /api/blog/posts/:id and returns the post with
 * loading / error states for the editor and detail screens.
 *
 * P1.5-3-03: Blog workspace screens
 */

import { useQuery } from "@tanstack/react-query";
import { getBlogPost } from "@/lib/api/blog";
import type { BlogPost } from "@/lib/api/blog";

export interface UseBlogPostResult {
  post: BlogPost | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

export function useBlogPost(id: string): UseBlogPostResult {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["blog", "post", id],
    queryFn: () => getBlogPost(id),
    enabled: !!id,
  });

  return {
    post: data,
    isLoading,
    isError,
    error: error as Error | null,
  };
}
