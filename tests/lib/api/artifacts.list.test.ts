import { listArtifacts } from "@/lib/api/artifacts";
import { apiFetch } from "@/lib/api/client";

jest.mock("@/lib/api/client", () => ({
  apiFetch: jest.fn(),
}));

const mockedApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

describe("listArtifacts URL building", () => {
  beforeEach(() => {
    mockedApiFetch.mockResolvedValue({ data: [], cursor: null, etag: "" });
  });

  afterEach(() => {
    mockedApiFetch.mockReset();
  });

  it("serializes card context, date bounds, and tag filters", async () => {
    await listArtifacts({
      workspace: "library",
      type: ["concept", "entity"],
      status: ["active"],
      dateFrom: "2026-05-01",
      dateTo: "2026-05-05",
      tags: ["ml", "workflow"],
      cardContext: true,
      limit: 25,
    });

    const [path, init] = mockedApiFetch.mock.calls[0];
    expect(init).toEqual({ method: "GET" });

    const url = new URL(`http://portal.test${path}`);
    expect(url.pathname).toBe("/artifacts");
    expect(url.searchParams.get("workspace")).toBe("library");
    expect(url.searchParams.getAll("type")).toEqual(["concept", "entity"]);
    expect(url.searchParams.getAll("status")).toEqual(["active"]);
    expect(url.searchParams.get("date_from")).toBe("2026-05-01");
    expect(url.searchParams.get("date_to")).toBe("2026-05-05");
    expect(url.searchParams.getAll("tag[]")).toEqual(["ml", "workflow"]);
    expect(url.searchParams.get("card_context")).toBe("true");
    expect(url.searchParams.get("limit")).toBe("25");
  });
});
