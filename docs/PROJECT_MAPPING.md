# MeatyWiki Portal - Comprehensive Project Mapping

**Version:** 1.6  
**Last Updated:** 2026-04-23  
**Repository:** meatywiki-portal (Next.js Frontend)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Technology Stack](#technology-stack)
3. [System Architecture](#system-architecture)
4. [Directory Structure](#directory-structure)
5. [Pages & Routes Mapping](#pages--routes-mapping)
6. [API Endpoints & Data Flows](#api-endpoints--data-flows)
7. [Authentication & Security](#authentication--security)
8. [Infrastructure & Deployment](#infrastructure--deployment)
9. [Database Schema & Data Models](#database-schema--data-models)
10. [Testing Framework](#testing-framework)
11. [PWA & Offline Capabilities](#pwa--offline-capabilities)
12. [Component Architecture](#component-architecture)
13. [State Management](#state-management)
14. [Performance Optimization](#performance-optimization)
15. [Development Workflow](#development-workflow)
16. [Technical Debt & Future Considerations](#technical-debt--future-considerations)

---

## Executive Summary

**MeatyWiki Portal** is a Next.js 15 web application serving as the frontend interface for the MeatyWiki knowledge compilation engine. It provides a modern, responsive UI for browsing artifacts, capturing notes/URLs, monitoring workflow runs, and initiating compilations without requiring CLI access.

### Key Characteristics

- **Architecture:** Next.js 15 App Router with React 19, TypeScript strict mode
- **Backend Integration:** Consumes Python FastAPI backend (Service-Mode v2) via HTTP
- **Authentication:** Bearer token via HttpOnly cookies (local-only, single-user in v1)
- **Deployment:** Local development default (http://127.0.0.1:3000)
- **Design System:** Tailwind CSS v4 + shadcn/ui (slate base theme)
- **Progressive Enhancement:** Experimental PWA support with offline queue

### Core Invariants

1. **No Backend Imports:** All backend communication is HTTP-only; never imports Python code
2. **Write-Through-Engine:** All vault mutations flow through backend API endpoints
3. **Token Security:** Bearer tokens stored in HttpOnly cookies only; never in localStorage
4. **Local-First:** Default API URL is loopback (127.0.0.1:8765)

---

## Technology Stack

### Frontend Framework

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 15.3.0 | React framework with App Router |
| **React** | 19.0.0 | UI library |
| **TypeScript** | 5.8.3 | Type safety (strict mode) |
| **Tailwind CSS** | 4.1.4 | Utility-first styling |
| **shadcn/ui** | Latest | Component primitives (Radix UI based) |

### State Management & Data Fetching

| Technology | Version | Purpose |
|------------|---------|---------|
| **TanStack Query** | 5.99.0 | Server state management, caching |
| **React 19 Hooks** | Built-in | Local state management |
| **EventSource API** | Native | SSE (Server-Sent Events) for real-time updates |

### Styling & UI

| Technology | Version | Purpose |
|------------|---------|---------|
| **Tailwind CSS** | 4.1.4 | Utility-first CSS framework |
| **PostCSS** | 8.5.10 | CSS processing |
| **Fraunces Font** | Google Fonts | Display serif for brand lockup |
| **Lucide React** | 0.487.0 | Icon library |
| **class-variance-authority** | 0.7.1 | Component variant management |
| **clsx** | 2.1.1 | Conditional className utility |
| **tailwind-merge** | 3.2.0 | Tailwind class merging |

### Testing

| Technology | Version | Purpose |
|------------|---------|---------|
| **Jest** | 29.7.0 | Unit testing framework |
| **React Testing Library** | 16.3.0 | Component testing |
| **Playwright** | 1.52.0 | E2E testing |
| **MSW** | 2.7.5 | API mocking |
| **jest-axe** | 8.0.0 | Accessibility testing |
| **@axe-core/playwright** | 4.8.0 | E2E accessibility testing |
| **fake-indexeddb** | 6.2.5 | IndexedDB mocking |

### Build & Development Tools

| Technology | Version | Purpose |
|------------|---------|---------|
| **pnpm** | 9.15.4 | Package manager |
| **ESLint** | 9.25.1 | Linting |
| **Prettier** | 3.5.3 | Code formatting |
| **ts-jest** | 29.3.2 | TypeScript Jest transformer |
| **@swc** | Built-in | Fast TypeScript/JavaScript compiler |

### PWA Technologies (Experimental)

| Technology | Purpose |
|------------|---------|
| **Service Worker** | Offline caching, background sync |
| **IndexedDB** | Offline queue storage |
| **Web App Manifest** | PWA installation metadata |
| **Web Share Target** | Share URLs/text into portal |

---

## System Architecture

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (Client)                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Next.js 15 App (React 19)                             │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │ │
│  │  │   Pages      │  │  Components  │  │    Hooks     │ │ │
│  │  │  (Routes)    │  │   (UI/UX)    │  │  (Logic)     │ │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │         TanStack Query (State Cache)             │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │         API Client (HTTP Fetch Wrapper)          │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Service Worker (PWA - Optional)                       │ │
│  │  - Cache-first static assets                           │ │
│  │  - Network-first API routes                            │ │
│  │  - Background sync trigger                             │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  IndexedDB (Offline Queue - Optional)                  │ │
│  │  - Pending intake requests                             │ │
│  │  - Failed requests                                     │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/HTTPS
                            │ Bearer Token (HttpOnly Cookie)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Backend API (Python FastAPI)                    │
│                  http://127.0.0.1:8765/api                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Service-Mode v2 API Endpoints                         │ │
│  │  - /api/artifacts (list, detail, derivatives)          │ │
│  │  - /api/workflows (runs, synthesize, stream)           │ │
│  │  - /api/intake (note, url, upload)                     │ │
│  │  - /api/workflow-templates (CRUD)                      │ │
│  │  - /api/auth/session (login)                           │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  MeatyWiki Engine (Python)                             │ │
│  │  - Vault operations                                    │ │
│  │  - Compilation workflows                               │ │
│  │  - Content processing                                  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Vault (File System)                             │
│  - Markdown files                                            │
│  - YAML frontmatter                                          │
│  - Overlay database (SQLite)                                 │
└─────────────────────────────────────────────────────────────┘
```

### Communication Patterns

#### 1. HTTP Request/Response
- Primary communication method
- Bearer token authentication via HttpOnly cookie
- JSON payloads
- RESTful endpoints

#### 2. Server-Sent Events (SSE)
- Real-time workflow progress updates
- Endpoint: `/api/workflows/{run_id}/stream`
- Auto-reconnect with exponential backoff
- Last-Event-ID replay support

#### 3. Offline Queue (PWA)
- IndexedDB-backed request queue
- Automatic retry with exponential backoff
- Background sync integration
- Security: No auth tokens stored

---

## Directory Structure

```
meatywiki-portal/
├── .claude/                    # Claude AI context files
├── .github/                    # GitHub workflows (CI/CD)
├── .swc/                       # SWC compiler cache
├── docs/                       # Documentation
│   ├── screenshots/            # UI screenshots
│   ├── PROJECT_MAPPING.md     # This file
│   └── STORYBOOK.md           # Component inventory
├── e2e/                        # Playwright E2E tests
│   ├── journeys/              # User journey tests
│   ├── support/               # Test fixtures & mocks
│   ├── pwa-mobile-viewports.spec.ts
│   ├── pwa-offline-queue.spec.ts
│   └── responsive.spec.ts
├── public/                     # Static assets
│   ├── sw.js                  # Service worker
│   └── manifest.json          # PWA manifest
├── src/                        # Source code
│   ├── app/                   # Next.js App Router pages
│   │   ├── (auth)/            # Unauthenticated routes
│   │   ├── (main)/            # Authenticated routes
│   │   ├── api/               # API route handlers
│   │   ├── error.tsx
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── not-found.tsx
│   │   └── page.tsx
│   ├── components/            # React components
│   │   ├── artifact/
│   │   ├── blog/
│   │   ├── home/
│   │   ├── inbox/
│   │   ├── layout/
│   │   ├── library/
│   │   ├── providers/
│   │   ├── pwa/
│   │   ├── quick-add/
│   │   ├── research/
│   │   ├── shell/
│   │   ├── ui/
│   │   ├── workflow/
│   │   └── workflow-templates/
│   ├── hooks/                 # Custom React hooks
│   ├── lib/                   # Utility libraries
│   │   ├── api/               # API client modules
│   │   ├── auth/              # Authentication helpers
│   │   ├── pwa/               # PWA utilities
│   │   ├── sse/               # SSE client
│   │   ├── workflow/          # Workflow utilities
│   │   └── utils.ts
│   └── types/                 # TypeScript type definitions
├── tests/                      # Jest unit tests
│   ├── mocks/                 # MSW handlers
│   ├── polyfills.ts
│   └── setup.ts
├── .env.example
├── .gitignore
├── CLAUDE.md
├── components.json
├── eslint.config.mjs
├── jest.config.ts
├── package.json
├── playwright.config.ts
├── README.md
└── tsconfig.json
```

---

## Pages & Routes Mapping

### Route Groups

Next.js 15 App Router uses route groups for organization:

- **(auth)**: Unauthenticated routes
- **(main)**: Authenticated routes requiring session

### Complete Route Map

| Route | File Path | Description | Backend Endpoints | Auth |
|-------|-----------|-------------|-------------------|------|
| `/` | `src/app/page.tsx` | Root redirect to `/home` or `/login` | - | Conditional |
| `/login` | `src/app/(auth)/login/page.tsx` | Login screen with token input | `POST /api/auth/session` | No |
| `/home` | `src/app/(main)/home/page.tsx` | Landing view with recent captures | `GET /api/artifacts?workspace=inbox&limit=5` | Yes |
| `/inbox` | `src/app/(main)/inbox/page.tsx` | Triage workflow with status grouping | `GET /api/artifacts?workspace=inbox` | Yes |
| `/library` | `src/app/(main)/library/page.tsx` | Artifact browsing with filters | `GET /api/artifacts?workspace=library` | Yes |
| `/library/:id` | `src/app/(main)/library/[id]/page.tsx` | Full artifact reader | `GET /api/artifacts/:id` | Yes |
| `/projects` | `src/app/(main)/projects/page.tsx` | Projects workspace (deferred) | - | Yes |
| `/research` | `src/app/(main)/research/page.tsx` | Research dashboard | `GET /api/artifacts?facet=research` | Yes |
| `/research/queue` | `src/app/(main)/research/queue/page.tsx` | Research review queue | `GET /api/artifacts?facet=research` | Yes |
| `/research/synthesis/select-scope` | `src/app/(main)/research/synthesis/select-scope/page.tsx` | Select artifacts for synthesis | `GET /api/artifacts?facet=research` | Yes |
| `/research/synthesis/configure` | `src/app/(main)/research/synthesis/configure/page.tsx` | Configure synthesis parameters | `POST /api/workflows/synthesize` | Yes |
| `/workflows` | `src/app/(main)/workflows/page.tsx` | Workflow monitoring dashboard | `GET /api/workflows/runs` | Yes |
| `/workflows/:runId` | `src/app/(main)/workflows/[runId]/page.tsx` | Detailed workflow run viewer | `GET /api/workflows/:runId/stream` (SSE) | Yes |
| `/settings` | `src/app/(main)/settings/page.tsx` | User settings | - | Yes |
| `/settings/workflow-templates` | `src/app/(main)/settings/workflow-templates/page.tsx` | Template management | `GET /api/workflow-templates` | Yes |

### Modal/Overlay Components

| Component | Trigger | Description | Backend Endpoints |
|-----------|---------|-------------|-------------------|
| QuickAddModal | Global shortcut / button | Capture notes, URLs, files | `POST /api/intake/*` |
| InitiationWizardDialog | Workflow button | 3-step workflow creation | `POST /api/workflows` |
| TemplateEditorDialog | Template management | Create/edit templates | `POST/PATCH /api/workflow-templates` |
| AssessmentModal | Artifact detail | Lens dimension assessment | `PATCH /api/artifacts/:id/lens` |

---

## API Endpoints & Data Flows

### Backend API Base URL

- **Development:** `http://127.0.0.1:8765/api`
- **Configurable via:** `MEATYWIKI_PORTAL_API_URL`
- **Client-side proxy:** `/api` (Next.js rewrites)

### Authentication Flow

```
1. User enters token on /login
2. POST /api/auth/session { token }
3. Backend validates token
4. Backend sets HttpOnly cookie: portal_session=<token>
5. Frontend redirects to /home
6. All subsequent requests include cookie automatically
```

### Key API Endpoints

#### Artifacts API

**List Artifacts**
```
GET /api/artifacts
Query: workspace, facet, type, status, sort, order, cursor, limit
Response: ServiceModeEnvelope<ArtifactCard>
```

**Get Artifact Detail**
```
GET /api/artifacts/:id
Response: ArtifactDetail
```

**Get Derivatives**
```
GET /api/artifacts/:sourceId/derivatives
Response: ServiceModeEnvelope<DerivativeItem>
```

**Update Lens Metadata**
```
PATCH /api/artifacts/:id/lens
Body: LensPatchRequest
Response: ServiceModeEnvelope<ArtifactMetadataResponse>
```

#### Workflows API

**List Workflow Runs**
```
GET /api/workflows/runs
Query: status, since, cursor, limit
Response: ServiceModeEnvelope<WorkflowRun>
```

**Submit Synthesis**
```
POST /api/workflows/synthesize
Body: { template_id, sources, scope, focus, type, depth, tone }
Response: 202 Accepted { run_id, status, created_at }
```

**Stream Progress (SSE)**
```
GET /api/workflows/:runId/stream
Response: Server-Sent Events
Events: workflow_started, stage_progress, workflow_completed, etc.
```

#### Intake API

**Submit Note**
```
POST /api/intake/note
Body: { text, tags }
Response: 202 Accepted { run_id }
```

**Submit URL**
```
POST /api/intake/url
Body: { url, title, tags }
Response: 202 Accepted { run_id }
```

**Submit Upload**
```
POST /api/intake/upload
Body: Blob
Response: 202 Accepted { run_id }
```

#### Workflow Templates API

**List Templates**
```
GET /api/workflow-templates
Query: scope (all | custom | system)
Response: { data: WorkflowTemplateDTO[] }
```

**CRUD Operations**
```
POST /api/workflow-templates
PATCH /api/workflow-templates/:id
DELETE /api/workflow-templates/:id
```

### Data Flow Patterns

#### Server-Side Rendering (SSR)
```
Page Component (Server)
  → apiFetch() with cookie forwarding
  → Backend API
  → Initial data rendered in HTML
  → Hydration on client
```

#### Client-Side Data Fetching
```
Client Component
  → TanStack Query hook
  → apiFetch() via /api proxy
  → Browser sends HttpOnly cookie
  → Backend API
  → Cache in TanStack Query
  → Component re-render
```

#### Real-Time Updates (SSE)
```
Client Component
  → useSSE() hook
  → EventSource to /api/workflows/:runId/stream
  → Backend sends events
  → Debounced batch updates (100ms)
  → React state update
```

#### Offline Queue (PWA)
```
Client (offline)
  → submitNote/submitUrl
  → intakeFetch() detects offline
  → Enqueue in IndexedDB
  → Return synthetic response

Client (back online)
  → OfflineQueueSync component
  → Drain queue with retry
  → Remove on success
```

---

## Authentication & Security

### Authentication Mechanism

**Type:** Bearer token authentication  
**Storage:** HttpOnly cookie (`portal_session`)  
**Scope:** Single-user, local-only (v1)

### Token Flow

1. **Login:** User enters token → Backend validates → Sets HttpOnly cookie
2. **Server-side requests:** `apiFetch()` reads cookie, adds `Authorization` header
3. **Client-side requests:** Browser automatically sends cookie

### Security Features

1. **HttpOnly Cookies** - Token never accessible to JavaScript
2. **No localStorage** - Strict invariant: tokens NEVER in localStorage
3. **SameSite=Strict** - Prevents CSRF attacks
4. **Offline Queue Security** - No auth tokens stored in IndexedDB
5. **HTTPS Requirement** - Service worker requires HTTPS (except localhost)

### Auth Bypass (Development Only)

```
PORTAL_DISABLE_AUTH=1 (backend)
NEXT_PUBLIC_PORTAL_DISABLE_AUTH=1 (frontend)
```

**WARNING:** Never use in production

---

## Infrastructure & Deployment

### Development Environment

#### Prerequisites
- Node.js 18+
- pnpm 9.15.4
- Backend running at http://127.0.0.1:8765

#### Setup
```bash
cp .env.example .env.local
pnpm install
pnpm dev  # http://localhost:3000
```

#### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MEATYWIKI_PORTAL_API_URL` | Yes | `http://127.0.0.1:8765` | Backend API URL |
| `MEATYWIKI_PORTAL_TOKEN` | No | - | Fallback token |
| `PORTAL_DISABLE_AUTH` | No | `0` | Bypass auth (dev only) |
| `NEXT_PUBLIC_PORTAL_DISABLE_AUTH` | No | `0` | Bypass login flow |
| `NEXT_PUBLIC_PORTAL_ENABLE_PWA` | No | `0` | Enable PWA features |

### Build & Deployment

```bash
pnpm build      # Production build
pnpm start      # Start production server
```

**v1 Scope:** Local development only  
**Future:** Vercel, Docker, self-hosted Node.js

---

## Database Schema & Data Models

### Frontend Data Models

The frontend does NOT have its own database. All persistent data lives in the backend's SQLite overlay database.

#### Core TypeScript Interfaces

**ArtifactCard** (List View)
```typescript
interface ArtifactCard {
  artifact_id: string;
  title: string;
  artifact_type: string;
  status: ArtifactStatus;
  workspace: ArtifactWorkspace;
  created_at: string;
  updated_at: string;
  metadata?: ArtifactMetadataCard;
}
```

**WorkflowRun**
```typescript
interface WorkflowRun {
  run_id: string;
  template_id: string;
  status: WorkflowRunStatus;
  started_at: string;
  completed_at?: string;
  stages: WorkflowStage[];
}
```

### IndexedDB Schema (PWA)

```
DB: meatywiki-portal-offline
Version: 1

Store: offline_queue
  keyPath: id (autoIncrement)
  Fields: endpoint, method, headers, bodyJson, bodyBlob, enqueuedAt, retries

Store: failed_queue
  keyPath: id (autoIncrement)
  Fields: (same as offline_queue)
```

---

## Testing Framework

### Testing Strategy

1. **Unit Tests** (Jest + RTL) - Component logic, hooks, utilities
2. **E2E Tests** (Playwright) - Critical user journeys, accessibility
3. **API Mocking** (MSW) - Mock backend responses

### Test Commands

```bash
pnpm test              # Jest unit tests
pnpm test:watch        # Jest watch mode
pnpm test:coverage     # Coverage report
pnpm e2e               # Playwright E2E tests
pnpm typecheck         # TypeScript checking
pnpm lint              # ESLint
```

### E2E Test Coverage

- Login & Inbox journey
- Library browsing & filtering
- Artifact detail views
- Quick Add intake
- Workflow initiation & monitoring
- PWA offline queue
- Responsive design
- Accessibility (WCAG 2.1 AA)

---

## PWA & Offline Capabilities

### PWA Features (Experimental)

**Status:** Off by default; opt-in via `NEXT_PUBLIC_PORTAL_ENABLE_PWA=1`

1. **Web App Manifest** - Installation metadata
2. **Service Worker** - Cache-first static, network-first API
3. **Offline Queue** - IndexedDB-backed intake queue
4. **Background Sync** - Automatic replay on reconnect
5. **Web Share Target** - Share URLs into portal

### Browser Support

| Browser | Install | Share Target | Offline Queue |
|---------|---------|--------------|---------------|
| Chrome/Edge | ✅ | ✅ | ✅ |
| Firefox | ✅ | ❌ | ✅ |
| Safari iOS 16.4+ | ✅ | ❌ | ✅ |
| Safari iOS <16.4 | ❌ | ❌ | ✅ |

---

## Component Architecture

### Design System

- **Base:** shadcn/ui (Radix UI primitives)
- **Theme:** Slate color palette with CSS variables
- **Typography:** Fraunces (display serif) + system sans-serif

### Component Categories

1. **UI Primitives** (`src/components/ui/`) - shadcn/ui components
2. **Feature Components** - Artifact, Workflow, Inbox, Library, Research
3. **Layout Components** - Shell, ContextRail, Navigation
4. **Provider Components** - QueryProvider, PwaProviders

---

## State Management

### TanStack Query

- **Purpose:** Server state caching, background refetching
- **Configuration:** 5-minute stale time, automatic retries
- **Devtools:** Enabled in development

### React Hooks

- **Local State:** `useState`, `useReducer`
- **Side Effects:** `useEffect`, `useLayoutEffect`
- **Context:** `useContext` for theme, auth status

### SSE State

- **Hook:** `useSSE()` - Manages EventSource connections
- **Debouncing:** 100ms visual batching
- **Reconnect:** Exponential backoff with Last-Event-ID replay

---

## Performance Optimization

### Code Splitting

- **Next.js automatic:** Route-based code splitting
- **Dynamic imports:** Heavy components lazy-loaded
- **PWA components:** `ssr: false` for client-only code

### Caching Strategy

- **TanStack Query:** 5-minute stale time, background refetch
- **Service Worker:** Cache-first for static assets
- **HTTP caching:** ETag support in API client

### Bundle Size

- **Target:** <500 KB initial bundle (gzipped)
- **Monitoring:** Next.js bundle analyzer
- **Tree shaking:** Automatic via Next.js/SWC

---

## Development Workflow

### Git Workflow

**Branch:** `feat/portal-phase-3-frontend`  
**Commit Format:** `feat(portal-web): <summary> (P3-XX)`

### Code Quality

- **TypeScript:** Strict mode enforced
- **ESLint:** Next.js config + custom rules
- **Prettier:** Automatic formatting
- **Pre-commit:** Type checking + linting

### Documentation

- **CLAUDE.md:** AI assistant guidance
- **README.md:** Quick start guide
- **STORYBOOK.md:** Component inventory
- **PROJECT_MAPPING.md:** This comprehensive mapping

---

## Technical Debt & Future Considerations

### Deferred Features (v1.5+)

- Multi-user authentication & OAuth
- Workflow OS Screens B + C
- Blog/Projects workspaces (full implementation)
- Mobile share-target audio capture
- Image OCR intake
- Full offline mode (beyond intake queue)

### Known Limitations

1. **Single-user only** - No role-based access control
2. **Local deployment** - No production hosting setup
3. **Limited PWA** - Experimental, off by default
4. **No real-time collaboration** - Single-session model

### Performance Improvements

- Implement virtual scrolling for large lists
- Add request deduplication
- Optimize image loading (lazy, blur placeholders)
- Reduce bundle size (analyze dependencies)

### Security Enhancements

- Add CSRF token validation
- Implement rate limiting
- Add request signing
- Enhance audit logging

---

## Appendix: Key Files Reference

### Configuration Files

- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `jest.config.ts` - Jest test configuration
- `playwright.config.ts` - E2E test configuration
- `eslint.config.mjs` - Linting rules
- `components.json` - shadcn/ui configuration
- `.env.example` - Environment variables template

### Core Source Files

- `src/app/layout.tsx` - Root layout with providers
- `src/lib/api/client.ts` - HTTP client wrapper
- `src/lib/auth/session.ts` - Session management
- `src/lib/sse/client.ts` - SSE connection manager
- `src/lib/pwa/offline-queue.ts` - Offline queue manager
- `public/sw.js` - Service worker

### Documentation Files

- `README.md` - Project overview
- `CLAUDE.md` - AI assistant guidance
- `docs/STORYBOOK.md` - Component inventory
- `docs/PROJECT_MAPPING.md` - This comprehensive mapping

---

**End of Project Mapping**

For questions or updates, refer to the backend repository's documentation at `../meatywiki/CLAUDE.md` and the PRD at `../meatywiki/docs/project_plans/llm_wiki/portal/PRDs/portal-v1.md`.