/**
 * Tests the NEXT_PUBLIC_PORTAL_STORIES_DISABLE_REDACTION override.
 *
 * When the flag is on (trusted single-user LAN deployments, e.g. a personal
 * NUC node), the Stories views never render the "details hidden (held)" state:
 * non-public stories show their title and source section in full.
 *
 * Strategy: mock @/lib/env so STORIES_REDACTION_DISABLED === true, then render
 * an internal-sensitivity story and assert it is NOT held.
 */

import React from "react";
import { renderWithProviders, screen } from "../../utils/render";
import type { StoryDetail } from "@/types/stories";

// Force the redaction-disabled flag on for this file only.
jest.mock("@/lib/env", () => ({
  STORIES_REDACTION_DISABLED: true,
  OPERATOR_CONTROL_ENABLED: false,
}));

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

// Imported AFTER the mock so the component picks up the mocked flag.
import { StoryDetailClient } from "@/app/(main)/stories/[id]/StoryDetailClient";

function makeInternalDetail(): StoryDetail {
  return {
    story_id: "story-internal-001",
    title: "Node deploy retro",
    project_id: "proj-platform",
    lifecycle_state: "backlog",
    story_status: "backlog",
    source_type: "aar",
    date: "2026-06-25",
    domains: ["platform"],
    sensitivity: { level: "internal", agent_access: "metadata" },
    scrub: { status: "not_checked", issue_count: 0, summary: "not_checked" },
    publication: {
      state: "none",
      draft_pr_url: null,
      published_url: null,
      post_slug: null,
    },
    source: {
      safe_ref: "node-deploy-retro.md",
      safe_uri: "op-story-source://sha256/deadbeef",
    },
    sync: { synced_at: new Date().toISOString(), source_system: "op-story" },
    updated_at: "2026-06-25T12:00:00Z",
    lifecycle: {
      status: "backlog",
      created_at: "2026-06-25T00:00:00Z",
      updated_at: "2026-06-25T12:00:00Z",
      archived_at: null,
      reason_code: null,
    },
    related_refs: { ccdash_session: null, ccdash_feature: null },
    routing_tags: ["op-story", "aar"],
    reason: null,
  };
}

describe("StoryDetailClient with redaction disabled", () => {
  it("shows the title (not held) for an internal story", () => {
    renderWithProviders(<StoryDetailClient story={makeInternalDetail()} />);
    expect(screen.getByText("Node deploy retro")).toBeInTheDocument();
    expect(screen.queryByText(/details hidden \(held\)/i)).not.toBeInTheDocument();
  });

  it("surfaces the source ref for an internal story", () => {
    renderWithProviders(<StoryDetailClient story={makeInternalDetail()} />);
    expect(screen.getByText("node-deploy-retro.md")).toBeInTheDocument();
  });
});
