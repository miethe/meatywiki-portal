# meatywiki-portal

Next.js 15 frontend for the MeatyWiki Portal v1. Sibling of the [`meatywiki`](../meatywiki/) Python backend.

## What this is

A web interface for the MeatyWiki knowledge compilation engine: browse artifacts, capture notes/URLs, monitor workflow runs, and initiate compilations — without the CLI. All vault writes flow through the backend (write-through-engine invariant).

Screens: Inbox, Library, Artifact Detail (Source/Knowledge/Draft readers), Quick Add, Workflow Status surface.

## Screenshots (Portal v1.5 Stitch Reskin)

Portal v1.5 ships the **Intellectual Archive** editorial reskin, featuring refined typography, status-driven triage workflows, and contextual metrics. See [portal-v1.5-stitch-reskin.md](../meatywiki/docs/project_plans/llm_wiki/portal/PRDs/portal-v1.5-stitch-reskin.md) in the backend repo for the full design specification.

<!-- TODO: Capture screenshots post-ship.
     Dev server: `pnpm dev`; navigate to each route; use browser viewport 1440×900 (or 1920×1080). Save PNGs into docs/screenshots/portal-v1.5/. -->

### Key Surfaces

| Surface | Description |
|---------|-------------|
| ![App Home — WelcomeHeader, Recent Captures, ContextRail](docs/screenshots/portal-v1.5/home.png) | **App Home** — Landing view with welcome message, recent captures feed, and contextual sidebar showing latest syntheses and active workflows. |
| ![Library — Curated cards with hero/featured variants, thumbnails, and filter column](docs/screenshots/portal-v1.5/library.png) | **Library** — Fast access to artifacts with rich card variants, thumbnail previews, and responsive sidebar for filtering and related context. |
| ![Artifact Detail — Editorial display title, prose rendering, action buttons, and Handoff Chain](docs/screenshots/portal-v1.5/artifact-detail.png) | **Artifact Detail** — Full-page reader with editorial typography, source/knowledge/draft views, and action chains for compilation and promotion workflows. |
| ![Inbox — Status grouping (NEW, NEEDS COMPILE, NEEDS DESTINATION), UrgencyBadge, ContextRail](docs/screenshots/portal-v1.5/inbox.png) | **Inbox** — Triage-driven workflow with status grouping, urgency indicators, and contextual sidebar for real-time insights on pending compilations and destinations. |
| ![Workflows Dashboard — Metrics panel, active workflow cards, and historical runs table](docs/screenshots/portal-v1.5/workflows.png) | **Workflows Dashboard** — Monitoring surface with live metrics (compilation count, throughput, latency), active workflow cards, and historical table for past runs. |

### v1.5 Highlights

- **Intellectual Archive branding** — Refined sidebar header with editorial lockup replacing plain "MeatyWiki" text
- **Status-driven Inbox** — NEW / NEEDS COMPILE / NEEDS DESTINATION grouping with urgency badges for rapid triage
- **App Home landing** — Personalized welcome, recent captures, and contextual activity at a glance
- **Contextual metrics** — Workflows Dashboard with live metrics panel and historical trend analysis

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

## Portal docs (in this repo)

- **Storybook deferral & component inventory**: `docs/STORYBOOK.md`

## Tech stack

- Next.js 15 (App Router), React 19, TypeScript strict
- Tailwind CSS v4 + shadcn/ui (slate base, CSS variables)
- Jest + React Testing Library + MSW
- Playwright (E2E)
- pnpm

## PWA (experimental)

Portal v1.5 ships first-wave Progressive Web App support behind a feature flag. It is **off by default**.

### Enabling PWA

Set `NEXT_PUBLIC_PORTAL_ENABLE_PWA=1` in your `.env.local` (and `PORTAL_ENABLE_PWA=1` on the backend) to activate:

- Web App Manifest (`/manifest.json`) — enables browser install prompts and home-screen icons.
- Service worker (`/sw.js`) — cache-first static asset strategy; offline queue stub (full offline intake queue ships in P4-02).
- Web Share Target — other apps can share URLs or text directly into the portal's intake flow via `POST /api/intake/url`.

### Local development

The service worker registers on `http://localhost:3000` and `http://127.0.0.1:*` without HTTPS (localhost is a spec-exempted secure context). On any other non-HTTPS origin the registration is silently skipped.

### Browser support

| Browser | Install | Share Target | Notes |
|---------|---------|--------------|-------|
| Chrome / Edge (Android, desktop) | Yes | Yes | Full support |
| Firefox (Android) | Yes | Partial | Share Target not supported |
| Safari (iOS 16.4+) | Yes | No | iOS does not support Web Share Target |
| Safari (iOS <16.4) | No | No | Manifest-based install not available; app works in browser |
| Samsung Internet | Yes | Yes | Full support |

iOS Safari versions below 16.4 do not support the Web App Manifest for installation. The portal functions as a normal web page on those versions. For iOS 16.4+ users can add the app to their Home Screen via the Share sheet.

Fuller documentation (offline queue behaviour, audio capture intake) will be added in P4-05.
