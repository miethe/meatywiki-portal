/**
 * Unit tests for patchArtifact() — Portal v1.8 P2-05.
 *
 * patchArtifact() uses a raw fetch path (not apiFetch) so it can read
 * the ETag response header before consuming the body.  Tests mock
 * globalThis.fetch directly rather than going through MSW.
 */

import {
  patchArtifact,
  ETagMismatchError,
  ArtifactValidationError,
  type ArtifactPatchFields,
} from "@/lib/api/artifacts";
import { ApiError } from "@/lib/api/client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal ArtifactDetail stub returned by the mock backend. */
const ARTIFACT_STUB = {
  id: "01HXYZ",
  workspace: "library",
  type: "concept",
  title: "Updated Title",
  status: "active",
  file_path: "/wiki/concepts/updated-title.md",
} as const;

const ARTIFACT_ID = "01HXYZ";
const INITIAL_ETAG = '"abc123"';
const NEW_ETAG = '"def456"';

/** Build a minimal fetch Response with given status, headers, and JSON body. */
function mockResponse(
  status: number,
  body: unknown,
  responseHeaders: Record<string, string> = {},
): Response {
  const headers = new Headers(responseHeaders);
  const bodyText = JSON.stringify(body);
  return new Response(bodyText, { status, headers });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("patchArtifact()", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  it("returns {data, etag} on 200 with ETag header", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      mockResponse(200, ARTIFACT_STUB, { ETag: NEW_ETAG }),
    );

    const fields: Partial<ArtifactPatchFields> = { title: "Updated Title" };
    const result = await patchArtifact(ARTIFACT_ID, fields, INITIAL_ETAG);

    expect(result.data.title).toBe("Updated Title");
    expect(result.etag).toBe(NEW_ETAG);
  });

  it("falls back to the request ETag when response has no ETag header", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      mockResponse(200, ARTIFACT_STUB),
    );

    const result = await patchArtifact(ARTIFACT_ID, {}, INITIAL_ETAG);
    expect(result.etag).toBe(INITIAL_ETAG);
  });

  // -------------------------------------------------------------------------
  // If-Match header is sent
  // -------------------------------------------------------------------------

  it("sends If-Match header with the supplied ETag", async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValue(mockResponse(200, ARTIFACT_STUB, { ETag: NEW_ETAG }));
    globalThis.fetch = mockFetch;

    await patchArtifact(ARTIFACT_ID, { title: "Test" }, INITIAL_ETAG);

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    const sentHeaders = init.headers as Headers;
    expect(sentHeaders.get("If-Match")).toBe(INITIAL_ETAG);
  });

  it("sends PATCH method to the correct URL", async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValue(mockResponse(200, ARTIFACT_STUB, { ETag: NEW_ETAG }));
    globalThis.fetch = mockFetch;

    await patchArtifact(ARTIFACT_ID, { status: "archived" }, INITIAL_ETAG);

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(`/artifacts/${ARTIFACT_ID}`);
    expect(init.method).toBe("PATCH");
  });

  it("includes the fields as JSON body", async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValue(mockResponse(200, ARTIFACT_STUB, { ETag: NEW_ETAG }));
    globalThis.fetch = mockFetch;

    const fields: Partial<ArtifactPatchFields> = {
      title: "New Title",
      tags_add: ["foo", "bar"],
    };
    await patchArtifact(ARTIFACT_ID, fields, INITIAL_ETAG);

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual(fields);
  });

  // -------------------------------------------------------------------------
  // 412 — ETag mismatch
  // -------------------------------------------------------------------------

  it("throws ETagMismatchError on 412", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      mockResponse(412, { detail: "ETag mismatch" }),
    );

    await expect(
      patchArtifact(ARTIFACT_ID, { title: "x" }, INITIAL_ETAG),
    ).rejects.toThrow(ETagMismatchError);
  });

  it("throws ETagMismatchError with name 'ETagMismatchError'", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      mockResponse(412, {}),
    );

    let caught: unknown;
    try {
      await patchArtifact(ARTIFACT_ID, {}, INITIAL_ETAG);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ETagMismatchError);
    expect((caught as ETagMismatchError).name).toBe("ETagMismatchError");
  });

  it("extracts currentEtag from 412 body when present", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      mockResponse(412, { etag: NEW_ETAG }),
    );

    let caught: unknown;
    try {
      await patchArtifact(ARTIFACT_ID, {}, INITIAL_ETAG);
    } catch (err) {
      caught = err;
    }

    expect((caught as ETagMismatchError).currentEtag).toBe(NEW_ETAG);
  });

  // -------------------------------------------------------------------------
  // 422 — validation error
  // -------------------------------------------------------------------------

  it("throws ArtifactValidationError on 422", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      mockResponse(422, {
        detail: [
          {
            loc: ["body", "status"],
            msg: "status must be one of ['active', 'archived', 'draft', 'stale']",
            type: "value_error",
          },
        ],
      }),
    );

    await expect(
      patchArtifact(ARTIFACT_ID, { status: "invalid" }, INITIAL_ETAG),
    ).rejects.toThrow(ArtifactValidationError);
  });

  it("extracts field name and message from FastAPI validation body", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      mockResponse(422, {
        detail: [
          {
            loc: ["body", "workspace"],
            msg: "workspace must be one of ['inbox', 'library']",
            type: "value_error",
          },
        ],
      }),
    );

    let caught: unknown;
    try {
      await patchArtifact(ARTIFACT_ID, { workspace: "bad" }, INITIAL_ETAG);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ArtifactValidationError);
    const err = caught as ArtifactValidationError;
    expect(err.field).toBe("workspace");
    expect(err.detail).toContain("workspace must be one of");
    expect(err.name).toBe("ArtifactValidationError");
  });

  // -------------------------------------------------------------------------
  // Other non-2xx errors fall through to ApiError
  // -------------------------------------------------------------------------

  it("throws ApiError on 404", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      mockResponse(404, { detail: "not found" }),
    );

    await expect(
      patchArtifact("nonexistent", {}, INITIAL_ETAG),
    ).rejects.toThrow(ApiError);
  });

  it("throws ApiError on 400 (missing If-Match)", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      mockResponse(400, { detail: "If-Match header is required" }),
    );

    let caught: unknown;
    try {
      await patchArtifact(ARTIFACT_ID, {}, INITIAL_ETAG);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).status).toBe(400);
  });
});
