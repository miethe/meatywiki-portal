---
name: DP4-02d Synthesis Builder 2-step wizard
description: Synthesis wizard routes, components, and endpoint gaps from ADR-DPI-005 implementation
type: project
---

2-step wizard per ADR-DPI-005 (Option A). Commit: d3a15ae.

## Routes
- `/research/synthesis` — landing page with wizard CTA + legacy link
- `/research/synthesis/select-scope` — Step 1: SynthesisArtifactPicker + ContextRail (SynthesisScopeRailPanel)
- `/research/synthesis/configure` — Step 2: SynthesisTypeBento + SynthesisParameterPanel + ContextRail
- `/research/synthesis/legacy` — preserved original SynthesisBuilder form

## Components
- `src/components/research/SynthesisArtifactPicker.tsx` — filterable grid with multi-select + manual textarea fallback
- `src/components/research/SynthesisTypeBento.tsx` — radiogroup bento: summary/analysis/compare/synthesize
- `src/components/research/SynthesisParameterPanel.tsx` — depth/tone toggles + constraints/scope/focus inputs
- `src/components/research/SynthesisScopeRailPanel.tsx` — scope summary sub-panel for ContextRail

## Endpoint gaps (non-blocking, documented in UI)
- `POST /api/workflows/synthesize` — does NOT yet consume `type`, `depth`, `tone`, `constraints` fields; backend DTO must be expanded. SynthesisParameterPanel shows a "pending backend support" banner.
- No full-text artifact search endpoint; title filter is client-side over current page.
- `SynthesizeParams` in `src/lib/api/workflows.ts` already has the new fields; body forwards them; backend ignores until wired.

**Why:** ADR-DPI-005 §3 notes backend expansion needed. Don't chase unless implementing backend phase.
**How to apply:** If future task expands backend synthesis DTO, refer to the forwarded fields already in SynthesizeParams.

## Test file
`tests/components/research/synthesis-wizard.test.tsx` — 29 tests, all passing.
Mock `listArtifacts` from `@/lib/api/artifacts` (not `@/types/artifact`) — ArtifactCard is exported from types, ArtifactSortField from lib/api/artifacts.
ServiceModeEnvelope shape: `{ data: T[], cursor: string | null }` (NOT `{ data: { items: T[], cursor } }`).
