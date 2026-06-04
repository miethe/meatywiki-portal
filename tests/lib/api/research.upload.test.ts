/**
 * Unit tests for uploadResearchPackage() — fix-research-package-upload.
 *
 * Covers:
 *   - 200 success: response shape wrapping (params/filename/size_bytes)
 *   - 422 array detail (standard FastAPI shape)
 *   - 422 dict detail (package-upload endpoint shape: { code, message, errors? })
 *   - 422 dict detail with no errors array (only message)
 *   - 422 unparseable body (graceful fallback)
 *   - Non-422 error: throws
 *
 * Uses globalThis.fetch mock — no MSW needed.
 */

import { uploadResearchPackage } from "@/lib/api/research";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a mock Response with given status and JSON body. */
function mockResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("uploadResearchPackage()", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    // Mock getApiBase used inside uploadResearchPackage via dynamic import
    jest.mock("@/lib/api/config", () => ({
      getApiBase: () => "http://localhost:8080/api",
    }));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.resetModules();
  });

  const makeFile = (content = "{}", name = "package.json") =>
    new File([content], name, { type: "application/json" });

  // -------------------------------------------------------------------------
  // 200 — wrapped response shape
  // -------------------------------------------------------------------------

  it("returns data.params on 200 success", async () => {
    const backendPayload = {
      params: {
        topic: "pgvector benchmarks",
        research_question: "How does pgvector IVFFlat compare to HNSW at 1M vectors?",
        domain: ["technology"],
      },
      filename: "package.json",
      size_bytes: 123,
    };

    globalThis.fetch = jest.fn().mockResolvedValue(mockResponse(200, backendPayload));

    const result = await uploadResearchPackage(makeFile());

    expect(result.hasFieldErrors).toBe(false);
    expect(result.fieldErrors).toHaveLength(0);
    expect(result.message).toBeNull();
    expect(result.data.params.topic).toBe("pgvector benchmarks");
    expect(result.data.filename).toBe("package.json");
    expect(result.data.size_bytes).toBe(123);
  });

  // -------------------------------------------------------------------------
  // 422 — array detail (standard FastAPI shape)
  // -------------------------------------------------------------------------

  it("parses 422 with array detail into fieldErrors", async () => {
    const body = {
      detail: [
        { loc: ["body", "topic"], msg: "field required", type: "missing" },
        { loc: ["body", "research_question"], msg: "field required", type: "missing" },
      ],
    };

    globalThis.fetch = jest.fn().mockResolvedValue(mockResponse(422, body));

    const result = await uploadResearchPackage(makeFile());

    expect(result.hasFieldErrors).toBe(true);
    expect(result.fieldErrors).toHaveLength(2);
    expect(result.fieldErrors[0]).toEqual({ field: "topic", message: "field required" });
    expect(result.fieldErrors[1]).toEqual({ field: "research_question", message: "field required" });
    expect(result.message).toBeNull();
    // Placeholder data shape must match PackageUploadResponse
    expect(result.data.params.topic).toBe("");
    expect(result.data.filename).toBe("");
    expect(result.data.size_bytes).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 422 — dict detail with errors array
  // -------------------------------------------------------------------------

  it("parses 422 with dict detail (code+message+errors) into fieldErrors and message", async () => {
    const body = {
      detail: {
        code: "schema_validation_failed",
        message: "Package JSON does not match ExternalResearchParams schema",
        errors: [
          { loc: ["topic"], msg: "none is not an allowed value", type: "type_error.none.not_allowed" },
        ],
      },
    };

    globalThis.fetch = jest.fn().mockResolvedValue(mockResponse(422, body));

    const result = await uploadResearchPackage(makeFile());

    expect(result.hasFieldErrors).toBe(true);
    expect(result.message).toBe("Package JSON does not match ExternalResearchParams schema");
    expect(result.fieldErrors).toHaveLength(1);
    expect(result.fieldErrors[0]).toEqual({
      field: "topic",
      message: "none is not an allowed value",
    });
  });

  // -------------------------------------------------------------------------
  // 422 — dict detail with no errors array (message only)
  // -------------------------------------------------------------------------

  it("captures top-level message when 422 dict has no errors array", async () => {
    const body = {
      detail: {
        code: "invalid_json",
        message: "Uploaded file is not valid JSON",
      },
    };

    globalThis.fetch = jest.fn().mockResolvedValue(mockResponse(422, body));

    const result = await uploadResearchPackage(makeFile());

    expect(result.hasFieldErrors).toBe(true);
    expect(result.message).toBe("Uploaded file is not valid JSON");
    expect(result.fieldErrors).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // 422 — unparseable body
  // -------------------------------------------------------------------------

  it("returns empty fieldErrors and null message when 422 body is not JSON", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      new Response("not json", { status: 422 }),
    );

    const result = await uploadResearchPackage(makeFile());

    expect(result.hasFieldErrors).toBe(true);
    expect(result.fieldErrors).toHaveLength(0);
    expect(result.message).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Non-422 HTTP error — throws
  // -------------------------------------------------------------------------

  it("throws on non-422 HTTP error", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(mockResponse(500, { detail: "Internal error" }));

    await expect(uploadResearchPackage(makeFile())).rejects.toThrow(
      "Package upload failed: HTTP 500",
    );
  });
});
