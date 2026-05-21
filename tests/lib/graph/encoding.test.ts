/**
 * Unit tests for src/lib/graph/encoding/index.ts
 *
 * Coverage:
 *  - resolveNodeSize: fidelity buckets (5 discrete steps), degree log-scale,
 *    highlighted multiplier, null/undefined defaults
 *  - resolveNodeOpacity: all freshness classes, null default
 *  - hasUncertaintyRing: threshold at 0.7, null/undefined safe
 *  - resolveEdgeSize: formula 1 + confidence * 2, null default
 *  - isSemanticEdge: semantic_similar, semantic_* prefix, non-semantic types
 *  - resolveNodeColor: artifact_type mode, workspace mode, lens mode
 *  - resolveEdgeColor: known and unknown edge types
 */

import {
  resolveNodeColor,
  resolveNodeSize,
  resolveNodeOpacity,
  hasUncertaintyRing,
  resolveEdgeSize,
  isSemanticEdge,
  resolveEdgeColor,
  RING_SIZE_SCALE,
} from "@/lib/graph/encoding";

// ---------------------------------------------------------------------------
// resolveNodeSize — fidelity mode
// ---------------------------------------------------------------------------

describe("resolveNodeSize — fidelity mode", () => {
  const cases: [string, number][] = [
    ["F0", 4],
    ["F1", 6],
    ["F2", 7],
    ["F3", 9],
    ["F4", 10],
  ];

  test.each(cases)("fidelity %s → size %i", (level, expected) => {
    expect(resolveNodeSize(level as "F0" | "F1" | "F2" | "F3" | "F4", 0, "fidelity")).toBe(expected);
  });

  test("null fidelity_level defaults to F2 size (7)", () => {
    expect(resolveNodeSize(null, 0, "fidelity")).toBe(7);
  });

  test("undefined fidelity_level defaults to F2 size (7)", () => {
    expect(resolveNodeSize(undefined, 0, "fidelity")).toBe(7);
  });

  test("highlighted node is 1.5× base size", () => {
    expect(resolveNodeSize("F2", 0, "fidelity", true)).toBeCloseTo(10.5, 5);
    expect(resolveNodeSize("F0", 0, "fidelity", true)).toBeCloseTo(6, 5);
    expect(resolveNodeSize("F4", 0, "fidelity", true)).toBeCloseTo(15, 5);
  });
});

// ---------------------------------------------------------------------------
// resolveNodeSize — degree mode
// ---------------------------------------------------------------------------

describe("resolveNodeSize — degree mode", () => {
  test("degree 0 → floor clamped to 5 (reduced 2026-05-21 for tighter clusters)", () => {
    // log2(1) = 0, 0 * 2.5 = 0, clamp to 5
    expect(resolveNodeSize(null, 0, "degree")).toBe(5);
  });

  test("degree 1 → log2(2) * 2.5 = 2.5, clamped to 5 floor", () => {
    expect(resolveNodeSize(null, 1, "degree")).toBe(5);
  });

  test("degree 7 → log2(8) * 2.5 = 7.5", () => {
    expect(resolveNodeSize(null, 7, "degree")).toBeCloseTo(7.5, 1);
  });

  test("degree 1000 → clamped to 12", () => {
    // log2(1001) ≈ 9.97, 9.97 * 2.5 ≈ 24.9, clamped to 12
    expect(resolveNodeSize(null, 1000, "degree")).toBe(12);
  });

  test("fidelity_level param ignored in degree mode", () => {
    const withF0 = resolveNodeSize("F0", 7, "degree");
    const withF4 = resolveNodeSize("F4", 7, "degree");
    expect(withF0).toBeCloseTo(withF4, 5);
  });
});

// ---------------------------------------------------------------------------
// resolveNodeOpacity — freshness class
// ---------------------------------------------------------------------------

describe("resolveNodeOpacity", () => {
  test("current → 1.0", () => {
    expect(resolveNodeOpacity("current")).toBe(1.0);
  });

  test("aging → 0.65", () => {
    expect(resolveNodeOpacity("aging")).toBe(0.65);
  });

  test("stale → 0.35", () => {
    expect(resolveNodeOpacity("stale")).toBe(0.35);
  });

  test("null → 0.8", () => {
    expect(resolveNodeOpacity(null)).toBe(0.8);
  });

  test("undefined → 0.8", () => {
    expect(resolveNodeOpacity(undefined)).toBe(0.8);
  });
});

// ---------------------------------------------------------------------------
// hasUncertaintyRing
// ---------------------------------------------------------------------------

