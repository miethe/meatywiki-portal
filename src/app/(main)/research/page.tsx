/**
 * Research Workspace Home — scaffold.
 *
 * P4-01 fills this with:
 *   - Featured artifact tiles with Lens Filter Bar
 *   - Active Workflows panel (top-right)
 *   - Lens Filter Bar (shared with Library)
 *
 * Stitch reference: "Research Home" (ID: 0cf6fb7b27d9459e8b5bebfea66915c5)
 * Shell: Standard Archival
 */

export default function ResearchPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Research</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Research workspace — implemented in P4-01
        </p>
      </div>
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        Research Workspace — P4 scope
      </div>
    </div>
  );
}
