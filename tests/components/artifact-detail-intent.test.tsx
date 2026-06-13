import React from "react";
import { axe } from "jest-axe";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ArtifactDetailClient } from "@/app/(main)/artifact/[id]/ArtifactDetailClient";
import { getArtifact } from "@/lib/api/artifacts";
import { listIntentVersions } from "@/lib/api/intents";
import type { ArtifactDetail, ServiceModeEnvelope } from "@/types/artifact";
import type { IntentDTO } from "@/types/intents";
import { renderWithProviders, screen, waitFor } from "../utils/render";

jest.mock("@/lib/api/artifacts", () => ({
  ...jest.requireActual("@/lib/api/artifacts"),
  getArtifact: jest.fn(),
  fetchArtifactEtag: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/api/intents", () => ({
  listIntentVersions: jest.fn(),
}));

jest.mock("@miethe/ui", () => ({
  ArticleViewer: ({ content }: { content: string | null | undefined }) => (
    <article>{content}</article>
  ),
}));

jest.mock("@/hooks/useArtifactWorkflowRuns", () => ({
  useArtifactWorkflowRuns: jest.fn(() => ({
    runs: [],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  })),
}));

jest.mock("@/hooks/useArtifactEdges", () => ({
  ...jest.requireActual("@/hooks/useArtifactEdges"),
  useArtifactEdges: jest.fn(() => ({
    data: {
      artifact_id: "intent_01INTENT000000000000001",
      incoming: [],
      outgoing: [],
    },
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  })),
}));

jest.mock("@/components/artifact/activity-timeline", () => ({
  ActivityTimeline: () => <section aria-label="Activity timeline" />,
}));

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
// Typed mocks
// ---------------------------------------------------------------------------

const mockGetArtifact = getArtifact as jest.MockedFunction<typeof getArtifact>;
const mockListIntentVersions = listIntentVersions as jest.MockedFunction<
  typeof listIntentVersions
>;

// ---------------------------------------------------------------------------
// Stub data
// ---------------------------------------------------------------------------

const intentArtifact: ArtifactDetail = {
  id: "intent_01INTENT000000000000001",
  workspace: "projects",
  type: "intent",
  subtype: null,
  title: "Core Platform Planning",
  status: "active",
  schema_version: "1.0.0",
  created: "2026-05-01T00:00:00Z",
  updated: "2026-06-01T00:00:00Z",
  file_path: "projects/intents/core-platform-planning-v1.1.0.md",
  metadata: null,
  summary: null,
  slug: null,
  content_hash: null,
  frontmatter_jsonb: {
    intent_id: "intent_plan-core-platform",
    intent_version: "1.1.0",
    layer: "project",
    intent_status: "active",
    status: "active",
    owner: "nick",
    scope: "Core platform architecture",
    horizon: "Q3-2026",
    tags: ["platform", "architecture"],
  },
  raw_content: "# Core Platform Planning\n\nShould not render as source tab.",
  compiled_content:
    "<p>Should not render as knowledge tab for intent view.</p>",
  draft_content: null,
  artifact_edges: null,
};

const activeIntentDTO: IntentDTO = {
  id: "intent_01INTENT000000000000001",
  title: "Core Platform Planning",
  artifact_type: "intent",
  subtype: null,
  status: "active",
  workspace: "projects",
  file_path: "projects/intents/core-platform-planning-v1.1.0.md",
  created_at: "2026-05-01T00:00:00Z",
  updated_at: "2026-06-01T00:00:00Z",
  frontmatter: {
    intent_id: "intent_plan-core-platform",
    intent_version: "1.1.0",
    layer: "project",
    intent_status: "active",
    status: "active",
    owner: "nick",
    scope: "Core platform architecture",
    horizon: "Q3-2026",
    tags: ["platform", "architecture"],
  },
};

const supersededIntentDTO: IntentDTO = {
  id: "intent_01INTENT000000000000000",
  title: "Core Platform Planning",
  artifact_type: "intent",
  subtype: null,
  status: "superseded",
  workspace: "projects",
  file_path: "projects/intents/core-platform-planning-v1.0.0.md",
  created_at: "2026-04-01T00:00:00Z",
  updated_at: "2026-05-01T00:00:00Z",
  frontmatter: {
    intent_id: "intent_plan-core-platform",
    intent_version: "1.0.0",
    layer: "project",
    intent_status: "active",
    status: "superseded",
    owner: "nick",
    scope: "Core platform architecture",
    horizon: "Q3-2026",
    tags: ["platform"],
    superseded_by: "intent_01INTENT000000000000001",
  },
};

const intentVersionsEnvelope: ServiceModeEnvelope<IntentDTO> = {
  data: [activeIntentDTO, supersededIntentDTO],
  cursor: null,
};

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderDetail(id = "intent_01INTENT000000000000001") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return renderWithProviders(
    <QueryClientProvider client={queryClient}>
      <ArtifactDetailClient id={id} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockGetArtifact.mockResolvedValue(intentArtifact);
  mockListIntentVersions.mockResolvedValue(intentVersionsEnvelope);
});

afterEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ArtifactDetailClient intent rendering", () => {
  it("renders the intent detail view with version history", async () => {
    renderDetail();

    // The intent detail panel is aria-labelled
    expect(await screen.findByLabelText("Intent detail")).toBeInTheDocument();

    // listIntentVersions was called for this artifact id
    expect(mockListIntentVersions).toHaveBeenCalledWith(
      "intent_01INTENT000000000000001",
      { limit: 50 },
    );

    // Version history heading is present
    expect(
      screen.getByRole("heading", { name: "Version history" }),
    ).toBeInTheDocument();

    // Active version renders with semver and status badge
    expect(screen.getByText("v1.1.0")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();

    // Superseded version renders with semver and status badge
    expect(screen.getByText("v1.0.0")).toBeInTheDocument();
    expect(screen.getByText("superseded")).toBeInTheDocument();
  });

  it("calls listIntentVersions with the correct artifact id", async () => {
    renderDetail();

    await waitFor(() => {
      expect(mockListIntentVersions).toHaveBeenCalledWith(
        "intent_01INTENT000000000000001",
        { limit: 50 },
      );
    });
  });

  it("renders both intent versions in the version history list", async () => {
    renderDetail();

    // Wait for the intent detail to appear
    await screen.findByLabelText("Intent detail");

    const versionItems = screen.getAllByRole("listitem");
    // At least two list items should exist for the two versions
    const semverItems = versionItems.filter(
      (el) =>
        el.textContent?.includes("v1.1.0") ||
        el.textContent?.includes("v1.0.0"),
    );
    expect(semverItems.length).toBeGreaterThanOrEqual(2);
  });

  it("shows the active version status as active", async () => {
    renderDetail();

    await screen.findByLabelText("Intent detail");

    // The active badge should appear for v1.1.0
    const activeStatusBadges = screen
      .getAllByText("active")
      .filter(
        (el) =>
          el.classList.contains("bg-emerald-500/10") ||
          el.closest("li")?.textContent?.includes("v1.1.0"),
      );
    expect(activeStatusBadges.length).toBeGreaterThan(0);
  });

  it("shows the superseded version status as superseded", async () => {
    renderDetail();

    await screen.findByLabelText("Intent detail");

    const supersededBadges = screen
      .getAllByText("superseded")
      .filter((el) => el.closest("li")?.textContent?.includes("v1.0.0"));
    expect(supersededBadges.length).toBeGreaterThan(0);
  });

  it("passes axe accessibility checks", async () => {
    const { container } = renderDetail();

    await screen.findByLabelText("Intent detail");

    expect(await axe(container)).toHaveNoViolations();
  });
});
