---
name: p2-03-field-editors
description: P2-03 option-driven field editors — ProjectComboboxField, TagEditorField, OptionSelectField + useFieldEditSave hook. Key patterns and gap notes.
metadata:
  type: project
---

## Files delivered

- `src/hooks/useFieldEditSave.ts` — thin adapter over useArtifactFieldSave; exposes `saveScalar(field, value)` and `saveTags(add, remove)`. ETag is fully threaded by the delegated hook; these new fields never touch the ETag directly.
- `src/components/inline-edit/fields/ProjectComboboxField.tsx` — @miethe/ui SearchableCombobox bound to useProjectOptions(); client-side filter; "No project" clearing sentinel; saving spinner overlay.
- `src/components/inline-edit/fields/TagEditorField.tsx` — local chip editor with suggestion dropdown filtered against useTagOptions(). Committed as the documented @miethe/ui gap (SearchableCombobox doesn't support multi-chip + create-new). Sends `tags_add` / `tags_remove` diff via `saveTags`.
- `src/components/inline-edit/fields/OptionSelectField.tsx` — @miethe/ui GroupedSelect for status/type/subtype/workspace/freshness_class/verification_status/publish_state. Dynamic fields (status, type, workspace) use the field-options hooks; others use static enum groups derived from ArtifactDetailClient constants.
- `src/components/inline-edit/fields/index.ts` — barrel re-export.

## ETag threading

`useFieldEditSave` delegates to `useArtifactFieldSave({ artifactId, showToast })`. The ETag is fetched on mount and forwarded as `If-Match` on every PATCH. Field components call `onSave(value)` → caller calls `saveScalar` or `saveTags` → `handleFieldSave` → `patchArtifact(..., etag)`. No field component bypasses the guard.

## @miethe/ui gap

TagEditorField uses a LOCAL suggestion listbox because SearchableCombobox is single-select only and doesn't support multi-chip accumulation or create-new flow. This is the only local primitive. Documented in component JSDoc.

## Option source hooks per field

| Field | Hook |
|---|---|
| project | useProjectOptions() |
| tags | useTagOptions() |
| status | useStatusOptions() (dynamic) |
| type | useArtifactTypeOptions() (dynamic, grouped by TYPE_GROUP_MAP) |
| workspace | useWorkspaceOptions() (dynamic) |
| subtype | static SUBTYPE_GROUPS |
| freshness_class | static FRESHNESS_GROUPS |
| verification_status | static VERIFICATION_GROUPS |
| publish_state | static PUBLISH_STATE_GROUPS |

**Why:** freshness/verify/publish_state/subtype have no dedicated field-options API endpoint yet; static groups derived from ArtifactDetailClient's existing constants.

**How to apply:** when backend adds dedicated enum endpoints for these fields, add hooks in useFieldOptions.ts and swap static groups for dynamic data in OptionSelectField.

## NOT wired to ArtifactDetailClient (P3 scope)

Per task spec, ArtifactDetailClient was not edited. These components are drop-in; the caller (P3) will swap the existing InlineSelect/InlineTextField usages for the new field components and pass `onSave` from `useFieldEditSave`.
