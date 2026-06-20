/**
 * System Settings & Configuration — scaffold.
 *
 * Satisfies PRD FR-14: token rotation, reconcile trigger, health view.
 * P4 wires:
 *   - POST /api/admin/reconcile
 *   - GET /api/admin/health
 *   - Token rotation UI
 *
 * P1.5-2-05: Added Workflow Templates section linking to /settings/workflow-templates.
 *
 * DP3-04 §2.12: cosmetic fixes applied.
 *   - #2 Token rotation button: tooltip updated (no v1 API contract).
 *   - #3 Reconcile button: tooltip clarified (P4 stub, accept-code-canonical).
 *
 * FE-05: Inbox Directory config section (client island).
 * FE-07: Auto-compile toggle (client island).
 * P4-FE-010: ReconcileModal — live vault drift check dialog.
 *
 * Stitch reference: "System Settings & Configuration" (ID: 5fbbc5d4b18748c084f251638932b513)
 * Shell: Standard Archival
 */

import Link from "next/link";
import { SettingsConfigClient } from "./settings-config-client";
import { ReconcileSection } from "./ReconcileSection";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          System configuration and health
        </p>
      </div>

      {/* Auth section */}
      <section aria-labelledby="settings-auth-heading">
        <h2
          id="settings-auth-heading"
          className="mb-3 text-base font-semibold"
        >
          Authentication
        </h2>
        <div className="rounded-md border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Portal token</p>
              <p className="text-xs text-muted-foreground">
                Single local bearer token (local-only auth)
              </p>
            </div>
            {/* DP3-04 §2.12#2: no token rotation API in v1 contract (v1.5 addition). */}
            <button
              type="button"
              disabled
              title="Token rotation not available in v1 — no API contract yet (v1.5)"
              aria-disabled="true"
              className="inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              Rotate token
            </button>
          </div>
        </div>
      </section>

      {/* Reconciler section — P4-FE-010: live drift check modal */}
      <ReconcileSection />

      {/* Health section */}
      <section aria-labelledby="settings-health-heading">
        <h2
          id="settings-health-heading"
          className="mb-3 text-base font-semibold"
        >
          Health
        </h2>
        <div className="rounded-md border p-4">
          <p className="text-sm text-muted-foreground">
            Health check view (<code className="text-xs">GET /api/admin/health</code>)
            — implemented in P4.
          </p>
        </div>
      </section>

      {/* FE-05 + FE-07: Config sections (client island) */}
      <SettingsConfigClient />

      {/* Workflow Templates section */}
      <section aria-labelledby="settings-templates-heading">
        <h2
          id="settings-templates-heading"
          className="mb-3 text-base font-semibold"
        >
          Workflow Templates
        </h2>
        <div className="rounded-md border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Manage templates</p>
              <p className="text-xs text-muted-foreground">
                View system templates and create, edit, or delete custom workflow templates.
              </p>
            </div>
            <Link
              href="/settings/workflow-templates"
              className="inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Manage
            </Link>
          </div>
        </div>
      </section>

      {/* Project Directories section */}
      <section aria-labelledby="settings-project-dirs-heading">
        <h2
          id="settings-project-dirs-heading"
          className="mb-3 text-base font-semibold"
        >
          Project Directories
        </h2>
        <div className="rounded-md border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Cross-project knowledge hub</p>
              <p className="text-xs text-muted-foreground">
                Register local project directories for the cross-project
                knowledge connector. Synced artifacts are ingested into the
                vault automatically.
              </p>
            </div>
            <Link
              href="/settings/projects"
              className="inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Manage
            </Link>
          </div>
        </div>
      </section>

      {/* LLM Settings section — portal-llm-settings-frontend FE-P3 */}
      <section aria-labelledby="settings-llm-heading">
        <h2
          id="settings-llm-heading"
          className="mb-3 text-base font-semibold"
        >
          LLM Settings
        </h2>
        <div className="rounded-md border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Provider profiles &amp; model assignments</p>
              <p className="text-xs text-muted-foreground">
                Configure LLM provider profiles, per-purpose model assignments,
                provider credentials, and secret keys used by the engine.
              </p>
            </div>
            <Link
              href="/settings/llm"
              className="inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Manage
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
