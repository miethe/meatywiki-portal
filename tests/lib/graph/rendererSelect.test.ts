import {
  selectRenderer,
  EXTREME_SCALE_THRESHOLD,
} from "@/lib/graph/rendererSelect";

describe("selectRenderer", () => {
  it("returns 'sigma' when nodeCount is 0", () => {
    expect(selectRenderer({ nodeCount: 0 })).toBe("sigma");
  });

  it("returns 'sigma' when nodeCount is well below threshold", () => {
    expect(selectRenderer({ nodeCount: 1_000 })).toBe("sigma");
  });

  it("returns 'sigma' when nodeCount is one below threshold", () => {
    expect(selectRenderer({ nodeCount: EXTREME_SCALE_THRESHOLD - 1 })).toBe("sigma");
  });

  it("returns 'cosmos' when nodeCount equals the threshold exactly", () => {
    // At exactly 15 000 nodes, cosmos activates (>= threshold)
    expect(selectRenderer({ nodeCount: EXTREME_SCALE_THRESHOLD })).toBe("cosmos");
  });

  it("returns 'cosmos' when nodeCount exceeds threshold", () => {
    expect(selectRenderer({ nodeCount: EXTREME_SCALE_THRESHOLD + 1 })).toBe("cosmos");
  });

  it("returns 'cosmos' for extreme-scale vaults (100K nodes)", () => {
    expect(selectRenderer({ nodeCount: 100_000 })).toBe("cosmos");
  });

  it("EXTREME_SCALE_THRESHOLD is 15000", () => {
    // Pin the constant value so a refactor is caught by tests.
    expect(EXTREME_SCALE_THRESHOLD).toBe(15_000);
  });
});
