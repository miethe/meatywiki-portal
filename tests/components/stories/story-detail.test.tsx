/**
 * Smoke tests for StoryDetailClient.
 *
 * Validates:
 *   - Normal story: title, status badge, publication sections render
 *   - Held story (sensitivity.level != "public"): "details hidden (held)" banner
 *   - Stale sync banner shows when sync.synced_at is old
 *   - Primary action "View Published" renders when published_url is set
 *   - Primary action "View Draft PR" renders when draft_pr_url is set (no published_url)
 *   - Source section hidden for held stories
 *   - Related refs section renders ccdash_session
 *   - Lifecycle section renders status timeline
 *
 * Strategy: render StoryDetailClient with prop data (no API calls needed).
 */

import React from "react";
import { renderWithProviders, screen } from "../../utils/render";
import { StoryDetailClient } from "@/app/(main)/stories/[id]/StoryDetailClient";
import type { StoryDetail } from "@/types/stories";

// ---------------------------------------------------------------------------
// Mock next/link (referenced in component)
// ---------------------------------------------------------------------------

jest.mock("next/link", () => {
  return function MockLink({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  };
});

// ---------------------------------------------------------------------------
// Stub factory
// ---------------------------------------------------------------------------

function makeDetail(overrides: Partial<StoryDetail> = {}): StoryDetail {
  return {
    story_id: "story-test-001",
    title: "Platform caching retro",
    project_id: "proj-platform",
    lifecycle_state: "drafted",
    story_status: "drafted",
    source_type: "aar",
    date: "2026-06-01",
    domains: ["platform", "backend"],
    sensitivity: { level: "public", agent_access: "read" },
    scrub: { status: "clean", issue_count: 0, summary: "" },
    publication: {
      state: "draft",
      draft_pr_url: "https://github.com/example/pr/42",
      published_url: null,
      post_slug: null,
    },
    source: { safe_ref: "commit:abc123", safe_uri: "https://github.com/example/commit/abc123" },
    sync: { synced_at: new Date().toISOString(), source_system: "ccdash" },
    updated_at: "2026-06-20T12:00:00Z",
    lifecycle: {
      status: "drafted",
      created_at: "2026-06-01T00:00:00Z",
      updated_at: "2026-06-20T12:00:00Z",
      archived_at: null,
      reason_code: null,
    },
    related_refs: { ccdash_session: "sess-abc-123", ccdash_feature: null },
    routing_tags: ["platform", "caching"],
    reason: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("StoryDetailClient", () => {
  it("renders story title in metadata section", () => {
    renderWithProviders(<StoryDetailClient story={makeDetail()} />);
    expect(screen.getByText("Platform caching retro")).toBeInTheDocument();
  });

  it("renders lifecycle status badge", () => {
    renderWithProviders(<StoryDetailClient story={makeDetail()} />);
    // StoryStatusBadge renders aria-label="Story status: Drafted"
    expect(screen.getByLabelText(/story status: drafted/i)).toBeInTheDocument();
  });

  it("renders domains as badges", () => {
    renderWithProviders(<StoryDetailClient story={makeDetail()} />);
    // "platform" appears in domains AND routing_tags — getAllByText handles it
    const platformEls = screen.getAllByText("platform");
    expect(platformEls.length).toBeGreaterThanOrEqual(1);
    // "backend" appears in domains AND routing_tags
    const backendEls = screen.getAllByText("backend");
    expect(backendEls.length).toBeGreaterThanOrEqual(1);
  });

  it("renders View Draft PR primary action when draft_pr_url is set", () => {
    renderWithProviders(<StoryDetailClient story={makeDetail()} />);
    const prLink = screen.getByRole("link", { name: /view draft pull request/i });
    expect(prLink).toBeInTheDocument();
    expect(prLink).toHaveAttribute("href", "https://github.com/example/pr/42");
  });

  it("renders View Published primary action when published_url is set", () => {
    const story = makeDetail({
      publication: {
        state: "published",
        draft_pr_url: null,
        published_url: "https://blog.example.com/stories/caching-retro",
        post_slug: "caching-retro",
      },
    });
    renderWithProviders(<StoryDetailClient story={story} />);
    // Multiple "view published story" links (primary action + ExtLink in pub section)
    const pubLinks = screen.getAllByRole("link", { name: /view published story/i });
    expect(pubLinks.length).toBeGreaterThanOrEqual(1);
    // Primary action button has specific classes
    const primaryAction = pubLinks.find((el) =>
      el.className.includes("bg-primary"),
    );
    expect(primaryAction).toBeTruthy();
    expect(primaryAction).toHaveAttribute(
      "href",
      "https://blog.example.com/stories/caching-retro",
    );
  });

  it("renders 'Details hidden (held)' banner for non-public sensitivity", () => {
    const held = makeDetail({
      sensitivity: { level: "internal", agent_access: "none" },
      scrub: {
        status: "blocked",
        issue_count: 2,
        summary: "Sensitive operational data",
      },
    });
    renderWithProviders(<StoryDetailClient story={held} />);
    // Banner + metadata both show "details hidden" — getAllByText handles duplicates
    const heldEls = screen.getAllByText(/details hidden \(held\)/i);
    expect(heldEls.length).toBeGreaterThanOrEqual(1);
    const scrubEls = screen.getAllByText("Sensitive operational data");
    expect(scrubEls.length).toBeGreaterThanOrEqual(1);
  });

  it("does not render Source section for held story", () => {
    const held = makeDetail({
      sensitivity: { level: "blocked", agent_access: "none" },
      source: { safe_ref: null, safe_uri: null },
    });
    renderWithProviders(<StoryDetailClient story={held} />);
    // Source section heading should not be present when source is null+held
    expect(screen.queryByRole("heading", { name: /^source$/i })).not.toBeInTheDocument();
  });

  it("renders stale sync banner when sync is old", () => {
    const OLD_DATE = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString();
    const stale = makeDetail({ sync: { synced_at: OLD_DATE, source_system: "ccdash" } });
    renderWithProviders(<StoryDetailClient story={stale} />);
    expect(screen.getByText(/stale sync/i)).toBeInTheDocument();
  });

  it("does NOT render stale sync banner for fresh story", () => {
    renderWithProviders(<StoryDetailClient story={makeDetail()} />);
    // No stale sync banner (sync.synced_at is now())
    expect(screen.queryByRole("status", { name: /stale sync/i })).not.toBeInTheDocument();
  });

  it("renders CCDash session in related refs", () => {
    renderWithProviders(<StoryDetailClient story={makeDetail()} />);
    expect(screen.getByText("sess-abc-123")).toBeInTheDocument();
  });

  it("renders routing tags", () => {
    renderWithProviders(<StoryDetailClient story={makeDetail()} />);
    expect(screen.getByText("caching")).toBeInTheDocument();
  });

  it("renders lifecycle timeline section", () => {
    renderWithProviders(<StoryDetailClient story={makeDetail()} />);
    // Section heading "Status Timeline"
    expect(screen.getByText(/status timeline/i)).toBeInTheDocument();
  });

  it("renders source section when safe_ref is present and story is public", () => {
    renderWithProviders(<StoryDetailClient story={makeDetail()} />);
    expect(screen.getByText("commit:abc123")).toBeInTheDocument();
  });

  it("renders back navigation link to /stories", () => {
    renderWithProviders(<StoryDetailClient story={makeDetail()} />);
    const backLink = screen.getByRole("link", { name: /stories/i });
    expect(backLink).toHaveAttribute("href", "/stories");
  });

  // ---------------------------------------------------------------------------
  // AAR body rendering (FE-2)
  // ---------------------------------------------------------------------------

  it("renders ArticleViewer with body markdown when body is present", () => {
    const bodyText = "## What happened\n\nWe shipped the caching layer successfully.";
    const story = makeDetail({ body: bodyText });
    renderWithProviders(<StoryDetailClient story={story} />);

    // Section heading
    expect(screen.getByText(/after-action review/i)).toBeInTheDocument();

    // ArticleViewer stub renders a div[data-testid="article-viewer-stub"] with the content
    const viewer = screen.getByTestId("article-viewer-stub");
    expect(viewer).toBeInTheDocument();
    expect(viewer).toHaveTextContent("## What happened");
  });

  it("renders empty state when body is absent (null)", () => {
    const story = makeDetail({ body: null });
    renderWithProviders(<StoryDetailClient story={story} />);

    // Section heading still rendered
    expect(screen.getByText(/after-action review/i)).toBeInTheDocument();

    // Empty state message shown; ArticleViewer NOT rendered
    expect(screen.getByText(/no aar body available/i)).toBeInTheDocument();
    expect(screen.queryByTestId("article-viewer-stub")).not.toBeInTheDocument();
  });

  it("renders empty state when body is undefined", () => {
    const story = makeDetail({ body: undefined });
    renderWithProviders(<StoryDetailClient story={story} />);

    expect(screen.getByText(/no aar body available/i)).toBeInTheDocument();
    expect(screen.queryByTestId("article-viewer-stub")).not.toBeInTheDocument();
  });
});
