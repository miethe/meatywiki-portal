---
title: "Component Extraction Plan — Portal v1.5 Stitch Reskin"
date: "2026-04-23"
status: "draft"
feature: "portal-v1.5-stitch-reskin"
description: "Evaluation of extraction-ready components and deferral plan for stabilization before @meaty/ui extraction."
---

# Component Extraction Plan — Portal v1.5 Stitch Reskin

## Overview

Portal v1.5 Stitch Reskin ships nine extraction candidates — components designed from the outset with zero portal-domain dependencies and generic, reusable APIs. These components are ready for extraction to the `@meaty/ui` package **after a 2+ week stabilization window** post-v1.5 release.

This deferral strategy prevents API churn: early extraction risks re-discovering better abstractions under real-world usage, forcing breaking changes in the UI package. By delaying extraction and collecting real-world feedback first, we ensure extracted components are battle-tested and stable.

## Deferral Rationale

Ship these components in the Portal v1.5 release with provisional `@meaty/ui` extraction comments (e.g., `// TODO v1.6: Consider extracting to @meaty/ui post-stabilization`). Allow 2+ weeks of live usage to:

1. Validate component APIs against real usage patterns
2. Discover and fix edge cases before extraction
3. Collect community feedback (future users, enterprise customers)
4. Confirm performance and accessibility in production conditions

**Target extraction window**: 2–4 weeks post-v1.5 ship date.

## Candidate Components

| Component | File Path | Exists | Readiness | Portal Imports | Effort | Deferral | Target @meaty/ui |
|---|---|---|---|---|---|---|---|
| `SidebarFooter` | `src/components/ui/sidebar-footer.tsx` | ✓ | High | None | Low | 2 weeks | v0.4 |
| `ContextRail` | `src/components/ui/context-rail.tsx` | ✓ | High | None (uses context hook) | Low | 2 weeks | v0.5 |
| `StatusGroupSection` | `src/components/ui/status-group-section.tsx` | ✓ | High | None | Low | 2 weeks | v0.5 |
| `UrgencyBadge` | `src/components/ui/urgency-badge.tsx` | ✓ | High | None | Low | 2 weeks | v0.4 |
| `MetricsPanel` | `src/components/ui/metrics-panel.tsx` | ✓ | High | None | Medium | 2–3 weeks | v0.6 |
| `ResourceIntensityGauge` | Not yet implemented | ✗ | Not shipped | N/A | Low | 3–4 weeks | v0.6 |
| `WelcomeHeader` | `src/components/shell/welcome-header.tsx` | ✓ | High | None | Low | 2 weeks | v0.4 |
| `SynthesisQuote` | Not yet implemented | ✗ | Not shipped | N/A | Medium | 3–4 weeks | v1.0+ |
| `WorkspaceHealthGauge` | `src/components/research/WorkspaceHealthGauge.tsx` | ✓ | Medium | None (skeleton; endpoint deferred to v1.6) | Low | 3–4 weeks | v0.6 |

## Per-Component Notes

### SidebarFooter
**Status**: Ready for extraction.
**API**: `SidebarFooterProps` (user, links, quickAdd callback). No portal-specific imports.
**Notes**: Explicitly designed with zero Next.js coupling (`<a>` tags, `<img>` instead of `next/image`). Safe for extraction immediately after v1.5 ship. Monitor real-world usage for edge cases in compact mode.

### ContextRail
**Status**: Ready for extraction; minor dependency on context hook.
**API**: `ContextRailProps` (sections array, responsive width, collapsible toggle). Depends on `useContextRailToggle()` from `context-rail-context.tsx`.
**Notes**: Hook is also extraction-ready (minimal context setup). Both can extract together to `@meaty/ui v0.5`. CSS breakpoint logic is tested and stable.

### StatusGroupSection
**Status**: Ready for extraction.
**API**: `StatusGroupSectionProps` (label, count, urgency). All props are primitives or enums.
**Notes**: Uses portal urgency CSS tokens (`--portal-urgency-warn`, `--portal-urgency-urgent`) in inline styles. When extracted, move token definitions to `@meaty/ui` or accept token props. Current version is portable as-is.

