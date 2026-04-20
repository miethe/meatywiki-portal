/**
 * Blog API — typed wrappers for the blog/posts endpoints.
 *
 * Endpoints:
 *   POST   /api/blog/posts                 → 201 BlogPost
 *   GET    /api/blog/posts?status&limit&cursor → cursor-paginated list
 *   GET    /api/blog/posts/:id             → BlogPost detail
 *   PATCH  /api/blog/posts/:id             → 202 updated BlogPost
 *   POST   /api/blog/posts/:id/publish     → 200 updated BlogPost
 *   POST   /api/blog/posts/:id/archive     → 200 updated BlogPost
 *
 * All routes require Authorization: Bearer $MEATYWIKI_PORTAL_TOKEN.
 *
 * P1.5-3-03: Blog workspace screens
 */

import { apiFetch } from "./client";
import type { ServiceModeEnvelope } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type BlogPostStatus = "draft" | "compiled" | "published" | "archived";

export interface BlogPost {
  artifact_id: string;
  title: string;
  content: string | null;
  status: BlogPostStatus;
  created_at: string;
  updated_at: string;
  slug?: string | null;
  summary?: string | null;
  /** ID of the active workflow run for this post (present while running) */
  run_id?: string | null;
}

export interface CreateBlogPostRequest {
  title: string;
  content?: string;
}

export interface UpdateBlogPostRequest {
  title?: string;
  content?: string;
}

export interface BlogPostsParams {
  status?: BlogPostStatus | BlogPostStatus[];
  limit?: number;
  cursor?: string | null;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * Create a new blog post draft.
 * POST /api/blog/posts → 201 BlogPost
 */
export async function createBlogPost(body: CreateBlogPostRequest): Promise<BlogPost> {
  return apiFetch<BlogPost>("/blog/posts", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * List blog posts with optional status filter + cursor pagination.
 * GET /api/blog/posts → ServiceModeEnvelope<BlogPost>
 */
export async function listBlogPosts(
  params: BlogPostsParams = {},
): Promise<ServiceModeEnvelope<BlogPost>> {
  const { status, limit = 50, cursor } = params;

  const query = new URLSearchParams();

  if (status) {
    const statuses = Array.isArray(status) ? status : [status];
    for (const s of statuses) {
      if (s) query.append("status", s);
    }
  }
  query.set("limit", String(limit));
  if (cursor) query.set("cursor", cursor);

  const qs = query.toString();
  const path = `/blog/posts${qs ? `?${qs}` : ""}`;
  return apiFetch<ServiceModeEnvelope<BlogPost>>(path, { method: "GET" });
}

/**
 * Get a single blog post by ID.
 * GET /api/blog/posts/:id → BlogPost
 */
export async function getBlogPost(id: string): Promise<BlogPost> {
  return apiFetch<BlogPost>(`/blog/posts/${encodeURIComponent(id)}`, {
    method: "GET",
  });
}

/**
 * Update a blog post (title and/or content).
 * PATCH /api/blog/posts/:id → 202 BlogPost
 */
export async function updateBlogPost(
  id: string,
  body: UpdateBlogPostRequest,
): Promise<BlogPost> {
  return apiFetch<BlogPost>(`/blog/posts/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/**
 * Publish a blog post.
 * POST /api/blog/posts/:id/publish → 200 BlogPost
 */
export async function publishBlogPost(id: string): Promise<BlogPost> {
  return apiFetch<BlogPost>(
    `/blog/posts/${encodeURIComponent(id)}/publish`,
    { method: "POST" },
  );
}

/**
 * Archive a blog post.
 * POST /api/blog/posts/:id/archive → 200 BlogPost
 */
export async function archiveBlogPost(id: string): Promise<BlogPost> {
  return apiFetch<BlogPost>(
    `/blog/posts/${encodeURIComponent(id)}/archive`,
    { method: "POST" },
  );
}
