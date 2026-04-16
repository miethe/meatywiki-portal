/**
 * Library screen — stub.
 *
 * P3-05 implements:
 * - GET /api/artifacts with filters: type, status, tags
 * - Cursor pagination
 * - Grid/list toggle, sort controls
 * - Artifact cards with Lens Badge Set
 *
 * Stitch reference: "Library" screen
 * API: GET /api/artifacts (backend P2-09)
 */
export default function LibraryPage() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Library</h1>
      <p className="text-muted-foreground text-sm">
        Browsable artifact list — implemented in P3-05
      </p>
    </div>
  );
}
