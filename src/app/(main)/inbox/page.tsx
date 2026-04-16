/**
 * Inbox screen — stub.
 *
 * P3-03 implements:
 * - Fetches GET /api/artifacts?workspace=inbox with cursor pagination
 * - Renders artifact cards with Lens Badge Set
 * - Inline Quick Add trigger (opens P3-04 modal)
 * - Workflow status badges on cards
 *
 * Stitch reference: "Inbox" screen
 * API: GET /api/artifacts (backend P2-09)
 */
export default function InboxPage() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Inbox</h1>
      <p className="text-muted-foreground text-sm">
        Artifact list — implemented in P3-03
      </p>
    </div>
  );
}
