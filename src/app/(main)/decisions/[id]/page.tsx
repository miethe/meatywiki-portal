/**
 * Decision table detail page — server component wrapper.
 *
 * Fetches the table + rows SSR, passes to DecisionTableClient for
 * full interactive edit: inline text edits, weight sliders, add/delete rows,
 * save + reset.
 *
 * URL: /decisions/[id]
 * Breadcrumb: Research > Decisions > [Table Name]
 * P2-5-03: Decision Framework interactive table UI.
 */

import { notFound } from "next/navigation";
import { getDecisionTable } from "@/lib/api/decisions";
import { ApiError } from "@/lib/api/client";
import { DecisionTableClient } from "./DecisionTableClient";

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function TableError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-6 text-center"
    >
      <p className="text-sm font-medium text-destructive">
        Could not load decision table
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface Props {
  params: Promise<{ id: string }>;
}

export default async function DecisionTablePage({ params }: Props) {
  const { id } = await params;

  try {
    const table = await getDecisionTable(id);
    return <DecisionTableClient initialTable={table} />;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    const message =
      err instanceof Error ? err.message : "Unexpected error loading table";
    return <TableError message={message} />;
  }
}
