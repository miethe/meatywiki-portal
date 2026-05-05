import {
  createContextPack,
  getContextPack,
  listContextPacks,
  listContextPackVersions,
} from "@/lib/api/projects";
import { apiFetch } from "@/lib/api/client";

jest.mock("@/lib/api/client", () => ({
  apiFetch: jest.fn(),
}));

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

afterEach(() => {
  jest.clearAllMocks();
});

describe("projects API", () => {
  it("creates a context pack with the overlay contract", async () => {
    mockApiFetch.mockResolvedValue({ pack_id: "pack-001" });

    const result = await createContextPack({
      name: "Launch brief",
      description: "Scope for a briefing pack",
      artifact_ids: ["artifact-1", "artifact-2"],
    });

    expect(result.pack_id).toBe("pack-001");
    expect(mockApiFetch).toHaveBeenCalledWith("/projects/", {
      method: "POST",
      body: JSON.stringify({
        name: "Launch brief",
        description: "Scope for a briefing pack",
        artifact_ids: ["artifact-1", "artifact-2"],
      }),
    });
  });

  it("lists context packs with pagination params", async () => {
    mockApiFetch.mockResolvedValue({ data: [], cursor: null });

    await listContextPacks({
      limit: 10,
      cursor: "next-page",
      includeArchived: true,
    });

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/projects/?limit=10&cursor=next-page&include_archived=true",
      { method: "GET" },
    );
  });

  it("fetches a single context pack by id", async () => {
    mockApiFetch.mockResolvedValue({
      pack_id: "pack/with special",
      name: "Pack",
      description: null,
      artifact_ids: [],
      artifact_count: 0,
      version: 1,
    });

    await getContextPack("pack/with special");

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/projects/pack%2Fwith%20special",
      { method: "GET" },
    );
  });

  it("lists context-pack versions", async () => {
    mockApiFetch.mockResolvedValue({
      data: [{ version: 1, updated_at: "2026-05-04T00:00:00Z" }],
      cursor: null,
    });

    await listContextPackVersions("pack-001", { limit: 5 });

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/projects/pack-001/versions?limit=5",
      { method: "GET" },
    );
  });
});
