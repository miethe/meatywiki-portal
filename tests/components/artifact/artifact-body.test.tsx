/**
 * Tests for ArtifactBody HTML sanitization (P6-03 / P6-04).
 *
 * Covers:
 *   - Dangerous tags stripped: <script>, <iframe>
 *   - Dangerous attributes stripped: onerror=, javascript: href
 *   - Safe HTML preserved: tables, links, bold, code, headings, lists, images
 *   - Both "knowledge" and "draft" variants sanitize identically (same code path)
 */

import React from "react";
import { render } from "@testing-library/react";
import { ArtifactBody } from "@/components/artifact/artifact-body";

type Variant = "knowledge" | "draft";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInnerHTML(container: HTMLElement): string {
  const div = container.querySelector("div");
  return div?.innerHTML ?? "";
}

// ---------------------------------------------------------------------------
// Dangerous content stripped
// ---------------------------------------------------------------------------

const VARIANTS: Variant[] = ["knowledge", "draft"];

describe.each(VARIANTS)("ArtifactBody variant=%s — sanitization", (variant) => {
  it("strips <script> tags", () => {
    const { container } = render(
      <ArtifactBody
        content={'<p>Hello</p><script>alert("xss")</script>'}
        variant={variant}
      />,
    );
    const html = getInnerHTML(container);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert");
    expect(html).toContain("Hello");
  });

  it("strips <iframe> tags", () => {
    const { container } = render(
      <ArtifactBody
        content={'<p>Content</p><iframe src="https://evil.example/"></iframe>'}
        variant={variant}
      />,
    );
    const html = getInnerHTML(container);
    expect(html).not.toContain("<iframe");
    expect(html).toContain("Content");
  });

  it("strips onerror= event attributes", () => {
    const { container } = render(
      <ArtifactBody
        content={'<img src="x" onerror="alert(1)" alt="test" />'}
        variant={variant}
      />,
    );
    const html = getInnerHTML(container);
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("alert(1)");
  });

  it("strips javascript: href URLs", () => {
    const { container } = render(
      <ArtifactBody
        content={'<a href="javascript:alert(1)">click me</a>'}
        variant={variant}
      />,
    );
    const html = getInnerHTML(container);
    expect(html).not.toContain("javascript:");
    expect(html).toContain("click me");
  });
});

// ---------------------------------------------------------------------------
// Safe HTML preserved
// ---------------------------------------------------------------------------

describe.each(VARIANTS)("ArtifactBody variant=%s — safe HTML preserved", (variant) => {
  it("preserves tables", () => {
    const tableHtml =
      "<table><thead><tr><th>Name</th></tr></thead><tbody><tr><td>Alice</td></tr></tbody></table>";
    const { container } = render(
      <ArtifactBody content={tableHtml} variant={variant} />,
    );
    const html = getInnerHTML(container);
    expect(html).toContain("<table");
    expect(html).toContain("Alice");
  });

  it("preserves links with http/https href", () => {
    const { container } = render(
      <ArtifactBody
        content={'<a href="https://example.com">Example</a>'}
        variant={variant}
      />,
    );
    const html = getInnerHTML(container);
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain("Example");
  });

  it("preserves bold text", () => {
    const { container } = render(
      <ArtifactBody content="<p><strong>Bold</strong></p>" variant={variant} />,
    );
    const html = getInnerHTML(container);
    expect(html).toContain("<strong>");
    expect(html).toContain("Bold");
  });

  it("preserves inline code and code blocks", () => {
    const { container } = render(
      <ArtifactBody
        content="<p><code>inline</code></p><pre><code>block</code></pre>"
        variant={variant}
      />,
    );
    const html = getInnerHTML(container);
    expect(html).toContain("<code>");
    expect(html).toContain("inline");
    expect(html).toContain("block");
  });

  it("preserves headings", () => {
    const { container } = render(
      <ArtifactBody
        content="<h1>Title</h1><h2>Section</h2>"
        variant={variant}
      />,
    );
    const html = getInnerHTML(container);
    expect(html).toContain("<h1>");
    expect(html).toContain("Title");
    expect(html).toContain("<h2>");
    expect(html).toContain("Section");
  });

  it("preserves ordered and unordered lists", () => {
    const { container } = render(
      <ArtifactBody
        content="<ul><li>Item</li></ul><ol><li>One</li></ol>"
        variant={variant}
      />,
    );
    const html = getInnerHTML(container);
    expect(html).toContain("<ul>");
    expect(html).toContain("<ol>");
    expect(html).toContain("Item");
    expect(html).toContain("One");
  });

  it("preserves images with http/https src", () => {
    const { container } = render(
      <ArtifactBody
        content={'<img src="https://example.com/photo.png" alt="photo" />'}
        variant={variant}
      />,
    );
    const html = getInnerHTML(container);
    expect(html).toContain('src="https://example.com/photo.png"');
  });
});

// ---------------------------------------------------------------------------
// Empty / non-HTML content (plain markdown path — not sanitized, no HTML)
// ---------------------------------------------------------------------------

describe("ArtifactBody — empty state", () => {
  it("renders empty state for null content (knowledge)", () => {
    const { getByText } = render(
      <ArtifactBody content={null as unknown as string} variant="knowledge" />,
    );
    expect(getByText("No compiled content yet.")).toBeInTheDocument();
  });

  it("renders empty state for null content (draft)", () => {
    const { getByText } = render(
      <ArtifactBody content={null as unknown as string} variant="draft" />,
    );
    expect(getByText("No draft content")).toBeInTheDocument();
  });
});
