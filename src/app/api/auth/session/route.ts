/**
 * POST /api/auth/session
 *
 * Login endpoint: receives a candidate bearer token, validates it against the
 * backend Portal API, and on success sets an HttpOnly session cookie.
 *
 * DELETE /api/auth/session
 *
 * Logout endpoint: clears the session cookie.
 *
 * INVARIANT: The token is stored only in an HttpOnly cookie — never returned
 * to the client in the response body.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  isProduction,
  sessionCookieAttributes,
} from "@/lib/auth/cookies";
import { validateTokenWithBackend } from "@/lib/auth/validate";

// ---------------------------------------------------------------------------
// POST — login
// ---------------------------------------------------------------------------

interface LoginRequestBody {
  token: string;
}

export async function POST(request: Request): Promise<Response> {
  let body: LoginRequestBody;

  try {
    body = (await request.json()) as LoginRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { token } = body;

  if (typeof token !== "string" || token.trim().length === 0) {
    return NextResponse.json(
      { error: "token is required and must be a non-empty string" },
      { status: 400 },
    );
  }

  const result = await validateTokenWithBackend(token.trim());

  if (!result.valid) {
    return NextResponse.json(
      { error: result.reason ?? "Authentication failed" },
      { status: 401 },
    );
  }

  // Set the HttpOnly session cookie
  const cookieStore = await cookies();
  cookieStore.set(
    SESSION_COOKIE_NAME,
    token.trim(),
    sessionCookieAttributes(isProduction()),
  );

  return NextResponse.json({ ok: true }, { status: 200 });
}

// ---------------------------------------------------------------------------
// DELETE — logout
// ---------------------------------------------------------------------------

export async function DELETE(): Promise<Response> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);

  return NextResponse.json({ ok: true }, { status: 200 });
}
