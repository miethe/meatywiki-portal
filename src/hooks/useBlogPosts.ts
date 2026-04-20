"use client";

/**
 * useBlogPosts — TanStack Query infinite-scroll hook for the Blog Workspace.
 *
 * Mirrors useResearchArtifacts/useLibraryArtifacts pattern.
 * Wraps GET /api/blog/posts with cursor-based pagination.
 *
 * P1.5-3-03: Blog workspace screens
 */

import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { listBlogPosts } from "@/lib/api/blog";
import type { BlogPost, BlogPostStatus } from "@/lib/api/blog";

const PAGE_SIZE = 50;

export interface BlogFilters {
  statuses: BlogPostStatus[];
}

export const DEFAULT_BLOG_FILTERS: BlogFilters = {
  statuses: [],
};

export interface UseBlogPostsResult {
  posts: BlogPost[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  isError: boolean;
  error: Error | null;
  total: number;
}

export function useBlogPosts(
  filters: BlogFilters = DEFAULT_BLOG_FILTERS,
): UseBlogPostsResult {
  const { statuses } = filters;

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError,
    error,
  } = useInfiniteQuery({
    queryKey: ["blog", "posts", { statuses }],
    queryFn: async ({ pageParam }) => {
      return listBlogPosts({
        status: statuses.length > 0 ? statuses : undefined,
        cursor: pageParam as string | null,
        limit: PAGE_SIZE,
      });
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.cursor ?? null,
  });

  const posts = useMemo<BlogPost[]>(() => {
    if (!data) return [];
    return data.pages.flatMap((page) => page.data);
  }, [data]);

  return {
    posts,
    isLoading,
    isFetchingNextPage,
    hasNextPage: hasNextPage ?? false,
    fetchNextPage,
    isError,
    error: error as Error | null,
    total: posts.length,
  };
}
