/**
 * Inbox screen — server component wrapper.
 *
 * Fetches the first page of inbox artifacts server-side (SSR), then passes
 * the result to InboxClient which handles all interactive state:
 * cursor-based load-more, Quick Add modal, loading/error states.
 *
 * On fetch error the screen renders a full-page error state rather than
 * throwing (preserves the app shell on transient backend failures).
 *
 * Stitch reference: "Inbox" screen (ID: 837a47df72a648749bafefd22988de7f)
 * Shell: Standard Archival (audit §2.1, OQ-I)
 *
 * P3-03: wired to GET /api/artifacts?workspace=inbox with cursor pagination.
 */

import { listArtifacts } from "@/lib/api/artifacts";
import { InboxClient } from "./InboxClient";
import type { ServiceModeEnvelope, ArtifactCard } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Server-side error state
// ---------------------------------------------------------------------------

function InboxError({ message }: { message: string }) {
  return (
    <div className="flex flex-col gap-4">
      {/* Header preserved so the page feels anchored */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Recently captured artifacts
        </p>
      </div>
      <div
        role="alert"
        className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-6 text-center"
      >
        <p className="text-sm font-medium text-destructive">
          Could not load inbox
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

export default async function InboxPage() {
  let initialData: ServiceModeEnvelope<ArtifactCard>;
  let fetchError: string | null = null;

  try {
    initialData = await listArtifacts({
      workspace: "inbox",
      limit: 50,
    });
  } catch (err) {
    fetchError =
      err instanceof Error ? err.message : "Unexpected error fetching artifacts";
    initialData = { data: [], cursor: null };
  }

  if (fetchError) {
    return <InboxError message={fetchError} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <InboxClient initialData={initialData} />
    </div>
  );
}
