/**
 * Client-side feature flags resolved from NEXT_PUBLIC_* environment variables.
 *
 * This module is the SINGLE source of truth for all NEXT_PUBLIC_* feature flags.
 * Never read process.env.NEXT_PUBLIC_* directly in other modules; import from here.
 *
 * Portal v1.7 Phase 3 (P3-05).
 */

/**
 * When true, operator controls (pause / resume / cancel) are rendered in the
 * Workflow Viewer (Screen B). Requires PORTAL_ENABLE_OPERATOR_CONTROL=1 on
 * the backend as well, or action endpoints will return 404.
 *
 * Default: false (absent from DOM, not merely disabled).
 */
export const OPERATOR_CONTROL_ENABLED =
  process.env.NEXT_PUBLIC_PORTAL_ENABLE_OPERATOR_CONTROL === "1";

/**
 * When true, the Stories views never render the "details hidden (held)" state:
 * every op-story is shown in full regardless of its sensitivity.level. Pair
 * with the backend's PORTAL_STORIES_DISABLE_REDACTION flag (which surfaces the
 * source refs). Intended for single-user, trusted-LAN deployments (e.g. a
 * personal NUC node) where redacting your own AARs adds no value.
 *
 * Default: false (held rows stay redacted, matching the OQ-4 safety rule).
 */
export const STORIES_REDACTION_DISABLED =
  process.env.NEXT_PUBLIC_PORTAL_STORIES_DISABLE_REDACTION === "1";
