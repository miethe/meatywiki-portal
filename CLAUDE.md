# CLAUDE.md — meatywiki-portal

This file provides guidance to Claude Code when working in this repository.

## Repository Role

**meatywiki-portal** is the Next.js 15 frontend for the MeatyWiki Portal v1. It is a sibling of the `meatywiki/` Python monorepo and consumes the backend's Service-Mode v2 API (FastAPI) over HTTP. The backend runs locally at `http://127.0.0.1:$PORT`; auth is a single bearer token (local-only, no multi-user in v1).

This repo ships the web interface only. All vault mutations — compilation, ingest, lint, file writes — remain owned by the backend engine. The frontend calls HTTP endpoints; it never imports Python code.

## Standard Commands

```bash
pnpm install        # install dependencies
pnpm dev            # start Next.js dev server (http://localhost:3000)
pnpm build          # production build
pnpm typecheck      # tsc --noEmit (strict)
pnpm lint           # next lint
pnpm test           # jest (component + unit tests)
pnpm e2e            # playwright test (requires backend running)
```

## Architecture

- **Framework**: Next.js 15 App Router, React 19, TypeScript strict
- **Styling**: Tailwind CSS v4 + shadcn/ui (slate base, CSS variables for tokens)
- **Route groups**:
  - `src/app/(auth)/` — unauthenticated routes (login)
  - `src/app/(main)/` — authenticated routes (inbox, library, artifact detail)
- **Components**: shadcn/ui primitives under `src/components/ui/`; feature components alongside their pages
- **API client**: `src/lib/api/client.ts` — typed fetch wrapper; expands per P3 task
- **Auth helpers**: `src/lib/auth/` — server-side cookie validation, token utilities (P3-01)
- **Hooks**: `src/hooks/` — custom React hooks for data fetching, SSE subscriptions (P3-08)
- **Tests**: `tests/` for Jest + RTL; `e2e/` for Playwright
- **MSW**: `tests/mocks/handlers.ts` + `tests/mocks/server.ts` for API mocking

## Invariants

### No backend imports
This repo never imports from the `meatywiki` Python package. All backend communication is HTTP only. Do not add Python packages or subprocess calls.

### Token storage
Bearer token is stored in an **HttpOnly cookie** (set by `POST /api/auth/session` on the backend) for server-side requests. Client components use memory state only. **Never store the token in `localStorage`** in v1.

### Local-only default
Default API URL is `http://127.0.0.1:8787`. To use a non-loopback address, set `MEATYWIKI_PORTAL_API_URL`. The backend also enforces `PORTAL_ALLOW_NETWORK=1` on its side.

### Write-through-engine
Any action that modifies vault content (compile, ingest, promote, lint) must go through a backend API endpoint, which in turn uses the engine's `EngineAdapter`. The frontend has no direct vault access.

### Sibling @miethe/ui dependency
`@miethe/ui` is wired via `"file:../skillmeat/skillmeat/web/packages/ui"` — a `file:` protocol path to the pre-built `dist/` in the sibling skillmeat monorepo. It is NOT published to npm. The package must be rebuilt (`pnpm build` inside the ui package) whenever upstream changes; CI must have the skillmeat repo checked out as a sibling. Added in P6-02 (v1.6) to provide `ContentPane`, `rehype-sanitize` helpers, and other shared components for the content-viewer gate.

## Authoritative Documents

Read these (in the sibling backend repo) before implementing any P3 task:

1. `../meatywiki/docs/project_plans/llm_wiki/portal/PRDs/portal-v1.md` — V1 PRD, A1–A19, acceptance criteria
2. `../meatywiki/docs/project_plans/llm_wiki/design-specs/portal-v1.md` — overlay schema (§4), UI design tokens, Workflow OS surfaces, architecture diagram
3. `../meatywiki/docs/project_plans/llm_wiki/portal/implementation-plans/portal-v1/phase-3-frontend-screens.md` — 12 tasks P3-01..P3-12, Stitch dependency map, batching
4. `../meatywiki/docs/project_plans/llm_wiki/portal/stitch-screen-audit.md` — approved 2026-04-16; maps 35 Stitch screen IDs to v1 scope; use for Stitch integration (P3-02)
5. `../meatywiki/.claude/progress/meatywiki-portal/phase-3-progress.md` — live task status; update after each task

## Commit Convention

Branch: `feat/portal-phase-3-frontend`

Commit format: `feat(portal-web): <summary> (P3-XX)`

Examples:
- `feat(portal-web): app shell + local login flow (P3-01)`
- `feat(portal-web): Stitch screen scaffolding integration (P3-02)`
- `feat(portal-web): inbox screen with cursor pagination (P3-03)`

One commit per task ID. After committing, append the SHA to `commit_refs` in the backend repo's phase-3-progress.md via `.claude/skills/artifact-tracking/update-field.py`.

## Phase 3 Tasks

All 12 task IDs live in the backend repo's phase-3-frontend-screens.md and phase-3-progress.md. Quick reference:

| Batch | Task | Description |
|-------|------|-------------|
| 1 (Pre-Stitch) | P3-01 | App shell + local login flow |
| 1 (Pre-Stitch) | P3-11 | Component test harness (MSW + Jest/RTL) |
| 2 (Stitch gate) | P3-02 | Stitch screen scaffolding integration |
| 2 (Stitch gate) | P3-08 | SSE progress integration |
| 3 (Screens) | P3-03 | Inbox screen |
| 3 (Screens) | P3-04 | Quick Add modal |
| 3 (Screens) | P3-05 | Library screen + artifact cards |
| 3 (Screens) | P3-06 | Artifact Detail (3 readers) |
| 3 (Screens) | P3-07 | Workflow status surface / panel |
| 4 (Polish) | P3-09 | Accessibility + mobile responsiveness |
| 4 (Polish) | P3-10 | Performance optimization |
| 4 (Polish) | P3-12 | E2E test suite (Playwright) |

## Testing Standards

- **Component tests**: Jest + React Testing Library; MSW for API mocking
- **E2E**: Playwright; covers critical user journeys + mobile viewports
- **Coverage target**: >80% lines/branches/functions (enforced in jest.config.ts)
- **Accessibility**: WCAG 2.1 AA required (P3-09); axe-core in both Jest (jest-axe) and Playwright (@axe-core/playwright); shadcn/ui provides ARIA baseline

## Accessibility

Every screen must pass WCAG 2.1 AA. shadcn/ui provides ARIA primitives — do not strip `aria-*` attributes from shadcn components. Run `pnpm e2e` to validate axe-core checks before submitting P3-09.

## Deferred Items (v1.5+)

Per the PRD deferred-items table (DF-001..DF-016):
- Workflow OS Screens B + C
- Blog/Projects workspaces
- Multi-user auth, OAuth
- PWA / offline support
- Mobile share-target, audio intake, image OCR
- Workflow Initiation Flow (Screen A)

Do not implement these in Phase 3.
