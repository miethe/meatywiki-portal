---
name: p2-01-artifact-peek-modal
description: P2-01 ArtifactPeekModal + ArtifactPeekProvider implementation — context API shape, tabs, deep-link mechanism
metadata:
  type: project
---

## ArtifactPeekModal (P2-01 — Portal v2.6 Relational UX)

Two files shipped (tsc clean):

- `src/components/artifact/ArtifactPeekModal.tsx` — lightweight modal wrapping `@miethe/ui` `BaseArtifactModal`
- `src/components/artifact/ArtifactPeekProvider.tsx` — context + deep-link wiring

### Context API

```ts
// useArtifactPeek() returns:
interface ArtifactPeekContextValue {
  peekId: string | null;           // currently open artifact ID (null = closed)
  openPeek(id, opts?): void;       // opts.shallow=true skips URL update
  closePeek(): void;               // removes ?peek param via router.replace
}
```

Provider: `<ArtifactPeekProvider>` — mount once in app shell (deferred to later stage; not yet in layout.tsx).

### Tabs Rendered

| Tab value | Label | Condition |
|---|---|---|
| `knowledge` | Knowledge | Always shown |
| `source` | Source | Only for `raw_*` / `source_summary` types |
| `connections` | Connections | Always shown (uses `useArtifactEdges`) |

Data: `useArtifact(id)` + `useArtifactEdges(id)`. Summary from `artifact.summary` rendered above tabs via `aboveTabsContent` slot.

### Deep-link Mechanism

- `openPeek(id)` → `router.push(?peek=<id>)` — adds history entry
- `closePeek()` → `router.replace(URL without ?peek)` — no extra history entry
- On load: `searchParams.get("peek")` is the single source of truth for `peekId`
- `ArtifactPeekModal` receives `open={peekId !== null}` and `onClose={closePeek}`

### OQ-2 Compliance

Provider does NOT intercept `<Link>` navigation. Only responds to `openPeek()` calls and `?peek=` param. Full-page nav for sidebar/rail/explicit links is unchanged.

**Why:** OQ-2 specifies content-context opens only; full-page nav must not regress.

**How to apply:** Any surface wiring `openPeek()` must be a non-link element (button, card row, etc.). Do not call `openPeek` from link `onClick` — let the link navigate normally.

### Expand Button

`headerActions` slot renders an "Expand" `<button>` that calls `onClose()` + `router.push(/artifact/:id)`. Button is `disabled` while artifact data is loading.

### Provider Mounting

NOT yet mounted in app shell layout — flagged as a later stage in v2.6. To activate: add `<ArtifactPeekProvider>` to `src/app/(main)/layout.tsx` (requires `<Suspense>` boundary wrapping the subtree that calls `useSearchParams`).
