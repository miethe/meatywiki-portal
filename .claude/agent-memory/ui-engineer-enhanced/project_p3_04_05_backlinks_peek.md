---
name: p3-04-05-backlinks-peek
description: P3-04 Backlinks render fix + Processing empty state; P3-05 peek-modal nav wired to ConnectionsTab and BacklinksTab
metadata:
  type: project
---

## P3-04: Backlinks/Processing repair

**Backlinks** — data existed, render was the fix. `BacklinkRow` now takes `onPeek?: (id: string) => void`. When present, title/id renders as `<button onClick={() => onPeek(id)}>` instead of `<Link>`. `BacklinksSection` propagates it. `BacklinksTab` calls `useArtifactPeek().openPeek` and passes it to all three render paths (split incoming/outgoing sections + flat list).

**Processing** — genuine remote-data gap (vault-reconciled artifacts never compiled). `ProcessingHistoryTab.EmptyState` copy updated: "No pipeline events recorded. This artifact was imported directly from the vault and has not been processed by the compilation pipeline. Events are only recorded when an artifact is compiled via 'Compile' or ingested through Quick Add."

**Why:** Node has 0 workflow_events; every artifact returns 200-but-empty from `/processing-history`. Old copy said "yet" implying a loading delay.

**How to apply:** If asked about Processing tab empty state in future, the copy is definitive as of 2026-06-19.

## P3-05: Peek-modal navigation

`ConnectionsTab` — added `onPeek?: (id: string) => void` to `ConnectionsTabProps`, threaded through `EdgeGroupSection` → `ConnectionCard` → `ArtifactCard onPeek` prop. `ArtifactDetailClient` calls `useArtifactPeek()` at component level and passes `openPeek` to `ConnectionsTab`.

`BacklinksTab` (inside ArtifactDetailClient.tsx) — calls `useArtifactPeek()` locally; passes `openPeek` as `onPeek` to `BacklinksSection` and flat `BacklinkRow` list.

**ContextRail and breadcrumb links are intentionally untouched** — OQ-2 requires sidebar/rail stay full-page.

**Why:** OQ-2 constraint: sidebar/rail full-page navigation; content-area cards open peek modal.

**How to apply:** When adding new surfaces that should open peek, wire `useArtifactPeek().openPeek` as `onPeek` to `ArtifactCard` or comparable row. Do NOT touch ContextRail navigation.
