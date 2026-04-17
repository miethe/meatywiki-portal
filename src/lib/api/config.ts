/**
 * Single source of truth for the Portal backend base URL.
 *
 * All modules that need the API base URL must import `getApiBase` from here.
 * Do NOT define a local DEFAULT_API_URL or local getApiBase() elsewhere.
 *
 * Base URL resolves to:
 *   - Server-side: process.env.MEATYWIKI_PORTAL_API_URL ?? DEFAULT_API_URL
 *   - Client-side: "/api" (proxied via next.config.mjs rewrite in dev)
 *
 * The default port (8765) matches the backend PORTAL_BIND_PORT default.
 */

export const DEFAULT_API_URL = "http://127.0.0.1:8765";

/**
 * Returns the base URL for the Portal backend API.
 *
 * Server-side: reads MEATYWIKI_PORTAL_API_URL, falling back to DEFAULT_API_URL.
 * Client-side: returns "/api" so Next.js rewrites handle proxying in dev and
 * avoid CORS issues.
 */
export function getApiBase(): string {
  if (typeof window === "undefined") {
    const host = process.env.MEATYWIKI_PORTAL_API_URL ?? DEFAULT_API_URL;
    return `${host.replace(/\/+$/, "")}/api`;
  }
  return "/api";
}
