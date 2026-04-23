---
title: Storybook Deferral & Component Inventory
description: Deferral rationale for Storybook setup and inventory of components requiring stories post-implementation.
audience: developers
tags:
  - storybook
  - component-documentation
  - deferral
  - portal-v1.5-stitch-reskin
created: 2026-04-23
updated: 2026-04-23
category: documentation
status: deferred
feature: portal-v1.5-stitch-reskin
related_documents:
  - docs/EXTRACTION.md
  - ../meatywiki/docs/project_plans/llm_wiki/portal/PRDs/portal-v1.5-stitch-reskin.md
---

# Storybook Deferral & Component Inventory

## 1. Deferral Rationale

**Storybook is not set up in the v1.5 portal codebase.** Introducing Storybook infrastructure (`.storybook/` configuration, build tooling, deployment pipeline, story authoring) represents a **multi-day lift** that is out of scope for the personal-use Portal v1.5 Stitch Reskin.

### Why Defer

- **Portal audience**: v1.5 is a single-user, personal knowledge system. There is no active design team, product manager, or stakeholder audience who would benefit from Storybook during active development.
- **Component stabilization first**: Portal v1.5 components ship to production and receive real-world usage feedback. Storybook stories authored *before* stabilization risk becoming outdated as APIs refine and bugs surface.
- **Extraction prerequisite**: Many v1.5 components are extraction candidates for the shared `@meaty/ui` package (see `docs/EXTRACTION.md`). Extracting first, then authoring stories for the extracted package, is more efficient than writing twice.
- **v1.6 alignment**: Storybook introduction is planned alongside `@meaty/ui` extraction and formalized design-system governance in v1.6+ work.

### Post-v1.5 Plan

1. **Stabilization window** (2+ weeks post-v1.5 ship): Let components run in production; collect feedback and refine APIs.
2. **Component extraction** (v1.6): Extract "high-readiness" components (ContextRail, UrgencyBadge, StatusGroupSection, SidebarFooter, MetricsPanel, WelcomeHeader) to `@meaty/ui`.
3. **Storybook setup** (v1.6+): Install Storybook in the UI package; author stories for extracted components and portal-specific overrides.
4. **Design system governance**: Establish story authoring standards, dark-mode testing, responsive behavior coverage, and accessibility verification per v1.6 design-system spec.

---

## 2. Component Inventory Requiring Stories (Post-Storybook Setup)

The following components, developed in Portal v1.5 Phases 1–6, require Storybook stories once Storybook infrastructure is available.

### Artifact Components (`src/components/artifact/`)

- `HandoffChain.tsx`
- `activity-timeline.tsx`
- `artifact-body.tsx`
- `artifact-title-block.tsx`
- `assessment-modal.tsx`
- `contradiction-flag.tsx`
- `freshness-badge.tsx`
- `handoff-chain-ribbon.tsx`
- `lens-radar-chart.tsx`
- `quality-gate-indicator.tsx`
- `routing-recommendation-card.tsx`

### Blog Components (`src/components/blog/`)

- `blog-editor.tsx`
- `blog-outline-builder.tsx`
- `blog-post-card-skeleton.tsx`
- `blog-post-card.tsx`

### Home Components (`src/components/home/`)

- `home-context-rail-content.tsx`
- `recent-captures-section.tsx`
- `status-strip.tsx`

### Inbox Components (`src/components/inbox/`)

- `InboxContextRail.tsx`
- `smart-triage-button.tsx`

### Layout Components (`src/components/layout/`)

- `ContextRail.tsx`

### Library Components (`src/components/library/`)

- `artifact-card.tsx`
- `thumbnail-fallback.tsx`

### Providers & PWA (`src/components/providers/`, `src/components/pwa/`)

- `query-provider.tsx`
- `offline-queue-sync.tsx`
- `pwa-providers.tsx`
- `service-worker-register.tsx`

### Quick Add Components (`src/components/quick-add/`)

- `audio-recorder.tsx`
- `quick-add-modal.tsx`

### Research Components (`src/components/research/`)

- `ContradictionsCallout.tsx`
- `CrossEntitySynthesisTabs.tsx`
- `EvidencePulsePanel.tsx`
- `FeaturedTopicsGrid.tsx`
- `NewEvidenceColumn.tsx`
- `PriorityTopicsGrid.tsx`
- `ResearchWorkspaceEmpty.tsx`
- `SynthesisArtifactPicker.tsx`
- `SynthesisNarrative.tsx`
- `SynthesisParameterPanel.tsx`
- `SynthesisScopeRailPanel.tsx`
- `SynthesisTypeBento.tsx`
- `TopicScopeDropdown.tsx`
- `WorkspaceHealthGauge.tsx`
- `backlinks-panel.tsx`
- `review-queue.tsx`
- `synthesis-builder.tsx`

### Shell Components (`src/components/shell/`)

- `unified-shell.tsx`
- `welcome-header.tsx`

### UI Components (Primitives & Tokens) (`src/components/ui/`)

