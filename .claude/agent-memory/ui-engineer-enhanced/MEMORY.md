# UI Engineer Enhanced — Memory Index

- [Portal v1.5 P2 workflow viewer state](project_p2_workflow_viewer.md) — Screen B implementation state and pre-existing breaks from parallel tasks
- [Portal v1.5 P2 Initiation Wizard](project_p2_initiation_wizard.md) — P1.5-2-03 wizard: custom Dialog, hook mocking strategy, RoutingRecommendationCard location
- [DP3 SSE pool and contract integration](project_dp3_sse_pool.md) — SSEConnectionPool singleton (pool.ts) + RunSSEPoolBridge pattern for multiplexed SSE on dashboard
- [DP4-02b context rail](project_dp4_context_rail.md) — ContextRail inline rail on 4 surfaces; mock useArtifactEdges in any test mounting it; v1.6 needs lineage+evidence endpoints
- [DP4-02a ADR-DPI-001 gap closure](project_dp4_02a_adr_dpi_001.md) — All 11 gap cells closed; only Review Queue Stage Tracker was open when task ran (ffeb269)
- [DP4-02c Research Home bento](project_dp4_02c_bento.md) — 4 bento components in src/components/research/; all 5 backend endpoints missing (v1.6 skeletons)
- [DP4-02d Synthesis Builder wizard](project_dp4_02d_synthesis_wizard.md) — 2-step wizard (d3a15ae); type/depth/tone/constraints collected but not yet consumed by backend (SynthesizeParams has fields, banner shown)
- [Portal v2.5 OVLY-002/003/004 FloatingPanel migrations](project_v25_ovly_002_004.md) — Filters (top-left, F), Legend (bottom-left, L), Actions (top-right, A) migrated; ZoomControls inlined; FilterSidebar import removed
- [DI-080 bulk-compile batch aggregation](project_di080_bulk_compile.md) — useCompileBatch hook + InboxBatchCompileHeader + InboxClient wiring; 9 unit tests pass; 4 E2E specs parse cleanly
- [P2-01 ArtifactPeekModal](project_p2_01_artifact_peek_modal.md) — context API shape, tabs (knowledge/source/connections), ?peek deep-link via searchParams; provider NOT yet mounted in layout
- [P2-02 ArtifactSearchDialog](project_p2_02_artifact_search_dialog.md) — rich picker dialog in src/components/search/; props API, filter wiring, @miethe/ui imports, pagination/degrade strategy
- [P2-03 Option-driven field editors](project_p2_03_field_editors.md) — 3 field components in src/components/inline-edit/fields/ + useFieldEditSave hook; ETag via useArtifactFieldSave delegation; @miethe/ui gap noted for TagEditorField
- [P3-01/P3-02/P3-03 Connections tab + field editing](project_p3_connections_tab.md) — OptionSelectField/TagEditorField/ProjectComboboxField wired in EditableMetadataSection; Connections tab (3rd position); add/remove flow via ArtifactSearchDialog + linkArtifact/unlinkEdge; DialogFooter absent from ui/dialog.tsx
- [P3-04/P3-05 Backlinks repair + peek-modal nav](project_p3_04_05_backlinks_peek.md) — Backlinks: BacklinkRow renders button (onPeek) vs Link; Processing: empty state explains vault-reconciled gap; ConnectionsTab + BacklinksTab wire openPeek from useArtifactPeek; ContextRail untouched
