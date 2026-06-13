import {
  listIntents,
  getIntent,
  listIntentVersions,
  createIntent,
  reviseIntent,
} from "@/lib/api/intents";
import { apiFetch } from "@/lib/api/client";

jest.mock("@/lib/api/client", () => ({
  apiFetch: jest.fn(),
}));

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

afterEach(() => {
  jest.clearAllMocks();
});

describe("intents API", () => {
  it("listIntents builds the correct URL with default limit and no cursor", async () => {
    mockApiFetch.mockResolvedValue({ data: [], cursor: null });

    await listIntents();

    expect(mockApiFetch).toHaveBeenCalledWith("/intents?limit=20", {
      method: "GET",
    });
  });

  it("listIntents appends cursor when provided", async () => {
    mockApiFetch.mockResolvedValue({ data: [], cursor: null });

    await listIntents({ limit: 10, cursor: "next-page" });

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/intents?limit=10&cursor=next-page",
      { method: "GET" },
    );
  });

  it("listIntents returns the service-mode envelope", async () => {
    const envelope = { data: [{ id: "intent_001", title: "Test" }], cursor: null };
    mockApiFetch.mockResolvedValue(envelope);

    const result = await listIntents({ limit: 5 });

    expect(result).toEqual(envelope);
  });

  it("getIntent calls the correct endpoint with URL-encoded id", async () => {
    const dto = { id: "intent_01INTENT000000000000001", title: "Core Planning" };
    mockApiFetch.mockResolvedValue(dto);

    await getIntent("intent_01INTENT000000000000001");

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/intents/intent_01INTENT000000000000001",
      { method: "GET" },
    );
  });

  it("getIntent URL-encodes ids containing slashes or special chars", async () => {
    mockApiFetch.mockResolvedValue({ id: "intent/special" });

    await getIntent("intent/special");

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/intents/intent%2Fspecial",
      { method: "GET" },
    );
  });

  it("listIntentVersions builds the correct URL with limit", async () => {
    const envelope = { data: [], cursor: null };
    mockApiFetch.mockResolvedValue(envelope);

    await listIntentVersions("intent_01INTENT000000000000001", { limit: 20 });

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/intents/intent_01INTENT000000000000001/versions?limit=20",
      { method: "GET" },
    );
  });

  it("listIntentVersions appends cursor when provided", async () => {
    mockApiFetch.mockResolvedValue({ data: [], cursor: null });

    await listIntentVersions("intent_01INTENT000000000000001", {
      limit: 5,
      cursor: "ver-cursor",
    });

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/intents/intent_01INTENT000000000000001/versions?limit=5&cursor=ver-cursor",
      { method: "GET" },
    );
  });

  it("listIntentVersions returns the service-mode envelope", async () => {
    const envelope = {
      data: [
        {
          id: "intent_01INTENT000000000000001",
          title: "Core Platform Planning",
          artifact_type: "intent",
          subtype: null,
          status: "active",
          workspace: "projects",
          file_path: "projects/intents/core-v1.1.0.md",
          created_at: "2026-05-01T00:00:00Z",
          updated_at: "2026-06-01T00:00:00Z",
          frontmatter: { intent_version: "1.1.0", status: "active" },
        },
        {
          id: "intent_01INTENT000000000000000",
          title: "Core Platform Planning",
          artifact_type: "intent",
          subtype: null,
          status: "superseded",
          workspace: "projects",
          file_path: "projects/intents/core-v1.0.0.md",
          created_at: "2026-04-01T00:00:00Z",
          updated_at: "2026-05-01T00:00:00Z",
          frontmatter: { intent_version: "1.0.0", status: "superseded" },
        },
      ],
      cursor: null,
    };
    mockApiFetch.mockResolvedValue(envelope);

    const result = await listIntentVersions("intent_01INTENT000000000000001", {
      limit: 20,
    });

    expect(result).toEqual(envelope);
    expect(result.data).toHaveLength(2);
    expect(result.data[0].status).toBe("active");
    expect(result.data[1].status).toBe("superseded");
  });

  it("createIntent posts to /intents with the correct body", async () => {
    mockApiFetch.mockResolvedValue({
      artifact_id: "intent_new-001",
      message: "Intent created.",
    });

    const result = await createIntent({
      layer: "project",
      title: "New project intent",
      scope: "Platform scope",
      tags: ["platform"],
    });

    expect(mockApiFetch).toHaveBeenCalledWith("/intents", {
      method: "POST",
      body: JSON.stringify({
        layer: "project",
        title: "New project intent",
        scope: "Platform scope",
        tags: ["platform"],
      }),
    });
    expect(result.artifact_id).toBe("intent_new-001");
  });

  it("reviseIntent posts to /intents/:artId/revise with the correct body", async () => {
    mockApiFetch.mockResolvedValue({
      artifact_id: "intent_01INTENT000000000000001",
      message: "Intent revised.",
    });

    const result = await reviseIntent("intent_01INTENT000000000000001", {
      title: "Updated title",
      intent_status: "active",
    });

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/intents/intent_01INTENT000000000000001/revise",
      {
        method: "POST",
        body: JSON.stringify({
          title: "Updated title",
          intent_status: "active",
        }),
      },
    );
    expect(result.artifact_id).toBe("intent_01INTENT000000000000001");
  });
});
