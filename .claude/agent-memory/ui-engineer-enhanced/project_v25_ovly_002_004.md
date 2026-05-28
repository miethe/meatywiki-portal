---
name: project-v25-ovly-002-004
description: Portal v2.5 graph immersive — OVLY-002/003/004 FloatingPanel migrations for Filters, Legend, and Actions
metadata:
  type: project
---

OVLY-002, OVLY-003, OVLY-004 completed on feat/portal-v2.5-graph-immersive branch.

**Why:** Phase 3 of the graph immersive feature migrates filters/legend/actions from the three-column sidebar layout into FloatingPanel overlays that render via ReactDOM.createPortal.

**Changes in VaultGraphPageClient.tsx**:
- Added `Filter` and `Wrench` to lucide-react imports
- Added `FloatingPanel` import from `@/components/graph/FloatingPanel`
- Removed `FilterSidebar` import (component file untouched; no other pages reference it as a JSX consumer)
- Removed local `ZoomControls` function (inlined into OVLY-004 panel body)
- OVLY-002: FloatingPanel id="filters" anchor="top-left" shortcutKey="f", wrapped in `hidden md:block` for desktop-only; renders FilterPanelContent + GraphFilters directly (bypasses FilterSidebar chrome); mobile still uses GraphFilterSheet
- OVLY-003: FloatingPanel id="legend" anchor="bottom-left" shortcutKey="l" defaultOpen=false; GraphLegend gets className="bg-transparent"; removed xl-only aside constraint
- OVLY-004: FloatingPanel id="actions" anchor="top-right" shortcutKey="a"; contains zoom (ZoomIn/ZoomOut/Crosshair/Maximize2 buttons), export PNG/SVG, and share trigger; gated on `!isLoading && !isNeighborhoodLoading && displayNodes.length > 0`
- Three-column flex div: gap-4 removed, filter/legend aside removed, canvas section now fills full width (`flex flex-1 min-h-0 items-stretch`)
- GraphShareModal JSX stayed in place; only its trigger moved

**Validation (at time of completion)**:
- `pnpm typecheck`: only pre-existing `.next/types/app/(main)/graph/page.ts` error (2 pre-existing errors)
- `pnpm exec eslint VaultGraphPageClient.tsx`: 5 problems total (2 errors, 3 warnings) — all pre-existing; 0 new errors introduced

**How to apply:** FloatingPanel panels must be placed as siblings of the canvas flex container, not inside it, since they render via portal. The `hidden md:block` wrapper for filters prevents the panel from rendering server-side (avoids SSR mismatch on mobile).
