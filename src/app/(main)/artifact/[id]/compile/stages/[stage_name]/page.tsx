/**
 * StageDetailPage — server component shell for the stage event log route.
 *
 * Route: /artifact/[id]/compile/stages/[stage_name]
 *
 * Responsibilities:
 *   - Unwrap the dynamic `params` promise (Next.js 15 App Router).
 *   - Pass `id` and `stageName` to the client island (StageDetailClient).
 *   - Zero data-fetching here; all live data comes via SSE in the client island.
 *
 * P3-03 — read-only stage event log (no editing surfaces, OQ-5 compliant).
 */

import { StageDetailClient } from "./StageDetailClient";

export default async function StageDetailPage({
  params,
}: {
  params: Promise<{ id: string; stage_name: string }>;
}) {
  const { id, stage_name } = await params;

  return <StageDetailClient id={id} stageName={stage_name} />;
}
