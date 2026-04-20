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
 * Stitch reference: "System Settings & Configuration" (ID: 5fbbc5d4b18748c084f251638932b513)
 * Shell: Standard Archival
 */

import Link from "next/link";

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
            <button
              type="button"
              disabled
              title="Token rotation implemented in P4"
              className="inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium text-muted-foreground disabled:opacity-50"
            >
              Rotate token
            </button>
          </div>
        </div>
      </section>

      {/* Reconciler section */}
      <section aria-labelledby="settings-reconciler-heading">
        <h2
          id="settings-reconciler-heading"
          className="mb-3 text-base font-semibold"
        >
          Reconciler
        </h2>
        <div className="rounded-md border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Vault reconciliation</p>
              <p className="text-xs text-muted-foreground">
                Sync Postgres overlay with vault (
                <code className="text-xs">POST /api/admin/reconcile</code>)
              </p>
            </div>
            <button
              type="button"
              disabled
              title="Reconcile trigger implemented in P4"
              className="inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium text-muted-foreground disabled:opacity-50"
            >
              Run reconcile
            </button>
          </div>
        </div>
      </section>

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
    </div>
  );
}
