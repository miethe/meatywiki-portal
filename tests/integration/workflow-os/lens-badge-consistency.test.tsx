/**
 * Integration test — Lens badge consistency across surfaces (P4-12).
 *
 * Verifies that the same artifact metadata yields identical lens badge output
 * when rendered from three different surfaces:
 *   1. Library artifact card  (ArtifactCard, variant="grid")
 *   2. Artifact Detail header (LensBadgeSet variant="detail")
 *   3. Lens reuse comparison  (LensBadgeSet variant="compact")
 *
 * Graceful degradation: null/missing lens fields must not crash, not log
 * console errors, and omit the absent badges rather than render placeholders.
 */

import React from "react";
import { renderWithProviders, screen, within } from "../../utils/render";
import { ArtifactCard as ArtifactCardComponent } from "@/components/ui/artifact-card";
import { LensBadgeSet } from "@/components/workflow/lens-badge-set";
import type { ArtifactCard, ArtifactDetail } from "@/types/artifact";

// next/link used by ArtifactCard — render as plain anchor
jest.mock("next/link", () => ({
  __esModule: true,
  default: function MockLink({
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  },
}));

function makeArtifact(
  meta: Partial<ArtifactCard["metadata"]> = {},
): ArtifactDetail {
  return {
    id: "art-consistency-01",
    workspace: "library",
    type: "concept",
    title: "Consistency Fixture",
    status: "active",
    file_path: "/wiki/concepts/consistency.md",
    updated: "2026-04-17T10:00:00Z",
    metadata: {
      fidelity: "high",
      freshness: "current",
      verification_state: "verified",
      ...meta,
    },
  };
}

function badgeTextsFrom(container: HTMLElement): string[] {
  // Every lens badge carries aria-label starting with "fidelity:", "freshness:",
  // or "verification:". We collect the aria-label values rather than the text
  // so consistency is verified on the semantic label, not just inner text.
  const badges = within(container).queryAllByRole("generic", {
    name: /^(fidelity|freshness|verification):/i,
  });
  return badges.map((el) => el.getAttribute("aria-label") ?? "").sort();
}

describe("Lens badge consistency — card / detail / compact surfaces", () => {
  it("renders identical lens labels for card, detail, and standalone compact", () => {
    const artifact = makeArtifact();

    // Surface 1: Library artifact card (grid variant)
    const card = renderWithProviders(
      <ArtifactCardComponent artifact={artifact} variant="grid" />,
      { container: document.createElement("div") },
    );
    const cardLabels = badgeTextsFrom(card.container);

    // Surface 2: Artifact Detail header (detail variant — core 3 + optional 2)
    const detail = renderWithProviders(
      <LensBadgeSet artifact={artifact} variant="detail" />,
      { container: document.createElement("div") },
    );
    const detailLabels = badgeTextsFrom(detail.container);

    // Surface 3: Standalone compact (Lens filter bar reuse, workflow row, etc.)
    const compact = renderWithProviders(
      <LensBadgeSet artifact={artifact} variant="compact" />,
      { container: document.createElement("div") },
    );
    const compactLabels = badgeTextsFrom(compact.container);

    // Core 3 must match across all three surfaces
    expect(cardLabels).toEqual(compactLabels);
    // Detail variant is a superset (may add reusability/sensitivity); the
    // core-3 subset must be present identically
    for (const label of compactLabels) {
      expect(detailLabels).toContain(label);
    }
  });

  it("omits absent badges gracefully on all surfaces when a lens field is null", () => {
    const artifact = makeArtifact({ freshness: null });

    const card = renderWithProviders(
      <ArtifactCardComponent artifact={artifact} variant="grid" />,
      { container: document.createElement("div") },
    );
    const compact = renderWithProviders(
      <LensBadgeSet artifact={artifact} variant="compact" />,
      { container: document.createElement("div") },
    );

    const cardLabels = badgeTextsFrom(card.container);
    const compactLabels = badgeTextsFrom(compact.container);

    expect(cardLabels).toEqual(compactLabels);
    // "freshness:" must not appear anywhere
    for (const label of cardLabels) {
      expect(label.toLowerCase()).not.toMatch(/^freshness:/);
    }
  });

  it("does not crash or emit console errors when metadata is entirely null", () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const consoleWarn = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    const artifact: ArtifactDetail = {
      id: "art-null-meta",
      workspace: "library",
      type: "concept",
      title: "Null meta",
      status: "active",
      file_path: "/wiki/concepts/x.md",
      metadata: null,
    };

    expect(() => {
      renderWithProviders(<ArtifactCardComponent artifact={artifact} variant="grid" />);
      renderWithProviders(<LensBadgeSet artifact={artifact} variant="detail" />);
      renderWithProviders(<LensBadgeSet artifact={artifact} variant="compact" />);
    }).not.toThrow();

    // None of the renders should have logged any React error/warning
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();

    consoleError.mockRestore();
    consoleWarn.mockRestore();
  });

  it("detail variant shows core 3 + extra badges when reusability/sensitivity are set", () => {
    const artifact = makeArtifact({
      reusability_tier: "core",
      sensitivity_profile: "public",
    });

    renderWithProviders(<LensBadgeSet artifact={artifact} variant="detail" />);

    // Core three
    expect(screen.getByRole("generic", { name: /fidelity: high/i })).toBeInTheDocument();
    expect(screen.getByRole("generic", { name: /freshness: current/i })).toBeInTheDocument();
    expect(
      screen.getByRole("generic", { name: /verification: verified/i }),
    ).toBeInTheDocument();

    // Detail-only extras
    expect(screen.getByRole("generic", { name: /reusability: core/i })).toBeInTheDocument();
    expect(screen.getByRole("generic", { name: /sensitivity: public/i })).toBeInTheDocument();
  });
});
