/**
 * layout3d.ts — API client for the POST /api/portal/graph/layout-3d endpoint.
 *
 * Fetches server-precomputed 3D positions for a given snapshot_id.
 *
 * Contract (from portal-v2.5-graph-immersive phase plan REND-003):
 *   POST /api/portal/graph/layout-3d
 *   Body: { snapshot_id: string }
 *   200 OK → { snapshot_id: string; node_count: number; positions: NodePosition3D[] }
 *   422 → { auto_degrade: true } when N > 15 000 nodes
 *
 * Implements: REND-003 / REND-004 (portal-v2.5-graph-immersive, Phase 4)
 */

export interface NodePosition3D {
  node_id: string;
  x: number;
  y: number;
  z: number;
}

export interface Layout3DResponse {
  snapshot_id: string;
  node_count: number;
  positions: NodePosition3D[];
}

/**
 * Thrown when the server returns 422 with auto_degrade: true.
 * The caller (REND-004) should catch this and show the degradation toast.
 */
export class AutoDegradeError extends Error {
  readonly auto_degrade = true;
  constructor() {
    super("Graph is too large for 3D mode (>15,000 nodes).");
    this.name = "AutoDegradeError";
  }
}

/**
 * Request a 3D layout from the backend for the given snapshot.
 *
 * @throws AutoDegradeError when the graph exceeds the 3D node cap
 * @throws Error on network or server errors
 */
export async function fetchLayout3D(snapshotId: string): Promise<Layout3DResponse> {
  const res = await fetch("/api/portal/graph/layout-3d", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ snapshot_id: snapshotId }),
  });

  if (res.status === 422) {
    const body = await res.json().catch(() => ({}));
    if (body?.auto_degrade === true) {
      throw new AutoDegradeError();
    }
    throw new Error(`Unexpected 422 from layout-3d: ${JSON.stringify(body)}`);
  }

  if (!res.ok) {
    throw new Error(`layout-3d request failed: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<Layout3DResponse>;
}
