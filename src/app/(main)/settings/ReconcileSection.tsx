"use client";

/**
 * ReconcileSection — client island that renders the Reconciler settings row
 * and owns the ReconcileModal open/close state.
 *
 * Imported by the server-component settings page (page.tsx) so that the
 * modal state does not require the whole page to be a client component.
 *
 * P4-FE-010: vault drift check modal.
 */

import { useState, useCallback } from "react";
import { ReconcileModal } from "@/components/settings/ReconcileModal";

export function ReconcileSection() {
  const [open, setOpen] = useState(false);

  const handleOpen = useCallback(() => setOpen(true), []);
  const handleOpenChange = useCallback((v: boolean) => setOpen(v), []);

  return (
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
              Inspect drift between the vault and Postgres overlay, then
              optionally apply changes (
              <code className="text-xs">POST /api/vault/reconcile-check</code>)
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpen}
            className="inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Check drift
          </button>
        </div>
      </div>

      <ReconcileModal open={open} onOpenChange={handleOpenChange} />
    </section>
  );
}
