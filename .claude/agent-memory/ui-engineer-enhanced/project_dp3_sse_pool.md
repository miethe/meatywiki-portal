---
name: DP3 SSE pool and contract integration
description: SSEConnectionPool singleton created in DP3-04; pattern for multiplexed SSE on Workflow Status Surface
type: project
---

SSEConnectionPool singleton lives at `src/lib/sse/pool.ts` — deduplicates SSE connections per run_id, 100ms mount debounce, 500ms unmount debounce, max-6 browser limit safeguard.

**Why:** Stage Tracker manifest §3.3 requires one SSE connection per visible run across the app; RunSSEBridge (per-component) was creating duplicate connections.

**How to apply:** Use `RunSSEPoolBridge` (not `RunSSEBridge`) on any screen with multiple concurrent active runs. Import `ssePool` directly from `@/lib/sse/pool` only when you need `closeAll()` on route leave (as in workflows/page.tsx). The `useSSEPool` hook wraps pool subscribe for custom hooks. Guard: pool is inert in test/SSR environments (`typeof EventSource === "undefined"` check).
