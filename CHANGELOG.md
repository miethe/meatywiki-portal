# Changelog

All notable changes to MeatyWiki Portal will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **Nine research aggregate endpoints wired to frontend** — Research workspace now displays live data from workspace-health, priority-topics, featured-topics, evidence-pulse/new, evidence-pulse/contradictions, synthesis-narrative, cross-entity-synthesis, recent-syntheses, and topics endpoints.
- **Fifteen research components transitioned from skeleton to live data** — WorkspaceHealth, PriorityTopics, FeaturedTopics, EvidencePulseNew, EvidencePulseContradictions, SynthesisNarrative, CrossEntitySynthesis, RecentSyntheses, and TopicCards now fetch and render live artifact data.
- **Topic scoping for workspace selector** — Workspace selector now allows filtering research context by topic priority and activity.

### Changed

- **ResearchWorkspaceEmpty banner conditionally hidden** — Banner is now only displayed when no artifacts exist in the research workspace; hidden once artifacts are present.

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
