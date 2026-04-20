---
name: Portal v1.5 P2 Workflow Viewer (Screen B) state
description: Implementation state for P1.5-2-02 and pre-existing breaks from parallel tasks
type: project
---

P1.5-2-02 (WorkflowViewerScreen) implemented on branch feat/portal-v1.5-p2-workflow-os.

**Why:** Screen B was the main viewer task in v1.5 Phase 2.

**How to apply:** When continuing work on this branch, note:
1. `src/app/(main)/workflows/page.tsx` has a broken JSX structure (missing closing `</div>`) introduced by the parallel P2-03 task (InitiationWizardDialog). This pre-exists; fix belongs in P2-03 commit.
2. `tests/components/workflow/initiation-wizard/initiation-wizard.test.tsx` fails with unhandled MSW `/api/workflow-templates` — also P2-03 scope, not viewer scope.
3. All 26 viewer component tests pass; all 80 pre-existing workflow component tests pass.
4. The data-testid attributes used: `workflow-viewer-screen`, `timeline-panel-container`, `rerun-button`, `run-history-row`.
