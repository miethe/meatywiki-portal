# E2E Tests (Playwright)

E2E tests are scaffolded here for Phase 3 task P3-12.

## Running

```bash
pnpm e2e           # run all E2E tests
pnpm e2e --ui      # open Playwright UI mode
```

## What gets added in P3-12

- `auth.spec.ts` — login flow, token rejection, redirect behavior
- `inbox.spec.ts` — artifact list, quick add modal, SSE progress
- `library.spec.ts` — filters, pagination, artifact card interactions
- `artifact-detail.spec.ts` — reader tabs, workflow OS tab, action buttons
- `a11y.spec.ts` — axe-core accessibility checks on all screens (WCAG 2.1 AA)

## Backend dependency

E2E tests require the backend running at `http://127.0.0.1:8787`.
Set `MEATYWIKI_PORTAL_TOKEN` in `.env.local` before running.
