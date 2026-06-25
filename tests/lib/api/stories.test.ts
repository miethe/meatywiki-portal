/**
 * Unit tests for stories API wrapper.
 *
 * Validates:
 *   - listStories builds correct URL paths (no /api/ prefix — getApiBase adds it)
 *   - getStory encodes the story ID and calls the correct path
 *   - Filter params are serialised correctly
 *
 * Strategy: mock apiFetch at module boundary (same pattern as projects.test.ts).
 */

import { listStories, getStory } from "@/lib/api/stories";
import { apiFetch } from "@/lib/api/client";

jest.mock("@/lib/api/client", () => ({
  apiFetch: jest.fn(),
}));

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

afterEach(() => {
  jest.clearAllMocks();
});

describe("listStories", () => {
  it("calls /stories with no params when no filters given", async () => {
    mockApiFetch.mockResolvedValue({ data: [], cursor: null });
    await listStories();
    expect(mockApiFetch).toHaveBeenCalledWith("/stories", { method: "GET" });
  });

  it("appends all supported filter params", async () => {
    mockApiFetch.mockResolvedValue({ data: [], cursor: null });
    await listStories({
      status: "drafted",
      project: "proj-1",
      source_type: "aar",
      sensitivity: "public",
      publication: "draft",
      q: "caching spike",
      limit: 25,
      cursor: "next-token",
    });
    const [path] = (mockApiFetch as jest.Mock).mock.calls[0] as [string, ...unknown[]];
    const url = new URL(path, "http://x");
    expect(url.searchParams.get("status")).toBe("drafted");
    expect(url.searchParams.get("project")).toBe("proj-1");
    expect(url.searchParams.get("source_type")).toBe("aar");
    expect(url.searchParams.get("sensitivity")).toBe("public");
    expect(url.searchParams.get("publication")).toBe("draft");
    expect(url.searchParams.get("q")).toBe("caching spike");
    expect(url.searchParams.get("limit")).toBe("25");
    expect(url.searchParams.get("cursor")).toBe("next-token");
  });

  it("serializes date_from and date_to as ISO YYYY-MM-DD query params", async () => {
    mockApiFetch.mockResolvedValue({ data: [], cursor: null });
    await listStories({ date_from: "2026-01-01", date_to: "2026-06-30" });
    const [path] = (mockApiFetch as jest.Mock).mock.calls[0] as [string, ...unknown[]];
    const url = new URL(path, "http://x");
    expect(url.searchParams.get("date_from")).toBe("2026-01-01");
    expect(url.searchParams.get("date_to")).toBe("2026-06-30");
  });

  it("omits date params when not set", async () => {
    mockApiFetch.mockResolvedValue({ data: [], cursor: null });
    await listStories({ status: "new" });
    const [path] = (mockApiFetch as jest.Mock).mock.calls[0] as [string, ...unknown[]];
    const url = new URL(path, "http://x");
    expect(url.searchParams.get("date_from")).toBeNull();
    expect(url.searchParams.get("date_to")).toBeNull();
  });

  it("omits params that are undefined", async () => {
    mockApiFetch.mockResolvedValue({ data: [], cursor: null });
    await listStories({ status: "new" });
    const [path] = (mockApiFetch as jest.Mock).mock.calls[0] as [string, ...unknown[]];
    const url = new URL(path, "http://x");
    expect(url.searchParams.get("status")).toBe("new");
    expect(url.searchParams.get("project")).toBeNull();
    expect(url.searchParams.get("q")).toBeNull();
  });
});

describe("getStory", () => {
  it("calls /stories/:id with the story id", async () => {
    mockApiFetch.mockResolvedValue({ story_id: "story-001" });
    await getStory("story-001");
    expect(mockApiFetch).toHaveBeenCalledWith("/stories/story-001", {
      method: "GET",
    });
  });

  it("URL-encodes the story id", async () => {
    mockApiFetch.mockResolvedValue({ story_id: "story/with spaces" });
    await getStory("story/with spaces");
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/stories/story%2Fwith%20spaces",
      { method: "GET" },
    );
  });
});
