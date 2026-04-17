# Test Harness — MeatyWiki Portal

Component and unit tests for the MeatyWiki Portal frontend (P3-11).

## Structure

```
tests/
  setup.ts              # Global Jest setup: jest-dom, MSW lifecycle, Next.js mocks
  mocks/
    handlers.ts         # MSW v2 baseline request handlers (all core API endpoints)
    server.ts           # MSW Node server wired with baseline handlers
  utils/
    render.tsx          # renderWithProviders() + RTL re-exports
    userEvent.ts        # @testing-library/user-event convenience re-export
  smoke/
    harness.test.tsx    # End-to-end smoke test: jsdom + RTL + MSW + jest-dom
  lib/
    sse/                # SSE client tests (P3-08; may be in-progress)
  # Batch 3 additions:
  # components/         # Screen-level component tests (P3-03..P3-07)
```

## Running tests

```bash
pnpm test              # run all tests once
pnpm test:watch        # watch mode (re-runs on file change)
pnpm test:coverage     # run with coverage report (outputs to coverage/)
```

## Adding a new test file

1. Create `tests/<area>/<name>.test.tsx` (or `.test.ts` for non-JSX).
2. Import helpers from `../utils/render` — use `renderWithProviders` instead of raw `render`.
3. Override MSW handlers per-test with `server.use(...)`:

```tsx
import { server } from "../mocks/server";
import { http, HttpResponse } from "msw";

server.use(
  http.get("http://127.0.0.1:8787/api/artifacts", () =>
    HttpResponse.json({ data: { items: [], cursor: null } }),
  ),
);
```

The override is active only for the test that calls it; `afterEach` in
`setup.ts` calls `server.resetHandlers()` automatically.

## MSW handler reference

Baseline handlers cover:

| Method | URL | Response |
|--------|-----|----------|
| GET | `/health` | `{ status: "ok" }` |
| POST | `/api/auth/session` | `{ ok: true }` |
| DELETE | `/api/auth/session` | 204 |
| GET | `/api/artifacts` | 2-item list (paginated envelope) |
| GET | `/api/artifacts/:id` | Artifact detail stub |
| POST | `/api/artifacts/:id/promote` | `{ success: true, new_status: "compiled" }` |
| POST | `/api/artifacts/:id/link` | `{ status: "linked" }` |
| POST | `/api/artifacts/:id/review` | `{ id: "review-stub-01" }` |
| POST | `/api/intake/note` | 202 `{ run_id, status: "queued" }` |
| POST | `/api/intake/url` | 202 `{ run_id, status: "queued" }` |
| GET | `/api/workflows` | 2-item list (paginated envelope) |
| GET | `/api/workflows/templates` | 2 template stubs |
| GET | `/api/workflows/:run_id/stream` | Minimal SSE stream (stage_started → workflow_completed) |

## Coverage

Coverage target: **>80% lines/branches/functions/statements** on `src/` files.

Status in Batch 1: **advisory** — thresholds are configured in `jest.config.ts`
but only a small surface of `src/` has tests. Coverage will be below 80% until
Batch 3 component test authoring is complete. The CI job uses `--passWithNoTests`
in Batch 1 to avoid blocking on missing coverage.

Enforcement is enabled in Batch 3: remove `--passWithNoTests` from the CI step
and ensure `pnpm test:coverage` exits 0 before merging.
