/**
 * Next.js Edge Middleware — route guards.
 *
 * Rules:
 * - Unauthenticated requests to (main) routes → redirect to /login
 * - Authenticated requests to (auth) routes  → redirect to /
 *
 * "Authenticated" is determined solely by the presence of a non-empty
 * `portal_session` HttpOnly cookie. Full token validation happens at
 * login time (POST /api/auth/session); middleware trusts cookie presence.
 *
 * Auth-disabled mode (PORTAL_DISABLE_AUTH=1):
 * - The unauthenticated→/login redirect is skipped entirely; all main-route
 *   requests pass through without a session cookie.
 * - The authenticated→/ redirect for auth routes is also skipped so that
 *   /login remains directly reachable (no redirect loop).
 * - Mirrors the same flag check used in src/lib/auth/validate.ts.
 *
 * EDGE RUNTIME NOTE: Next.js Edge middleware does NOT read process.env at
 * runtime the way Node.js route handlers do. The reference to
 * `process.env.PORTAL_DISABLE_AUTH` below is INLINED AT BUILD TIME by the
 * Next.js bundler. The flag must be present in the environment (e.g. via
 * .env.local) when `pnpm build` runs. A rebuild is required for any change
 * to this flag to take effect in middleware.
 *
 * Matcher excludes:
 * - /api/* routes (handled by route handlers)
 * - /_next/* (Next.js internals)
 * - Static files with extensions (.ico, .png, etc.)
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookies";

/**
 * Build-time constant: true when PORTAL_DISABLE_AUTH=1 was set in the
 * environment during `pnpm build`. Inlined by the Edge bundler; a rebuild
 * is required for changes to take effect.
 */
const AUTH_DISABLED = process.env.PORTAL_DISABLE_AUTH === "1";

/** Routes that require authentication (pattern prefix). */
const MAIN_ROUTES = [
  "/home",
  "/inbox",
  "/library",
  "/artifact",
  "/workflows",
  // Root redirect is also protected
  "/",
];

/** Routes that are only accessible when unauthenticated. */
const AUTH_ROUTES = ["/login", "/register"];

function isMainRoute(pathname: string): boolean {
  if (pathname === "/") return true;
  return MAIN_ROUTES.some(
    (route) => route !== "/" && pathname.startsWith(route),
  );
}

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((route) => pathname.startsWith(route));
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // When auth is disabled the entire session-cookie gate is bypassed.
  // All main-route requests pass through; /login stays reachable.
  if (AUTH_DISABLED) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
  const isLoggedIn = Boolean(sessionCookie?.value);

  // Unauthenticated user trying to access protected routes → /login
  if (isMainRoute(pathname) && !isLoggedIn) {
    const loginUrl = new URL("/login", request.url);
    // Preserve the intended destination for post-login redirect
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated user trying to access auth routes → /
  if (isAuthRoute(pathname) && isLoggedIn) {
    const homeUrl = new URL("/", request.url);
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static  (static files)
     * - _next/image   (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt, and other static files
     * - /api routes   (handled by route handlers, not middleware guards)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$|api/).*)",
  ],
};
