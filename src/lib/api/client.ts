/**
 * HTTP client for the MeatyWiki Portal backend (Service-Mode v2).
 *
 * Responsibilities:
 * - Attaches Authorization: Bearer header from environment/cookie
 * - Handles ETag caching headers
 * - Provides typed wrappers for fetch (to be expanded in P3-01..P3-07)
 *
 * Base URL resolves to:
 *   - Server-side: process.env.MEATYWIKI_PORTAL_API_URL (required in production)
 *   - Client-side: /api (proxied via next.config.mjs rewrite in dev)
 *
 * INVARIANT: This module never imports from the meatywiki Python package.
 * All backend communication is HTTP only.
 */

export { getApiBase, DEFAULT_API_URL } from "@/lib/api/config";
import { getApiBase } from "@/lib/api/config";

export type ApiRequestInit = RequestInit & {
  /** Skip prepending the API base (for absolute URLs). */
  absoluteUrl?: boolean;
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message?: string,
  ) {
    super(message ?? `API error ${status}`);
    this.name = "ApiError";
  }
}

/**
 * Core fetch wrapper. Attaches the bearer token when running server-side.
 *
 * Token resolution order (server-side only):
 *   1. HttpOnly `portal_session` cookie (set by POST /api/auth/session at login)
 *   2. `MEATYWIKI_PORTAL_TOKEN` environment variable (CI / scripted access)
 *
 * Client-side requests rely on the browser automatically sending the HttpOnly
 * cookie; no explicit Authorization header is added client-side.
 */
export async function apiFetch<T = unknown>(
  path: string,
  init: ApiRequestInit = {},
): Promise<T> {
  const { absoluteUrl, ...fetchInit } = init;
  const url = absoluteUrl ? path : `${getApiBase()}${path}`;

  const headers = new Headers(fetchInit.headers);

  // Server-side: resolve bearer token from cookie then env fallback
  if (typeof window === "undefined") {
    // Dynamically import next/headers to avoid pulling it into client bundles.
    // This import is safe here because apiFetch is only called on the server
    // when window is undefined.
    try {
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      const sessionCookie = cookieStore.get("portal_session");
      if (sessionCookie?.value) {
        headers.set("Authorization", `Bearer ${sessionCookie.value}`);
      } else {
        // Fallback: env variable (useful in tests / CI)
        const envToken = process.env.MEATYWIKI_PORTAL_TOKEN;
        if (envToken) {
          headers.set("Authorization", `Bearer ${envToken}`);
        }
      }
    } catch {
      // next/headers is unavailable outside of a request context (e.g. during
      // static generation with no incoming request). Fall back to env token.
      const envToken = process.env.MEATYWIKI_PORTAL_TOKEN;
      if (envToken) {
        headers.set("Authorization", `Bearer ${envToken}`);
      }
    }
  }

  headers.set("Content-Type", "application/json");

  const response = await fetch(url, { ...fetchInit, headers });

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = await response.text();
    }
    throw new ApiError(response.status, body);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

/**
 * Typed convenience methods — stubs to be expanded per-task.
 * Full implementations land in P3-03 (artifacts), P3-07 (workflows).
 */
export const api = {
  get: <T>(path: string, init?: ApiRequestInit) =>
    apiFetch<T>(path, { ...init, method: "GET" }),

  post: <T>(path: string, body: unknown, init?: ApiRequestInit) =>
    apiFetch<T>(path, {
      ...init,
      method: "POST",
      body: JSON.stringify(body),
    }),

  patch: <T>(path: string, body: unknown, init?: ApiRequestInit) =>
    apiFetch<T>(path, {
      ...init,
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  delete: <T>(path: string, init?: ApiRequestInit) =>
    apiFetch<T>(path, { ...init, method: "DELETE" }),
};
