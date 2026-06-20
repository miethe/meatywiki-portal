---
name: p3-connections-tab
description: P3-01/P3-02/P3-03 — option-driven field editing wired + Connections tab + add/remove flow; typecheck clean
metadata:
  type: project
---

## P3-01: Option-driven field editing in EditableMetadataSection

**What shipped**: In `src/app/(main)/artifact/[id]/ArtifactDetailClient.tsx`, the `EditableMetadataSection` component was updated to replace v1.8 `InlineSelect` / `InlineTextField` instances with the P2-03 primitives:

- `status` → `OptionSelectField field="status"` (dynamic options via useStatusOptions)
- `workspace` → `OptionSelectField field="workspace"` (dynamic via useWorkspaceOptions)
- `freshness_class` → `OptionSelectField field="freshness_class"` (static enum groups)
- `verification_status` → `OptionSelectField field="verification_status"` (static)
- `publish_state` → `OptionSelectField field="publish_state"` (static)
- `tags` → `TagEditorField` (diff-bridged: onSave receives tagsAdd/tagsRemove, assembles tags_add payload for handleFieldSave)
- `project` → `ProjectComboboxField` (type-to-filter dropdown over useProjectOptions)
- Free-text fields (title, description, series, domain, owners) kept as InlineTextField/InlineTextarea/InlineChipEditor

**ETag preservation**: all saves flow through the existing `handleFieldSave` (from `useArtifactFieldSave`), which owns ETag state. The P2-03 components call `onSave(field, value)` — ETag is threaded automatically at the hook layer. No direct ETag handling in the field components.

**Imports added**: `ProjectComboboxField`, `TagEditorField`, `OptionSelectField` from `@/components/inline-edit/fields`; `ConnectionsTab` from `@/components/artifact/ConnectionsTab`.

## P3-02: Connections tab

**Tab position**: "Connections" inserted as 3rd tab (after Knowledge, before Draft) in `BASE_TABS` in ArtifactDetailClient.

**Tab panel**: rendered with `hidden={activeTab !== "Connections"}` + lazy mount (`activeTab === "Connections" && <ConnectionsTab />`), consistent with Backlinks tab pattern.

**Component**: `src/components/artifact/ConnectionsTab.tsx`

- Data: `useArtifactEdges(artifactId)` → `{ incoming, outgoing }`
- Grouping: edges bucketed by edge type × direction; each group rendered as `EdgeGroupSection` with header showing direction icon + EdgeTypeBadge + count
- Cards: `ArtifactCard` (compact, list variant) for peers with resolved titles; `PeerStubCard` for peers not yet in the overlay
- Empty state: dashed border + "No connections yet" message

**ContextRail**: NOT changed (connections list in ContextRail is a separate surface).

## P3-03: Add/remove connection flow

**Add flow** (2-step):
1. "Add connection" button → `ArtifactSearchDialog` (mode="single")
2. On pick → `AddConnectionDialog` (custom Dialog) with edge type `Select` → confirm → `linkArtifact(artifactId, { target_id, edge_type })` → refetch + toast

**Remove**: each card/stub has a `Trash2` button → `unlinkEdge(sourceId, targetId, { edgeType })`.
  - Outgoing edge: source=artifactId, target=peerId
  - Incoming edge: source=peerId, target=artifactId (correct direction for DELETE endpoint)

**State**: `removingKey` string (`"<direction>:<edgeType>:<peerId>"`) drives per-card loading spinner; `isSubmitting` guards the confirm dialog.

**Toasts**: inline in ConnectionsTab (same pattern as ToastBanner in ArtifactDetailClient but self-contained; no external dep).

## Key implementation notes

- `DialogFooter` does NOT exist in `src/components/ui/dialog.tsx` — use a plain `div` with `flex justify-end gap-2` instead (discovered at typecheck)
- `useFieldEditSave` from `@/hooks/useFieldEditSave` was NOT needed in ArtifactDetailClient since P2-03 fields wire through the existing `onSave` prop; import was removed
- Typecheck clean (tsc --noEmit exits 0) after all 3 tasks

**Why**: Closes the v2.6 relational UX gap-cells for field-editor UX (P3-01), connection visibility (P3-02), and end-to-end connection CRUD (P3-03).

**How to apply**: If mounting ContextRail tests, mock `useArtifactEdges` — it's now also used in ConnectionsTab. Any test mounting `EditableMetadataSection` now needs `useProjectOptions`/`useStatusOptions`/`useWorkspaceOptions`/`useTagOptions` mocks (all from `@/hooks/useFieldOptions`).