- `archive-brand-lockup.tsx`
- `artifact-card-skeleton.tsx`
- `artifact-card.tsx`
- `breadcrumbs.tsx`
- `context-rail-context.tsx`
- `context-rail-section.tsx`
- `context-rail.tsx`
- `derivative-count-badge.tsx`
- `dialog.tsx`
- `facet-badge.tsx`
- `lens-badge.tsx`
- `library-filter-bar.tsx`
- `library-lens-switcher.tsx`
- `metrics-panel.tsx`
- `scroll-area.tsx`
- `separator.tsx`
- `sidebar-footer.tsx`
- `status-group-section.tsx`
- `type-badge.tsx`
- `urgency-badge.tsx`
- `workflow-status-badge.tsx`
- `workspace-badge.tsx`

### Workflow Components (`src/components/workflow/`)

- `active-workflow-card.tsx`
- `derivatives-list.tsx`
- `lens-badge-set.tsx`
- `run-sse-bridge.tsx`
- `run-sse-pool-bridge.tsx`
- `stage-tracker.tsx`
- `workflow-os-tab.tsx`
- `workflow-status-panel.tsx`
- `workflow-top-bar-indicator.tsx`

### Workflow Initiation Wizard (`src/components/workflow/initiation-wizard/`)

- `initiation-wizard-dialog.tsx`
- `initiation-wizard.tsx`
- `step-1-source.tsx`
- `step-2-routing.tsx`
- `step-3-configure.tsx`
- `wizard-stepper.tsx`

### Workflow Templates (`src/components/workflow-templates/`)

- `TemplateEditorDialog.tsx`
- `TemplateList.tsx`
- `DeleteTemplateDialog.tsx`

### Workflow Viewer (`src/components/workflow/viewer/`)

- `artifact-lineage-graph.tsx`
- `run-history-list.tsx`
- `stage-context-panel.tsx`
- `timeline-panel.tsx`
- `workflow-viewer-screen.tsx`

---

## 3. Per-Story Requirements (Post-Storybook)

When Storybook stories are authored, each component should include the following (per phase-7-validation-and-docs.md §"Storybook Stories Checklist"):

- **Default variant/story**: Most common usage
- **All variants** (if component has `variant` prop):
  - Examples: ArtifactCard (standard, featured, compact, hero)
  - ContextRail (expanded, collapsed)
  - StatusGroupSection (NEW, NEEDS_COMPILE, NEEDS_DESTINATION)
  - UrgencyBadge (urgency levels 1–5)
- **Dark mode story**: Toggle dark class in Storybook decorator
- **Responsive story** (if applicable): Show behavior at <1280px, 768px, and >1024px viewpoints
- **Loading/skeleton state** (if applicable): Loading spinners, skeleton screens (e.g., artifact-card-skeleton)
- **Error state** (if applicable): Error messaging, fallback UI
- **Code example / Controls panel**: Props documentation, code snippets in Docs tab

### Example Story Structure

```tsx
export default {
  title: 'Components/ContextRail',
  component: ContextRail,
};

export const Default = () => <ContextRail {...defaultProps} />;
export const Compact = () => <ContextRail width={280} {...defaultProps} />;
export const DarkMode = () => (
  <div className="dark">
    <ContextRail {...defaultProps} />
  </div>
);
export const MobileCollapsed = () => (
  <div style={{ width: '375px' }}>
    <ContextRail {...defaultProps} />
  </div>
);
```

---

## 4. Next Steps

1. **Stabilization window** (2+ weeks post-v1.5 ship, late May 2026):
   - Monitor component usage in production Portal.
   - Collect feedback on APIs, visual fidelity, and edge cases.
   - Refine component interfaces and fix bugs discovered in real usage.

2. **Component extraction** (v1.6 planning, early June 2026):
   - Evaluate all "high-readiness" candidates listed in `docs/EXTRACTION.md`.
   - Extract stable components to `@meaty/ui` package.
   - Update Portal to consume extracted versions.

3. **Storybook setup** (v1.6, mid-June 2026):
   - Install Storybook in `@meaty/ui` package (or maintain in Portal and link via monorepo config).
   - Create `.storybook/` configuration with Tailwind, dark-mode addons, viewport presets.
   - Author stories for all extracted components using the checklist above.

4. **Design system governance** (v1.6+):
   - Establish story authoring standards and review process.
   - Integrate axe-core accessibility checks into Storybook via `@storybook/addon-a11y`.
   - Publish Storybook to static host (GitHub Pages, Vercel, Chromatic).
   - Link from `README.md` and contribution guidelines.

---

## References

- **Extraction Plan**: `docs/EXTRACTION.md` — candidates, effort estimates, and post-extraction plan
- **Phase 7 Plan**: `../meatywiki/docs/project_plans/llm_wiki/portal/implementation-plans/portal-v1.5-stitch-reskin/phase-7-validation-and-docs.md` — full Storybook checklist (§"Storybook Stories Checklist")
- **Portal v1.5 PRD**: `../meatywiki/docs/project_plans/llm_wiki/portal/PRDs/portal-v1.5-stitch-reskin.md` — component list and feature scope