### UrgencyBadge
**Status**: Ready for extraction.
**API**: `UrgencyBadgeProps` (level, minutesAgo). No dependencies.
**Notes**: Decorative dot is properly hidden from screen readers; semantic meaning carried by label text. Minute formatting for relative time is reusable. Safe to extract post-v1.5.

### MetricsPanel
**Status**: Ready for extraction; slightly higher complexity.
**API**: `MetricsPanel` with `Metric[]` array (label, value, delta, optional icon). Supports stack/grid orientations.
**Notes**: Delta coloring logic is self-contained and parametrizable via `tone` prop. Grid layout uses Tailwind breakpoints (2–3 columns). Monitor performance with large metric arrays in real usage; may warrant memoization.

### ResourceIntensityGauge
**Status**: Not yet implemented.
**Plan**: Designed in spec §9 but not shipped in v1.5. Deferred to v1.6+ research features.

### WelcomeHeader
**Status**: Ready for extraction.
**API**: `WelcomeHeaderProps` (greeting string, className). Pure display component.
**Notes**: Editorial serif stack with responsive text sizing (`text-4xl md:text-5xl`). No dependencies. Extraction candidate for `@meaty/ui v0.4`.

### SynthesisQuote
**Status**: Not yet implemented.
**Plan**: Designed for Research Home surfaces. Deferred pending editorial/research API finalization. Likely a medium-complexity component once shipped; evaluate API before extraction.

### WorkspaceHealthGauge
**Status**: Shipped as skeleton (animated placeholder).
**API**: `WorkspaceHealthGaugeProps` (className). Currently renders a pulse animation pending v1.6 endpoint.
**Notes**: Extraction-ready now (skeleton code), but post-stabilization deferral allows real gauge implementation (score 0–100, delta rendering) to ship in v1.6. Extract together with real implementation if applicable.

## Target Extraction Plan

### Phase 1: Post-v1.5 Stabilization (Weeks 3–4)
- Monitor live Portal usage for 2+ weeks
- Document any API refinements needed
- Create PRs extracting low-effort components (SidebarFooter, StatusGroupSection, UrgencyBadge, WelcomeHeader)
- Target: `@meaty/ui v0.4` release

### Phase 2: Medium-Complexity (Weeks 5–6)
- Extract ContextRail + context hook
- Extract MetricsPanel (review delta logic in prod)
- Target: `@meaty/ui v0.5–v0.6` releases

### Phase 3: Research Features (v1.6+)
- Ship ResourceIntensityGauge (once designed)
- Finalize SynthesisQuote API (editorial + research corpus integration)
- Evaluate WorkspaceHealthGauge with real backend endpoint
- Plan v1.0+ extractions based on feature maturity

## Implementation Notes

### Code Comments
Add extraction-candidate TODOs to each component file. Example:

```typescript
/**
 * SidebarFooter — generic shell primitives.
 * 
 * TODO v1.6: Extract to @meaty/ui v0.4 post-stabilization.
 * Allow 2+ weeks live usage to validate API before extraction.
 */
```

### Token Handling
Components using portal design tokens (`--portal-urgency-warn`, etc.) will need:
- Option A: Accept token values as CSS variables in extraction (consumers define tokens)
- Option B: Move token definitions to `@meaty/ui` as part of extraction

Choose post-stabilization based on enterprise theming needs.

### Testing Before Extraction
- Run full E2E suite on extracted component in both Portal and standalone `@meaty/ui` storybook
- Verify dark mode, responsive behavior, accessibility (axe-core)
- Collect performance metrics (especially MetricsPanel with large datasets)

## No Blockers to Extraction

All candidates pass the "no portal-specific imports" audit:
- No `@/app/*` imports
- No `@/lib/artifact`, `@/lib/api`, `@/lib/hooks` portal integrations
- No portal schema dependencies
- No server-side rendering or Next.js API Route coupling

Extraction is purely a mechanical extraction-to-package operation; no architectural rework needed.

---

**Status**: Ready for Phase 7 sign-off.
**Next Review**: Post-v1.5 stabilization window (target: 2026-05-07).
