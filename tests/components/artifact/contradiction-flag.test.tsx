/**
 * Tests for ContradictionFlag and ContradictionFlagPure (P4-04).
 *
 * Covers:
 *   - ContradictionFlagPure: renders when count > 0, hides when count === 0
 *   - ContradictionFlagPure: tooltip text includes the count
 *   - ContradictionFlagPure: aria-label carries the count
 *   - ContradictionFlagPure: singular vs plural label grammar
 *   - ContradictionFlag: renders when useContradictionCount returns count > 0
 *   - ContradictionFlag: renders nothing while loading
 *   - ContradictionFlag: renders nothing when count is 0
 *   - ContradictionFlag: renders nothing on error (SC-P4-5)
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import {
  ContradictionFlag,
  ContradictionFlagPure,
} from "@/components/artifact/contradiction-flag";

// ---------------------------------------------------------------------------
// Mock useContradictionCount — decouple from real fetch
// ---------------------------------------------------------------------------

jest.mock("@/hooks/useContradictionCount", () => ({
  useContradictionCount: jest.fn(),
}));

import { useContradictionCount } from "@/hooks/useContradictionCount";
const mockUseContradictionCount = useContradictionCount as jest.MockedFunction<
  typeof useContradictionCount
>;

// ---------------------------------------------------------------------------
// ContradictionFlagPure — pure display variant tests
// ---------------------------------------------------------------------------

describe("ContradictionFlagPure — rendering", () => {
  it("renders nothing when contradictionCount is 0", () => {
    const { container } = render(<ContradictionFlagPure contradictionCount={0} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a warning chip when contradictionCount is 1", () => {
    render(<ContradictionFlagPure contradictionCount={1} />);
    expect(screen.getByText(/1 conflict/i)).toBeInTheDocument();
  });

  it("renders a warning chip when contradictionCount > 1", () => {
    render(<ContradictionFlagPure contradictionCount={3} />);
    expect(screen.getByText(/3 conflicts/i)).toBeInTheDocument();
  });

  it("uses singular 'conflict' for count === 1", () => {
    render(<ContradictionFlagPure contradictionCount={1} />);
    // Should say "1 conflict" not "1 conflicts"
    expect(screen.getByText("1 conflict")).toBeInTheDocument();
    expect(screen.queryByText("1 conflicts")).not.toBeInTheDocument();
  });

  it("uses plural 'conflicts' for count > 1", () => {
    render(<ContradictionFlagPure contradictionCount={2} />);
    expect(screen.getByText("2 conflicts")).toBeInTheDocument();
  });
});

describe("ContradictionFlagPure — tooltip text", () => {
  it("tooltip says 'Contradicted by 1 linked artifact' for count === 1", () => {
    const { container } = render(<ContradictionFlagPure contradictionCount={1} />);
    const chip = container.firstChild as HTMLElement;
    expect(chip.getAttribute("title")).toBe("Contradicted by 1 linked artifact");
  });

  it("tooltip says 'Contradicted by N linked artifacts' for count > 1", () => {
    const { container } = render(<ContradictionFlagPure contradictionCount={4} />);
    const chip = container.firstChild as HTMLElement;
    expect(chip.getAttribute("title")).toBe("Contradicted by 4 linked artifacts");
  });
});

describe("ContradictionFlagPure — WCAG 2.1 AA", () => {
  it("carries correct aria-label for count === 1", () => {
    render(<ContradictionFlagPure contradictionCount={1} />);
    expect(
      screen.getByRole("status", { name: /contradicted by 1 linked artifact/i }),
    ).toBeInTheDocument();
  });

  it("carries correct aria-label for count > 1", () => {
    render(<ContradictionFlagPure contradictionCount={5} />);
    expect(
      screen.getByRole("status", { name: /contradicted by 5 linked artifacts/i }),
    ).toBeInTheDocument();
  });
});

describe("ContradictionFlagPure — red styling", () => {
  it("applies red colour classes", () => {
    const { container } = render(<ContradictionFlagPure contradictionCount={2} />);
    const chip = container.firstChild as HTMLElement;
    expect(chip.className).toMatch(/red/);
  });
});

describe("ContradictionFlagPure — className prop", () => {
  it("forwards className to the chip element", () => {
    const { container } = render(
      <ContradictionFlagPure contradictionCount={1} className="my-custom" />,
    );
    const chip = container.firstChild as HTMLElement;
    expect(chip).toHaveClass("my-custom");
  });
});

// ---------------------------------------------------------------------------
// ContradictionFlag — hook-driven variant tests
// ---------------------------------------------------------------------------

describe("ContradictionFlag — renders from hook", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders warning chip when count > 0", () => {
    mockUseContradictionCount.mockReturnValue({
      count: 2,
      isLoading: false,
      isError: false,
    });

    render(<ContradictionFlag artifactId="art-001" />);
    expect(screen.getByText("2 conflicts")).toBeInTheDocument();
  });

  it("renders nothing when count is 0", () => {
    mockUseContradictionCount.mockReturnValue({
      count: 0,
      isLoading: false,
      isError: false,
    });

    const { container } = render(<ContradictionFlag artifactId="art-001" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing while loading (SC-P4-5 graceful degradation)", () => {
    mockUseContradictionCount.mockReturnValue({
      count: 0,
      isLoading: true,
      isError: false,
    });

    const { container } = render(<ContradictionFlag artifactId="art-001" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing on error without crashing (SC-P4-5)", () => {
    mockUseContradictionCount.mockReturnValue({
      count: 0,
      isLoading: false,
      isError: true,
    });

    // Must not throw
    expect(() => {
      const { container } = render(<ContradictionFlag artifactId="art-001" />);
      expect(container.firstChild).toBeNull();
    }).not.toThrow();
  });

  it("tooltip text includes count from hook", () => {
    mockUseContradictionCount.mockReturnValue({
      count: 3,
      isLoading: false,
      isError: false,
    });

    const { container } = render(<ContradictionFlag artifactId="art-001" />);
    const chip = container.firstChild as HTMLElement;
    expect(chip.getAttribute("title")).toBe("Contradicted by 3 linked artifacts");
  });

  it("aria-label includes count from hook", () => {
    mockUseContradictionCount.mockReturnValue({
      count: 1,
      isLoading: false,
      isError: false,
    });

    render(<ContradictionFlag artifactId="art-001" />);
    expect(
      screen.getByRole("status", { name: /contradicted by 1 linked artifact/i }),
    ).toBeInTheDocument();
  });
});
