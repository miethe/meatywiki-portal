# meatywiki-portal

Next.js 15 frontend for the MeatyWiki Portal v1. Sibling of the [`meatywiki`](../meatywiki/) Python backend.

## What this is

A web interface for the MeatyWiki knowledge compilation engine: browse artifacts, capture notes/URLs, monitor workflow runs, and initiate compilations — without the CLI. All vault writes flow through the backend (write-through-engine invariant).

Screens: Inbox, Library, Artifact Detail (Source/Knowledge/Draft readers), Quick Add, Workflow Status surface.

## Install and run

```bash
cp .env.example .env.local   # configure API URL + token
pnpm install
pnpm dev                     # http://localhost:3000
```

The backend must be running at the URL in `MEATYWIKI_PORTAL_API_URL` (default `http://127.0.0.1:8787`).

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Development server |
| `pnpm build` | Production build |
| `pnpm typecheck` | TypeScript strict check |
| `pnpm lint` | ESLint via eslint-config-next |
| `pnpm test` | Jest + RTL component tests |
| `pnpm e2e` | Playwright E2E tests |

## Key docs (in backend repo)

- **PRD**: `../meatywiki/docs/project_plans/llm_wiki/portal/PRDs/portal-v1.md`
- **Design spec** (UI tokens, screens): `../meatywiki/docs/project_plans/llm_wiki/design-specs/portal-v1.md`
- **Phase 3 plan**: `../meatywiki/docs/project_plans/llm_wiki/portal/implementation-plans/portal-v1/phase-3-frontend-screens.md`
- **Backend CLAUDE.md**: `../meatywiki/CLAUDE.md`

## Tech stack

- Next.js 15 (App Router), React 19, TypeScript strict
- Tailwind CSS v4 + shadcn/ui (slate base, CSS variables)
- Jest + React Testing Library + MSW
- Playwright (E2E)
- pnpm
