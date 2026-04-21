---
name: DP4-02b context rail implementation
description: ContextRail component (ADR-DPI-002 A.1) — inline right-column rail on 4 surfaces; endpoints missing for lineage/evidence
type: project
---

ContextRail at `src/components/layout/ContextRail.tsx` — shared inline right-column rail per ADR-DPI-002 Option A.1.

**Why:** ADR-DPI-002 mandates a tabbed context rail on 5 surfaces; Option A.1 (inline, no new shell primitive) was chosen for least-invasive delivery.

**Variant / tab sets:**
- `variant="generic"` → Properties | Connections | History (Artifact Detail, OS tab)
- `variant="research"` → Evidence | Contradictions | Lineage | Metadata (Research surfaces)

**Surfaces wired:** Artifact Detail Readers+OS tab (generic), Review Queue (research, structural), Research Home (research, structural). Research Artifact Detail is the same ArtifactDetailClient route.

**Action column:** RAIL_ACTIONS in ArtifactDetailClient.tsx; action buttons migrated from header row to rail-owned column (DP1-03 #2).

**Missing backend endpoints (deferred v1.6):**
- `GET /api/artifacts/:id/lineage` — History + Lineage panels show "coming in v1.6"
- `GET /api/artifacts/:id/evidence` — Evidence + Contradictions panels defer similarly
- Connections and ResearchLineagePanel use existing `GET /api/artifacts/:id/edges`

**Test mock needed:** Any test file rendering ArtifactDetailClient or surfaces mounting ContextRail must mock `@/hooks/useArtifactEdges` to avoid real fetch (jsdom/undici incompatibility). Pattern: `jest.mock("@/hooks/useArtifactEdges", () => ({ useArtifactEdges: jest.fn(() => ({ data: { artifact_id: "t", incoming: [], outgoing: [] }, isLoading: false, isError: false, error: null, refetch: jest.fn() })) }))`.

**Commit:** 88853fd (feat/portal-v1.5-design-pass-p4)
