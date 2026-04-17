/**
 * Tests for ArtifactFreshnessBadge (P4-04) and computeFreshnessState helper.
 *
 * Covers:
 *   - Each freshness state renders correct colour class + label
 *   - Missing / null frontmatter renders nothing (no crash)
 *   - stale_after in the past overrides lens_freshness=fresh → "stale"
 *   - stale_after in the future keeps lens_freshness=fresh as "current"
 *   - lens_freshness="outdated" always renders outdated regardless of stale_after
 *   - aria-label present with correct state label
 *   - className forwarding
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import {
  ArtifactFreshnessBadge,
  computeFreshnessState,
} from "@/components/artifact/freshness-badge";

// ---------------------------------------------------------------------------
// computeFreshnessState unit tests
// ---------------------------------------------------------------------------

describe("computeFreshnessState", () => {
  it('returns "current" when lens_freshness=fresh and no stale_after', () => {
    expect(computeFreshnessState("fresh", null)).toBe("current");
    expect(computeFreshnessState("fresh", undefined)).toBe("current");
  });

  it('returns "current" when lens_freshness=fresh and stale_after is in the future', () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // +1h
    expect(computeFreshnessState("fresh", future)).toBe("current");
  });

  it('returns "stale" when lens_freshness=fresh but stale_after is in the past', () => {
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // -1h
    expect(computeFreshnessState("fresh", past)).toBe("stale");
  });

  it('returns "stale" when lens_freshness=stale regardless of stale_after', () => {
    expect(computeFreshnessState("stale", null)).toBe("stale");
    expect(computeFreshnessState("stale", undefined)).toBe("stale");
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect(computeFreshnessState("stale", future)).toBe("stale");
  });

  it('returns "outdated" when lens_freshness=outdated regardless of stale_after', () => {
    expect(computeFreshnessState("outdated", null)).toBe("outdated");
    const past = new Date(Date.now() - 1000).toISOString();
    expect(computeFreshnessState("outdated", past)).toBe("outdated");
  });

  it("returns null when both fields are null/undefined", () => {
    expect(computeFreshnessState(null, null)).toBeNull();
    expect(computeFreshnessState(undefined, undefined)).toBeNull();
    expect(computeFreshnessState(null, undefined)).toBeNull();
  });

  it("returns null when lens_freshness is an unrecognised string and no stale_after", () => {
    expect(computeFreshnessState("unknown-value", null)).toBeNull();
    expect(computeFreshnessState("", null)).toBeNull();
  });

  it('returns "stale" when lens_freshness missing but stale_after is in the past', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(computeFreshnessState(null, past)).toBe("stale");
    expect(computeFreshnessState(undefined, past)).toBe("stale");
  });

  it("is case-insensitive for lens_freshness", () => {
    expect(computeFreshnessState("FRESH", null)).toBe("current");
    expect(computeFreshnessState("STALE", null)).toBe("stale");
    expect(computeFreshnessState("Outdated", null)).toBe("outdated");
  });

  it("handles malformed stale_after gracefully", () => {
    // Invalid date string — should not throw; stale_after treated as absent
    expect(computeFreshnessState("fresh", "not-a-date")).toBe("current");
    expect(computeFreshnessState("fresh", "")).toBe("current");
  });
});

// ---------------------------------------------------------------------------
// ArtifactFreshnessBadge rendering tests
// ---------------------------------------------------------------------------

describe("ArtifactFreshnessBadge — rendering", () => {
  it('renders "current" label for lens_freshness=fresh', () => {
    render(<ArtifactFreshnessBadge freshness="fresh" />);
    expect(screen.getByText("current")).toBeInTheDocument();
  });

  it('renders "stale" label for lens_freshness=stale', () => {
    render(<ArtifactFreshnessBadge freshness="stale" />);
    expect(screen.getByText("stale")).toBeInTheDocument();
  });

  it('renders "outdated" label for lens_freshness=outdated', () => {
    render(<ArtifactFreshnessBadge freshness="outdated" />);
    expect(screen.getByText("outdated")).toBeInTheDocument();
  });

  it("renders nothing when freshness and staleAfter are both null", () => {
    const { container } = render(
      <ArtifactFreshnessBadge freshness={null} staleAfter={null} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when freshness and staleAfter are both undefined", () => {
    const { container } = render(<ArtifactFreshnessBadge />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when freshness is an empty string and staleAfter absent", () => {
    const { container } = render(<ArtifactFreshnessBadge freshness="" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders stale when staleAfter is past and freshness=fresh", () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    render(<ArtifactFreshnessBadge freshness="fresh" staleAfter={past} />);
    expect(screen.getByText("stale")).toBeInTheDocument();
  });

  it("renders current when staleAfter is future and freshness=fresh", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    render(<ArtifactFreshnessBadge freshness="fresh" staleAfter={future} />);
    expect(screen.getByText("current")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Colour class tests
// ---------------------------------------------------------------------------

describe("ArtifactFreshnessBadge — colour classes", () => {
  it("applies green (emerald) classes for current state", () => {
    const { container } = render(<ArtifactFreshnessBadge freshness="fresh" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toMatch(/emerald/);
  });

  it("applies amber classes for stale state", () => {
    const { container } = render(<ArtifactFreshnessBadge freshness="stale" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toMatch(/amber/);
  });

  it("applies red classes for outdated state", () => {
    const { container } = render(<ArtifactFreshnessBadge freshness="outdated" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toMatch(/red/);
  });
});

// ---------------------------------------------------------------------------
// ARIA / accessibility tests
// ---------------------------------------------------------------------------

describe("ArtifactFreshnessBadge — WCAG 2.1 AA", () => {
  it("carries aria-label 'Freshness: current' for current state", () => {
    render(<ArtifactFreshnessBadge freshness="fresh" />);
    expect(screen.getByRole("generic", { name: /freshness: current/i })).toBeInTheDocument();
  });

  it("carries aria-label 'Freshness: stale' for stale state", () => {
    render(<ArtifactFreshnessBadge freshness="stale" />);
    expect(screen.getByRole("generic", { name: /freshness: stale/i })).toBeInTheDocument();
  });

  it("carries aria-label 'Freshness: outdated' for outdated state", () => {
    render(<ArtifactFreshnessBadge freshness="outdated" />);
    expect(screen.getByRole("generic", { name: /freshness: outdated/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// className forwarding
// ---------------------------------------------------------------------------

describe("ArtifactFreshnessBadge — className prop", () => {
  it("forwards className to the span element", () => {
    const { container } = render(
      <ArtifactFreshnessBadge freshness="fresh" className="my-custom-class" />,
    );
    const span = container.firstChild as HTMLElement;
    expect(span).toHaveClass("my-custom-class");
  });
});
