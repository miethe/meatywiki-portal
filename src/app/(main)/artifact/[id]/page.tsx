/**
 * Artifact Detail screen — stub.
 *
 * P3-06 implements:
 * - Three reader tabs: Source (raw markdown), Knowledge (compiled), Draft (edit)
 * - Workflow OS tab: Lens Badge Set + Stage Tracker compact variant
 * - Action buttons: Compile, Ingest, Lint (1:1 maps to engine commands)
 * - Backlinks panel
 *
 * Stitch reference: "Artifact Detail" + Workflow OS tab
 * API: GET /api/artifacts/:id, GET /api/artifacts/:id/content (backend P2-09)
 */
export default async function ArtifactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">
        Artifact Detail
      </h1>
      <p className="text-muted-foreground text-sm">
        ID: <code>{id}</code> — implemented in P3-06
      </p>
    </div>
  );
}
