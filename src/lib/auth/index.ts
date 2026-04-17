/**
 * Auth module barrel.
 * Re-exports the public surface of src/lib/auth/ for convenient importing.
 *
 * Server-only: all exports here touch cookies or Node.js APIs.
 */

export { getSession, isAuthenticated } from "./session";
export type { Session } from "./session";
export { validateTokenWithBackend } from "./validate";
export type { ValidationResult } from "./validate";
export {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_MAX_AGE,
  sessionCookieAttributes,
  isProduction,
} from "./cookies";
