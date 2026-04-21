---
name: DP4-02c Research Home rich bento
description: Four bento components for Research Home per ADR-DPI-004; all backend endpoints missing (v1.6)
type: project
---

Commit a39892b ships all four ADR-DPI-004 bento components:

- `src/components/research/FeaturedTopicsGrid.tsx` — DP1-06 #1
- `src/components/research/EvidencePulsePanel.tsx` — DP1-06 #2 (New Evidence + Contradictions)
- `src/components/research/CrossEntitySynthesisTabs.tsx` — DP1-06 #4
- `src/components/research/TopicScopeDropdown.tsx` — DP1-06 #6

Composed into `src/app/(main)/research/pages/page.tsx` above the artifact filter/list secondary affordance. Topic scope dropdown sits in the bento header row (right-aligned). Layout preserved within the existing DP4-02b two-column rail structure.

**Why:** ADR-DPI-004 Option A (product-owner direction 2026-04-21) — ship full bento in v1.5.

**Missing endpoints (v1.6 — all components render skeletons + notices):**
- `GET /api/research/featured-topics` — topic ranking aggregate
- `GET /api/research/evidence-pulse/new` — time-decayed evidence feed
- `GET /api/research/evidence-pulse/contradictions` — contradiction feed
- `GET /api/research/cross-entity-synthesis` — cross-entity synthesis feed (?scope=concept_entity|concept_topic|entity_entity)
- `GET /api/topics` — topic list for dropdown

**How to apply:** When wiring up v1.6 backend endpoints, add hooks (e.g. `useFeaturedTopics`, `useEvidencePulse`, `useCrossEntitySynthesis`) and pass data via component props. The skeleton+notice pattern will auto-hide when non-undefined props are supplied.
