---
name: p2-02-artifact-search-dialog
description: P2-02 ArtifactSearchDialog — rich artifact picker dialog location, props API, and key implementation decisions
metadata:
  type: project
---

ArtifactSearchDialog is at `src/components/search/ArtifactSearchDialog.tsx`.
Local rich row: `src/components/search/ArtifactResultRow.tsx` (documented @miethe/ui gap — not in @miethe/ui primitives).

**Props API:**
- `open / onOpenChange` — controlled visibility (Dialog semantics)
- `onSelect: (artifacts: ArtifactCard[]) => void` — single always returns 1-element array; multi returns all confirmed selections
- `mode?: "single" | "multi"` — defaults to "single"
- `title?` — dialog heading; defaults to "Select artifact" / "Select artifacts"
- `searchMode?: "fts" | "semantic" | "hybrid"` — initial mode; degrades to fts on EmbeddingsNotReadyError
- `lockedTypes?: string[]` — pre-lock type filter (user can't change)
- `lockedWorkspaces?: string[]` — pre-lock workspace filter (user can't change)

**@miethe/ui imports used:**
- `Badge`, `ScrollArea`, `Popover/*` from `@miethe/ui/primitives`
- `TagFilterPopover`, `AvailableTag` from `@miethe/ui/filters`

**Local shadcn imports:** `Button`, `Input`, `Dialog/*` from `@/components/ui/`

**Filter wiring:**
- type / workspace: `StringFilterPopover` (local inline Popover — no @miethe/ui equivalent)
- tags: `TagFilterPopover` from `@miethe/ui/filters` — `AvailableTag.artifact_count` maps from `TagOption.count`
- All three filters applied client-side over fetched results (search() API has no filter params)
- Filter changes re-run search (no debounce — immediate)

**Pagination:** cursor-based via `search()` client; "Load more" button appends next page.

**Semantic degrade:** EmbeddingsNotReadyError → retry as fts silently + amber "Text-only" badge; `degraded: true` in response also sets badge.

**Keyboard:** ArrowDown/Up on search input moves `highlightedIndex`; Enter selects; Tab cycles filter controls; Esc handled by dialog.tsx portal.

**Why:** Tag filter on ArtifactCard is limited — card doesn't expose `tags[]` directly; tag matching uses series + owners as proxy. When backend extends ArtifactCard with tags, the filter block in filteredResults useMemo can be tightened.
