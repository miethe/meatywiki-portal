---
name: di080-bulk-compile-batch
description: DI-080 bulk-compile batch aggregation — hook, header component, InboxClient wiring, tests
metadata:
  type: project
---

DI-080 shipped on feat/portal-inbox-live-status. Pure client-side grouping by start-time proximity (no job_id/batch_id on backend).

**Files created:**
- `src/hooks/useCompileBatch.ts` — groups entries within BATCH_WINDOW_MS (5000ms); exports `BATCH_WINDOW_MS` constant; returns `{ batch, isBatch }`.
- `src/components/Inbox/InboxBatchCompileHeader.tsx` — collapsible header "X of Y compiled" + progress bar; aria-expanded/aria-controls; Enter/Space toggle.
- `tests/hooks/useCompileBatch.test.ts` — 9 unit tests (batch detection cases + standalone/no-chrome cases).
- `e2e/inbox-live-status/bulk-compile.spec.ts` — 4 E2E scenarios (5 artifacts, SSE mock, batch header counter, collapsible, Processed move).

**Files modified:**
- `src/app/(main)/inbox/InboxClient.tsx` — added `compileStateMap` state + `handleBatchCompileStart`/`handleBatchCompileTerminal` callbacks; `useCompileBatch` call; batch render branch in NEEDS_COMPILE/NEEDS_FIX groups; `InboxItemWithCompile` updated with `onCompileStart`/`onCompileTerminal` optional props.

**Why:** `InboxItemWithCompile` owns SSE state; `InboxClient` coordinates batch grouping by receiving callbacks on 202 ACK and terminal events. No shared context/store needed — plain `useState(Map)`.

**How to apply:** Single-artifact case (isBatch=false) renders exactly as before — no batch chrome, no regression.
