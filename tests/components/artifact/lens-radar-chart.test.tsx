/**
 * Tests for LensRadarChart (P1.5-1-04).
 *
 * Covers:
 *   - Empty state renders when all lens fields are null
 *   - Empty state renders when metadata is undefined
 *   - Empty state shows "No assessment yet" message
 *   - Empty state shows CTA when onAssess prop is provided
 *   - Empty state CTA calls onAssess on click
 *   - Chart renders SVG when at least one field is non-null
 *   - Accessible summary table is present (visually hidden)
 *   - Numeric dimensions appear in the accessible table with score
 *   - Categorical dimensions (verification_status, fidelity) are mapped correctly
 *   - "not assessed" appears for null dimensions
 *   - SVG has aria-label
 *   - Data points render for assessed dimensions
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { LensRadarChart } from "@/components/artifact/lens-radar-chart";
import type { ArtifactMetadataResponse } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Stub factories
// ---------------------------------------------------------------------------

function makeMetadata(
  overrides: Partial<ArtifactMetadataResponse> = {},
): ArtifactMetadataResponse {
  return {
    artifact_id: "test-artifact-001",
    fidelity_level: null,
    freshness_class: null,
    verification_status: null,
    novelty: null,
    clarity: null,
    significance: null,
    originality: null,
    rigor: null,
    utility: null,
    lens_rationale_jsonb: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

describe("LensRadarChart — empty state", () => {
  it("renders empty state when metadata is undefined", () => {
    render(<LensRadarChart />);
    expect(screen.getByTestId("lens-radar-empty")).toBeInTheDocument();
    expect(screen.getByText("No assessment yet")).toBeInTheDocument();
  });

  it("renders empty state when metadata is null", () => {
    render(<LensRadarChart metadata={null} />);
    expect(screen.getByTestId("lens-radar-empty")).toBeInTheDocument();
  });

  it("renders empty state when all fields are null", () => {
    render(<LensRadarChart metadata={makeMetadata()} />);
    expect(screen.getByTestId("lens-radar-empty")).toBeInTheDocument();
  });

  it("shows descriptive text in empty state", () => {
    render(<LensRadarChart />);
    expect(
      screen.getByText(/lens dimensions have not been scored/i),
    ).toBeInTheDocument();
  });

  it("shows CTA button when onAssess prop provided", () => {
    const onAssess = jest.fn();
    render(<LensRadarChart onAssess={onAssess} />);
    expect(screen.getByRole("button", { name: /start assessment/i })).toBeInTheDocument();
  });

  it("does NOT show CTA button when onAssess is not provided", () => {
    render(<LensRadarChart />);
    expect(
      screen.queryByRole("button", { name: /start assessment/i }),
    ).not.toBeInTheDocument();
  });

  it("calls onAssess when CTA button is clicked", async () => {
    const onAssess = jest.fn();
    const { getByRole } = render(<LensRadarChart onAssess={onAssess} />);
    getByRole("button", { name: /start assessment/i }).click();
    expect(onAssess).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Chart rendering
// ---------------------------------------------------------------------------

describe("LensRadarChart — chart rendering", () => {
  const metadata = makeMetadata({
    novelty: 8,
    clarity: 5,
    rigor: 9,
    verification_status: "verified",
    fidelity_level: "established",
  });

  it("renders an SVG when metadata has at least one non-null field", () => {
    const { container } = render(<LensRadarChart metadata={metadata} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("does NOT render the empty state when data is present", () => {
    render(<LensRadarChart metadata={metadata} />);
    expect(screen.queryByTestId("lens-radar-empty")).not.toBeInTheDocument();
  });

  it("SVG carries aria-label", () => {
    const { container } = render(<LensRadarChart metadata={metadata} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-label");
  });
});

// ---------------------------------------------------------------------------
// Accessible summary table
// ---------------------------------------------------------------------------

describe("LensRadarChart — accessible table", () => {
  const metadata = makeMetadata({
    novelty: 7,
    significance: 4,
    verification_status: "partial",
    fidelity_level: "speculative",
  });

  it("includes a visually-hidden data table", () => {
    const { container } = render(<LensRadarChart metadata={metadata} />);
    const table = container.querySelector("table");
    expect(table).toBeInTheDocument();
  });

  it("table shows novelty score as 7/10", () => {
    render(<LensRadarChart metadata={metadata} />);
    expect(screen.getByText("7/10")).toBeInTheDocument();
  });

  it("table shows significance score as 4/10", () => {
    render(<LensRadarChart metadata={metadata} />);
    expect(screen.getByText("4/10")).toBeInTheDocument();
  });

  it("table shows 'not assessed' for null dimensions", () => {
    render(<LensRadarChart metadata={metadata} />);
    const notAssessedCells = screen.getAllByText("not assessed");
    expect(notAssessedCells.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Categorical dimension mapping
// ---------------------------------------------------------------------------

describe("LensRadarChart — categorical dimension mapping", () => {
  it("maps verification_status=verified to 10/10 in table", () => {
    const metadata = makeMetadata({
      novelty: 5, // ensure not all null
      verification_status: "verified",
    });
    render(<LensRadarChart metadata={metadata} />);
    expect(screen.getByText("10/10")).toBeInTheDocument();
  });

  it("maps verification_status=partial to 5/10 in table", () => {
    const metadata = makeMetadata({
      novelty: 3,
      verification_status: "partial",
    });
    render(<LensRadarChart metadata={metadata} />);
    expect(screen.getByText("5/10")).toBeInTheDocument();
  });

  it("maps verification_status=unverified to 0/10 in table", () => {
    const metadata = makeMetadata({
      novelty: 3,
      verification_status: "unverified",
    });
    render(<LensRadarChart metadata={metadata} />);
    expect(screen.getByText("0/10")).toBeInTheDocument();
  });

  it("maps fidelity_level=established to 10/10 in table", () => {
    const metadata = makeMetadata({
      novelty: 2,
      fidelity_level: "established",
    });
    render(<LensRadarChart metadata={metadata} />);
    expect(screen.getByText("10/10")).toBeInTheDocument();
  });

  it("maps fidelity_level=speculative to 0/10 in table", () => {
    const metadata = makeMetadata({
      novelty: 4,
      fidelity_level: "speculative",
    });
    render(<LensRadarChart metadata={metadata} />);
    expect(screen.getByText("0/10")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// All dimensions null should still trigger empty state
// ---------------------------------------------------------------------------

describe("LensRadarChart — partial null handling", () => {
  it("renders chart (not empty state) when only one field is set", () => {
    const metadata = makeMetadata({ clarity: 6 });
    render(<LensRadarChart metadata={metadata} />);
    expect(screen.queryByTestId("lens-radar-empty")).not.toBeInTheDocument();
    const { container } = render(<LensRadarChart metadata={metadata} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// className forwarding
// ---------------------------------------------------------------------------

describe("LensRadarChart — className prop", () => {
  it("forwards className to outer container", () => {
    const metadata = makeMetadata({ novelty: 5 });
    const { container } = render(
      <LensRadarChart metadata={metadata} className="my-test-class" />,
    );
    expect(container.firstChild).toHaveClass("my-test-class");
  });
});
