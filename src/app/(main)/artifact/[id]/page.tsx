/**
 * Artifact Detail screen — server component shell.
 *
 * Renders the ArtifactDetailClient island which handles all interactive
 * state: tab switching, data fetching, error/loading states, action buttons.
 *
 * Server component responsibilities:
 *   - Unwrap the dynamic `params` promise (Next.js 15 App Router)
 *   - Pass artifact `id` to the client island
 *
 * NOTE: No SSR prefetch of the artifact in P3-06. The client island fetches
 * via TanStack Query on mount. SSR prefetch can be added in P3-10 (performance
 * pass) using `dehydrate` + `HydrationBoundary`.
 *
 * Stitch references:
 *   - "Artifact Detail" (ID: 7b5a1a093d1c454c96c913367c7e60fe) — 3 tab states
 *   - "Research Artifact - Workflow OS Enhanced" (ID: ee5b9ed70061402c99b091998f9002d8)
 * Shell: Project Contextual (Detail variant — audit §2.1)
 *
 * P3-06: full implementation of readers, action buttons, HandoffChain, metadata.
 */

import { ArtifactDetailClient } from "./ArtifactDetailClient";

export default async function ArtifactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <ArtifactDetailClient id={id} />;
}