describe("hasUncertaintyRing", () => {
  test("confidence 0.69 → ring shown", () => {
    expect(hasUncertaintyRing(0.69)).toBe(true);
  });

  test("confidence exactly 0.7 → no ring (boundary: must be strictly <)", () => {
    expect(hasUncertaintyRing(0.7)).toBe(false);
  });

  test("confidence 0.71 → no ring", () => {
    expect(hasUncertaintyRing(0.71)).toBe(false);
  });

  test("confidence 0.0 → ring shown", () => {
    expect(hasUncertaintyRing(0.0)).toBe(true);
  });

  test("confidence 1.0 → no ring", () => {
    expect(hasUncertaintyRing(1.0)).toBe(false);
  });

  test("null → no ring (safe default: assume confident)", () => {
    expect(hasUncertaintyRing(null)).toBe(false);
  });

  test("undefined → no ring (safe default)", () => {
    expect(hasUncertaintyRing(undefined)).toBe(false);
  });

  test("RING_SIZE_SCALE constant is > 1", () => {
    expect(RING_SIZE_SCALE).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// resolveEdgeSize — formula 1 + confidence * 2
// ---------------------------------------------------------------------------

describe("resolveEdgeSize", () => {
  test("confidence 0 → size 1.0", () => {
    expect(resolveEdgeSize(0)).toBeCloseTo(1.0, 5);
  });

  test("confidence 1 → size 3.0", () => {
    expect(resolveEdgeSize(1)).toBeCloseTo(3.0, 5);
  });

  test("confidence 0.5 → size 2.0", () => {
    expect(resolveEdgeSize(0.5)).toBeCloseTo(2.0, 5);
  });

  test("null → default 0.25 → size 1.5", () => {
    expect(resolveEdgeSize(null)).toBeCloseTo(1.5, 5);
  });

  test("undefined → default 0.25 → size 1.5", () => {
    expect(resolveEdgeSize(undefined)).toBeCloseTo(1.5, 5);
  });

  test("values > 1 are clamped to 1 before formula", () => {
    // clamp(1.5) = 1, 1 + 1 * 2 = 3
    expect(resolveEdgeSize(1.5)).toBeCloseTo(3.0, 5);
  });

  test("values < 0 are clamped to 0 before formula", () => {
    // clamp(-0.5) = 0, 1 + 0 * 2 = 1
    expect(resolveEdgeSize(-0.5)).toBeCloseTo(1.0, 5);
  });
});

// ---------------------------------------------------------------------------
// isSemanticEdge — dashed predicate
// ---------------------------------------------------------------------------

describe("isSemanticEdge", () => {
  test("semantic_similar → true", () => {
    expect(isSemanticEdge("semantic_similar")).toBe(true);
  });

  test("semantic_context → true (semantic_ prefix)", () => {
    expect(isSemanticEdge("semantic_context")).toBe(true);
  });

  test("semantic_ prefix matches any suffix", () => {
    expect(isSemanticEdge("semantic_xyz_future")).toBe(true);
  });

  test("derived_from → false", () => {
    expect(isSemanticEdge("derived_from")).toBe(false);
  });

  test("relates_to → false", () => {
    expect(isSemanticEdge("relates_to")).toBe(false);
  });

  test("contains → false", () => {
    expect(isSemanticEdge("contains")).toBe(false);
  });

  test("empty string → false", () => {
    expect(isSemanticEdge("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resolveNodeColor
// ---------------------------------------------------------------------------

describe("resolveNodeColor — artifact_type mode", () => {
  test("known type concept → indigo-ish blue", () => {
    const color = resolveNodeColor("concept", "wiki", null, null, "artifact_type");
    expect(color).toBe("#3b82f6");
  });

  test("unknown type → default slate-500", () => {
    const color = resolveNodeColor("unknown_future_type", "wiki", null, null, "artifact_type");
    expect(color).toBe("#64748b");
  });
});

describe("resolveNodeColor — workspace mode", () => {
  test("wiki → sky-700", () => {
    const color = resolveNodeColor("concept", "wiki", null, null, "workspace");
    expect(color).toBe("#0369a1");
  });

  test("research → purple-700", () => {
    const color = resolveNodeColor("concept", "research", null, null, "workspace");
    expect(color).toBe("#7e22ce");
  });

  test("unknown workspace → default slate-500", () => {
    const color = resolveNodeColor("concept", "unknown_ws", null, null, "workspace");
    expect(color).toBe("#64748b");
  });
});

describe("resolveNodeColor — lens mode", () => {
  test("lens mode, score 0.0 → hue near 220 (blue range)", () => {
    const color = resolveNodeColor("concept", "wiki", { depth: 0 }, "depth", "lens");
    // HSL hue ≈ 220 at score 0
    expect(color).toMatch(/^hsl\(220,/);
  });

  test("lens mode, score 1.0 → hue 0 (red)", () => {
    const color = resolveNodeColor("concept", "wiki", { depth: 1 }, "depth", "lens");
    expect(color).toMatch(/^hsl\(0,/);
  });

  test("lens mode, score 0.5 → hue 110 (green range)", () => {
    const color = resolveNodeColor("concept", "wiki", { depth: 0.5 }, "depth", "lens");
    expect(color).toMatch(/^hsl\(110,/);
  });

  test("lens mode, null scores → falls back to artifact_type color", () => {
    const color = resolveNodeColor("concept", "wiki", null, "depth", "lens");
    expect(color).toBe("#3b82f6");
  });

  test("lens mode, score missing for selected lens → default slate", () => {
    const color = resolveNodeColor("concept", "wiki", { other: 0.5 }, "depth", "lens");
    expect(color).toBe("#64748b");
  });

  test("lens mode, null selectedLens → falls back to artifact_type", () => {
    const color = resolveNodeColor("concept", "wiki", { depth: 0.5 }, null, "lens");
    expect(color).toBe("#3b82f6");
  });
});

// ---------------------------------------------------------------------------
// resolveEdgeColor
// ---------------------------------------------------------------------------

describe("resolveEdgeColor", () => {
  test("derived_from → indigo-600", () => {
    expect(resolveEdgeColor("derived_from")).toBe("#4f46e5");
  });

  test("semantic_similar → fuchsia-700", () => {
    expect(resolveEdgeColor("semantic_similar")).toBe("#a21caf");
  });

  test("unknown edge type → default slate-500", () => {
    expect(resolveEdgeColor("future_unknown_type")).toBe("#64748b");
  });
});
