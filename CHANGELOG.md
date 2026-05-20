# Changelog

All notable changes to MeatyWiki Portal will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Graph Explorer Overhaul (Portal v2.2)

Sigma.js v3 + cosmos.gl renderer, deterministic keyset-cursor loading, 16-dimension filter panel, grouping with cluster halos, mobile + WCAG 2.1 AA support. Pairs with backend Portal v2.2 (rich GraphNode/GraphEdge DTOs, `/api/graph/semantic-neighbors`, `graph_changed` SSE).

- **Sigma.js v3 renderer** at `/graph` replaces the v2.1 vault graph page; lazy `cosmos.gl` chunk auto-activates at N>15K nodes for 2D geometric aggregation.
- **Deterministic keyset-cursor loading** — `graph_changed` SSE drives reload; no random sampling, every vault state reproduces the same snapshot across requests.
- **16-dimension filter panel** — 4 server-side (node_types, edge_types, cluster_by, lod), 11 client-side (workspace, project, domain, freshness class, confidence range, lens score bounds, updated-date range, fidelity, lifecycle stage, status, tags), 1 hybrid full-text (Fuse.js ≤2K, FTS5 above). Filter state encoded in URL for shareable views.
- **Grouping + cluster halos** — group by workspace (default), artifact type, project, or domain; expand/collapse state machine; grouped edges render as halos; layout positions persist via `layoutCache` keyed in URL.
- **Interaction layer** — focus modes (1-hop, 2-hop, path), in-graph search with Fuse.js, multi-select with shift-click and lasso, context menu (open detail, focus, hide, pin), PNG/SVG snapshot export with current viewport fidelity.
- **Deep-link fix** — `?node_id=` now centers and highlights neighborhoods; URL also encodes camera position, grouping mode, and layout cache key.
- **Mobile + a11y** — pinch-zoom, pan, tap-to-focus on touch devices; list-view auto-fallback on viewports <480px and matrix-view (experimental) at 480–768px; full keyboard navigation (arrows, Enter, Escape, Tab) and screen-reader alt text on interactive elements; WCAG 2.1 AA contrast and focus indicators.
- **Playwright E2E suite** — vault graph explorer scenarios cover load, filter, group, focus, deep-link, and export paths.

### Added

- Pending Approval queue in `/inbox`: list pending intake items, per-item approve/reject with optimistic removal, bulk select-all with sequential execution and progress indicator, Scan Inbox button, 30s auto-refresh with background-tab pause

## [1.6.0] - 2026-04-24

### Changed

- **Artifact detail readers migrated to @miethe/ui ArticleViewer** — Knowledge/Draft readers now use the unified content viewer from the shared UI package (v0.5.0+)
  - Full GitHub-Flavored Markdown support (tables, task lists, strikethrough)
  - Callout directives (`::: note`, `::: reference`, `::: warning`, `::: info`)
  - HTML sanitization via `rehype-sanitize@6` (XSS vectors stripped; safe for network deployment)
  - Typography variants with CSS-variable-driven styling
  - Frontmatter display with collapsible header
  - No more `dangerouslySetInnerHTML` on artifact detail pages

### Fixed

- **DOMPurify TODO resolved** — HTML artifact rendering is now secure. Script tags, event handlers, and unsafe URLs are stripped by ArticleViewer's rehype-sanitize pipeline before display.

### Removed

- `isomorphic-dompurify` dependency (replaced by `rehype-sanitize@6` in @miethe/ui)
- `ArtifactBody` inline parser component (retired; use ArticleViewer)

### Testing

- Added Playwright E2E tests for artifact detail Knowledge/Draft readers
- Added visual regression snapshot tests to verify rendering parity post-migration
