/**
 * DerivativeCountBadge snapshot test.
 *
 * Minimal snapshot covering the link variant as used on ArtifactCard:
 *   <DerivativeCountBadge count={3} href="/artifact/{id}?tab=derivatives" />
 *
 * Snapshot is intentionally small — captures the rendered anchor's className,
 * aria-label, and text content. If the visual shape of the badge changes, this
 * test will fail so the change is a deliberate, reviewed update.
 *
 * library-source-rollup-v1 Phase 3 DETAIL-06.
 */

import React from "react";
import { render } from "@testing-library/react";
import { DerivativeCountBadge } from "@/components/ui/derivative-count-badge";

// ---------------------------------------------------------------------------
// Mock next/link for snapshot stability
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

describe("DerivativeCountBadge snapshot", () => {
  it("matches snapshot for link variant as used on ArtifactCard", () => {
    const { container } = render(
      <DerivativeCountBadge count={3} href="/artifact/test-id?tab=derivatives" />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
