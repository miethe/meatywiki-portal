/**
 * Unit tests for LensBadgeSet (workflow variant) — P4-06.
 *
 * Covers:
 *   - Renders all three core badges when all fields present (compact).
 *   - Renders subset when some fields null/missing (no crash).
 *   - Renders nothing (null) when all fields missing.
 *   - aria-label present on each badge.
 *   - Detail variant renders reusability_tier + sensitivity_profile.
 *   - Detail variant suppresses extra fields when absent.
 *
 * Uses standard RTL render (no providers needed — pure presentational component).
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { LensBadgeSet } from "@/components/workflow/lens-badge-set";
import type { ArtifactCard } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeArtifact(
  overrides: Partial<ArtifactCard["metadata"]> = {},
): ArtifactCard {
  return {
    id: "art-001",
    workspace: "library",
    type: "concept",
    title: "Test Artifact",
    status: "active",
    file_path: "/wiki/concepts/test.md",
    metadata: {
      fidelity: null,
      freshness: null,
      verification_state: null,
      ...overrides,
    },
  };
}

function makeArtifactNoMetadata(): ArtifactCard {
  return {
    id: "art-002",
    workspace: "inbox",
    type: "raw_note",
    title: "No Metadata",
    status: "draft",
    file_path: "/raw/note.md",
    metadata: null,
  };
}

// ---------------------------------------------------------------------------
// Compact variant — core three badges
// ---------------------------------------------------------------------------

describe("LensBadgeSet (compact variant)", () => {
  it("renders all three badges when all core fields present", () => {
    const artifact = makeArtifact({
      fidelity: "high",
      freshness: "current",
      verification_state: "verified",
    });

    render(<LensBadgeSet artifact={artifact} variant="compact" />);

    expect(screen.getByRole("generic", { name: /lens badges/i })).toBeInTheDocument();
    expect(screen.getByText("high")).toBeInTheDocument();
    expect(screen.getByText("current")).toBeInTheDocument();
    expect(screen.getByText("verified")).toBeInTheDocument();
  });

  it("renders only fidelity badge when freshness and verification_state are null", () => {
    const artifact = makeArtifact({
      fidelity: "medium",
      freshness: null,
      verification_state: null,
    });

    render(<LensBadgeSet artifact={artifact} />);

    expect(screen.getByText("medium")).toBeInTheDocument();
    expect(screen.queryByText("current")).not.toBeInTheDocument();
    expect(screen.queryByText("stale")).not.toBeInTheDocument();
    expect(screen.queryByText("verified")).not.toBeInTheDocument();
    expect(screen.queryByText("unverified")).not.toBeInTheDocument();
  });

  it("renders only freshness badge when other fields are null", () => {
    const artifact = makeArtifact({
      fidelity: null,
      freshness: "stale",
      verification_state: null,
    });

    render(<LensBadgeSet artifact={artifact} />);

    expect(screen.getByText("stale")).toBeInTheDocument();
    expect(screen.queryByText("high")).not.toBeInTheDocument();
    expect(screen.queryByText("verified")).not.toBeInTheDocument();
  });

  it("renders only verification badge when other fields are null", () => {
    const artifact = makeArtifact({
      fidelity: null,
      freshness: null,
      verification_state: "disputed",
    });

    render(<LensBadgeSet artifact={artifact} />);

    expect(screen.getByText("disputed")).toBeInTheDocument();
    expect(screen.queryByText("high")).not.toBeInTheDocument();
    expect(screen.queryByText("current")).not.toBeInTheDocument();
  });

  it("renders nothing when all fields are null in metadata", () => {
    const artifact = makeArtifact({
      fidelity: null,
      freshness: null,
      verification_state: null,
    });

    const { container } = render(<LensBadgeSet artifact={artifact} />);

    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when metadata is null", () => {
    const artifact = makeArtifactNoMetadata();

    const { container } = render(<LensBadgeSet artifact={artifact} />);

    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when metadata is undefined", () => {
    const artifact: ArtifactCard = {
      id: "art-003",
      workspace: "library",
      type: "concept",
      title: "Undefined Meta",
      status: "active",
      file_path: "/wiki/x.md",
    };

    const { container } = render(<LensBadgeSet artifact={artifact} />);

    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// aria-label assertions (WCAG 2.1 AA)
// ---------------------------------------------------------------------------

describe("LensBadgeSet — aria-label on individual badges", () => {
  it("fidelity badge carries correct aria-label", () => {
    const artifact = makeArtifact({ fidelity: "low" });

    render(<LensBadgeSet artifact={artifact} />);

    const badge = screen.getByRole("generic", { name: /fidelity: low/i });
    expect(badge).toBeInTheDocument();
  });

  it("freshness badge carries correct aria-label", () => {
    const artifact = makeArtifact({ freshness: "outdated" });

    render(<LensBadgeSet artifact={artifact} />);

    const badge = screen.getByRole("generic", { name: /freshness: outdated/i });
    expect(badge).toBeInTheDocument();
  });

  it("verification badge carries correct aria-label", () => {
    const artifact = makeArtifact({ verification_state: "unverified" });

    render(<LensBadgeSet artifact={artifact} />);

    const badge = screen.getByRole("generic", { name: /verification: unverified/i });
    expect(badge).toBeInTheDocument();
  });

  it("container div carries aria-label 'Lens badges'", () => {
    const artifact = makeArtifact({ fidelity: "high" });

    render(<LensBadgeSet artifact={artifact} />);

    expect(screen.getByRole("generic", { name: /lens badges/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Detail variant
// ---------------------------------------------------------------------------

describe("LensBadgeSet (detail variant)", () => {
  it("renders all five badges when all fields present", () => {
    const artifact = makeArtifact({
      fidelity: "high",
      freshness: "current",
      verification_state: "verified",
      reusability_tier: "core",
      sensitivity_profile: "public",
    });

    render(<LensBadgeSet artifact={artifact} variant="detail" />);

    expect(screen.getByText("high")).toBeInTheDocument();
    expect(screen.getByText("current")).toBeInTheDocument();
    expect(screen.getByText("verified")).toBeInTheDocument();
    expect(screen.getByText("core")).toBeInTheDocument();
    expect(screen.getByText("public")).toBeInTheDocument();
  });

  it("extra badges carry correct aria-labels in detail variant", () => {
    const artifact = makeArtifact({
      reusability_tier: "shared",
      sensitivity_profile: "internal",
    });

    render(<LensBadgeSet artifact={artifact} variant="detail" />);

    expect(
      screen.getByRole("generic", { name: /reusability: shared/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("generic", { name: /sensitivity: internal/i }),
    ).toBeInTheDocument();
  });

  it("does not render extra badges when reusability/sensitivity are null", () => {
    const artifact = makeArtifact({
      fidelity: "medium",
      reusability_tier: null,
      sensitivity_profile: null,
    });

    render(<LensBadgeSet artifact={artifact} variant="detail" />);

    expect(screen.queryByRole("generic", { name: /reusability/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("generic", { name: /sensitivity/i })).not.toBeInTheDocument();
    expect(screen.getByText("medium")).toBeInTheDocument();
  });

  it("does not render reusability/sensitivity in compact variant even if present", () => {
    const artifact = makeArtifact({
      fidelity: "high",
      reusability_tier: "core",
      sensitivity_profile: "public",
    });

    render(<LensBadgeSet artifact={artifact} variant="compact" />);

    expect(screen.queryByText("core")).not.toBeInTheDocument();
    expect(screen.queryByText("public")).not.toBeInTheDocument();
  });

  it("renders nothing in detail variant when all fields missing", () => {
    const artifact = makeArtifactNoMetadata();

    const { container } = render(<LensBadgeSet artifact={artifact} variant="detail" />);

    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// className prop forwarding
// ---------------------------------------------------------------------------

describe("LensBadgeSet — className prop", () => {
  it("forwards className to the container div", () => {
    const artifact = makeArtifact({ fidelity: "high" });

    const { container } = render(
      <LensBadgeSet artifact={artifact} className="custom-class" />,
    );

    const div = container.querySelector("div");
    expect(div).toHaveClass("custom-class");
  });
});
