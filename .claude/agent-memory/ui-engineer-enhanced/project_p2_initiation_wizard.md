---
name: Portal v1.5 P2 Initiation Wizard implementation notes
description: P1.5-2-03 wizard implementation details — mock strategy, API routing, and test approach
type: project
---

Implemented InitiationWizard (P1.5-2-03) on branch feat/portal-v1.5-p2.

**Key architectural decisions:**

1. No Radix UI / shadcn Dialog available — implemented custom Dialog in `src/components/ui/dialog.tsx` with focus trap, Esc handler, and ARIA modal semantics. API matches shadcn for future drop-in.

2. `getApiBase()` returns `/api` on client-side — MSW handlers use absolute `http://127.0.0.1:8765` which doesn't match. Component tests mock hooks directly (`useWorkflowTemplates`, `useCreateWorkflow`) rather than using MSW.

3. RoutingRecommendationCard lives in `src/components/artifact/` (not `workflow/`). Takes `artifactId` + `onStart(slug)` callback. Do not modify.

4. Three pre-existing failing test suites (smoke/research-layout, smoke/artifact-detail, a11y/login.a11y) — pre-date this task, unrelated.

**Files created:**
- `src/lib/api/workflow-templates.ts` — listWorkflowTemplates, createWorkflow, YAML param parser
- `src/hooks/useWorkflowTemplates.ts` — TanStack Query hook
- `src/hooks/useCreateWorkflow.ts` — TanStack Query mutation
- `src/components/ui/dialog.tsx` — custom accessible Dialog
- `src/components/workflow/initiation-wizard/` — wizard, dialog wrapper, 3 step components, stepper, barrel index
- `tests/components/workflow/initiation-wizard/initiation-wizard.test.tsx` — 28 tests, all passing
- `e2e/journeys/workflow-initiation.spec.ts` — Playwright E2E

**Why:** FR-1.5-06, replaces direct "start workflow" buttons for power-user flows.
