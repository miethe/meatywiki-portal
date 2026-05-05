/**
 * Decisions — list of Decision Framework tables.
 *
 * Server component: fetches tables SSR, passes to DecisionsListClient for
 * interactive create / delete. Follows the Inbox/Projects pattern.
 *
 * URL: /decisions
 * P2-5-03: Decision Framework interactive table UI.
 */

import { listDecisionTables } from "@/lib/api/decisions";
import type { DecisionTablesEnvelope } from "@/lib/api/decisions";
import { DecisionsListClient } from "./DecisionsListClient";

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function DecisionsError({ message }: { message: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Decisions</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Decision Framework tables
        </p>
      </div>
      <div
        role="alert"
        className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-6 text-center"
      >
        <p className="text-sm font-medium text-destructive">
          Could not load decision tables
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{message}</p>
        <p className="mt-3 text-xs text-muted-foreground">
          Refresh the page or check that the backend is running.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function DecisionsPage() {
  let initialData: DecisionTablesEnvelope;
  let fetchError: string | null = null;

  try {
    initialData = await listDecisionTables(50);
  } catch (err) {
    fetchError =
      err instanceof Error
        ? err.message
        : "Unexpected error fetching decision tables";
    initialData = { data: [], cursor: null };
  }

  if (fetchError) {
    return <DecisionsError message={fetchError} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <DecisionsListClient initialData={initialData} />
    </div>
  );
}
