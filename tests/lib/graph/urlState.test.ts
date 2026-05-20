/**
 * P4-S1 — URL state seam verification test.
 *
 * Verifies that the P3→P4 URL state extension:
 *   1. Round-trips all 8 state dimensions (encode → decode → same values)
 *   2. Preserves existing P3 filter params (ws[], types[], etc.)
 *   3. Ceiling guard fires when URL > 1800 chars (state_hash path)
 *   4. Hydration from localStorage succeeds when state_hash entry exists
 *   5. filterStateExpired = true when localStorage entry is missing
 *   6. FNV-1a produces stable non-negative integers
 *
 * No DOM / WebGL required; all localStorage access is simulated.
 */

import { buildUrl, parseUrl, fnv1a, type GraphUrlState, type FilterState } from "@/lib/graph/urlState";

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

// jsdom provides localStorage; make sure it's clean between tests.
beforeEach(() => {
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// §1 — FNV-1a hash
// ---------------------------------------------------------------------------

describe("fnv1a", () => {
  it("returns a non-negative integer for any string", () => {
    expect(fnv1a("")).toBeGreaterThanOrEqual(0);
    expect(fnv1a("hello")).toBeGreaterThanOrEqual(0);
  });

  it("is deterministic — same input always produces same output", () => {
    const h1 = fnv1a("graph-state-test");
    const h2 = fnv1a("graph-state-test");
    expect(h1).toBe(h2);
  });

  it("differs for different inputs", () => {
    expect(fnv1a("abc")).not.toBe(fnv1a("xyz"));
  });

  it("fits in a 32-bit unsigned integer (≤ 4294967295)", () => {
    for (const s of ["a", "hello world", "uuid-like-string-abc-123"]) {
      expect(fnv1a(s)).toBeLessThanOrEqual(4294967295);
    }
  });
});

// ---------------------------------------------------------------------------
// §2 — buildUrl / parseUrl round-trip (all 8 dimensions)
// ---------------------------------------------------------------------------

describe("URL state round-trip — all 8 dimensions", () => {
  const state: GraphUrlState = {
    node_id: "aaaabbbb-cccc-dddd-eeee-ffffffff0000",
    focus_mode: "upstream",
    focus_k: 3,
    grouping: "artifact_type",
    mode: "static",
    layout_cache_key: "etag-v3",
    filters: {
      ws: ["library", "research"],
      types: ["concept", "entity"],
      edges: ["derived_from"],
      q: "anthropic safety",
    },
  };

  it("encodes all 8 dimensions and decodes them back correctly", () => {
    const url = buildUrl("/graph/vault", state);
    const { state: decoded, filterStateExpired } = parseUrl(url.split("?")[1] ?? "");

    expect(filterStateExpired).toBe(false);
    expect(decoded.node_id).toBe(state.node_id);
    expect(decoded.focus_mode).toBe("upstream");
    expect(decoded.focus_k).toBe(3);
    expect(decoded.grouping).toBe("artifact_type");
    expect(decoded.mode).toBe("static");
    expect(decoded.layout_cache_key).toBe("etag-v3");
    expect(decoded.filters?.ws).toEqual(["library", "research"]);
    expect(decoded.filters?.types).toEqual(["concept", "entity"]);
    expect(decoded.filters?.edges).toEqual(["derived_from"]);
    expect(decoded.filters?.q).toBe("anthropic safety");
  });

  it("P3 filter direct params are preserved alongside P4 interaction params", () => {
    const url = buildUrl("/graph/vault", {
      ...state,
      filters: {
        ws: ["library"],
        types: ["concept"],
        freshness: ["current"],
        project: ["meatywiki"],
        domain: ["ai-safety"],
        date_from: "2026-01-01",
        date_to: "2026-05-17",
        q: "test",
      },
    });

    // All direct params should be present as readable query params
    expect(url).toContain("ws%5B%5D=library");
    expect(url).toContain("types%5B%5D=concept");
    expect(url).toContain("freshness%5B%5D=current");
    expect(url).toContain("project%5B%5D=meatywiki");
    expect(url).toContain("domain%5B%5D=ai-safety");
    expect(url).toContain("date_from=2026-01-01");
    expect(url).toContain("date_to=2026-05-17");
    expect(url).toContain("q=test");
  });
});

// ---------------------------------------------------------------------------
// §3 — Defaults when params are absent
// ---------------------------------------------------------------------------

describe("parseUrl defaults", () => {
  it("focus_mode defaults to 'off' when absent", () => {
    const { state } = parseUrl("");
    expect(state.focus_mode).toBe("off");
  });

  it("focus_k defaults to 2 when absent", () => {
    const { state } = parseUrl("");
    expect(state.focus_k).toBe(2);
  });

  it("grouping defaults to 'workspace' when absent", () => {
    const { state } = parseUrl("");
    expect(state.grouping).toBe("workspace");
  });

  it("mode defaults to 'static' when absent", () => {
    const { state } = parseUrl("");
    expect(state.mode).toBe("static");
  });

  it("mode=dynamic is preserved", () => {
    const url = buildUrl("/graph/vault", { mode: "dynamic" });
    const { state } = parseUrl(url.split("?")[1] ?? "");
    expect(state.mode).toBe("dynamic");
  });

  it("focus_k clamps to [1, 5]", () => {
    const { state: s1 } = parseUrl("focus_k=0");
    expect(s1.focus_k).toBe(1);
    const { state: s2 } = parseUrl("focus_k=10");
    expect(s2.focus_k).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// §4 — Client-side filter dims in base64 blob
// ---------------------------------------------------------------------------

describe("client-side filter blob", () => {
  const clientFilters: FilterState = {
    fidelity_min: 0.4,
    conf_min: 0.3,
    conf_max: 0.9,
    tags: ["ai", "safety"],
    lifecycle: ["active"],
    verif: ["verified"],
  };

  it("round-trips client dims through base64 blob", () => {
    const url = buildUrl("/graph/vault", { filters: clientFilters });
    expect(url).toContain("filters=");
    const { state } = parseUrl(url.split("?")[1] ?? "");
    expect(state.filters?.fidelity_min).toBe(0.4);
    expect(state.filters?.conf_min).toBe(0.3);
    expect(state.filters?.conf_max).toBe(0.9);
    expect(state.filters?.tags).toEqual(["ai", "safety"]);
    expect(state.filters?.lifecycle).toEqual(["active"]);
    expect(state.filters?.verif).toEqual(["verified"]);
  });
});

// ---------------------------------------------------------------------------
// §5 — Ceiling guard (URL > 1800 chars → state_hash localStorage handoff)
// ---------------------------------------------------------------------------

describe("ceiling guard — URL > 1800 chars", () => {
  it("uses state_hash when the URL would exceed 1800 chars", () => {
    // Create a large FilterState with many tags to inflate the base64 blob
    const bigFilters: FilterState = {
      tags: Array.from({ length: 50 }, (_, i) => `tag-value-very-long-${i}-padded`),
      ws: ["library", "research", "inbox", "blog"],
      types: ["concept", "entity", "topic_note", "synthesis", "evidence_matrix", "glossary_term"],
      domain: ["ai-safety", "llm-research", "knowledge-management", "compilers", "distributed-systems"],
      lifecycle: ["active", "draft", "archived"],
    };

    const url = buildUrl("/graph/vault", { filters: bigFilters });

    // Ceiling guard should have fired
    expect(url).toContain("state_hash=");
    expect(url).not.toContain("filters=");
    expect(url.length).toBeLessThanOrEqual(1800);

    // localStorage should have the full filter state
    const hash = new URLSearchParams(url.split("?")[1]).get("state_hash");
    expect(hash).toBeTruthy();
    const stored = localStorage.getItem(`graph:shared:${hash}`);
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!) as FilterState;
    expect(parsed.tags?.length).toBe(50);
  });

  it("restores full state from localStorage when state_hash is present", () => {
    // Must use same long-tag format to ensure URL > 1800 chars
    const bigFilters: FilterState = {
      tags: Array.from({ length: 50 }, (_, i) => `tag-value-very-long-${i}-padded`),
      ws: ["library"],
    };

    const url = buildUrl("/graph/vault", { filters: bigFilters });
    expect(url).toContain("state_hash=");

    const { state, filterStateExpired } = parseUrl(url.split("?")[1] ?? "");
    expect(filterStateExpired).toBe(false);
    expect(state.filters?.tags?.length).toBe(50);
    expect(state.filters?.ws).toEqual(["library"]);
  });

  it("sets filterStateExpired = true when localStorage entry is missing", () => {
    // Manually construct a URL with a state_hash that has no matching localStorage entry
    const fakeHash = "deadbeef";
    const { state, filterStateExpired } = parseUrl(`state_hash=${fakeHash}`);
    expect(filterStateExpired).toBe(true);
    expect(state.filters).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// §6 — P3 filter params are not broken by P4 interaction params
// ---------------------------------------------------------------------------

describe("P3 → P4 coexistence: filter params + interaction params", () => {
  it("P4 interaction params do not collide with P3 filter param names", () => {
    const url = buildUrl("/graph/vault", {
      node_id: "abc123",
      focus_mode: "downstream",
      mode: "dynamic",
      grouping: "workspace",
      filters: {
        ws: ["research"],
        types: ["concept"],
        q: "safety",
        fidelity_min: 0.6,
      },
    });

    const params = new URLSearchParams(url.split("?")[1]);

    // P4 interaction dims present
    expect(params.get("node_id")).toBe("abc123");
    expect(params.get("focus_mode")).toBe("downstream");
    expect(params.get("mode")).toBe("dynamic");
    // grouping=workspace is the default, so it should be omitted
    expect(params.get("grouping")).toBeNull();

    // P3 filter dims present
    expect(params.getAll("ws[]")).toContain("research");
    expect(params.getAll("types[]")).toContain("concept");
    expect(params.get("q")).toBe("safety");

    // Client dim in base64 blob
    const filtersBlob = params.get("filters");
    expect(filtersBlob).toBeTruthy();
    const decoded = JSON.parse(atob(filtersBlob!));
    expect(decoded.fidelity_min).toBe(0.6);
  });

  it("round-trip preserves P3 filter dims alongside P4 params", () => {
    const url = buildUrl("/graph/vault", {
      node_id: "test-node-id",
      focus_mode: "k-hop",
      focus_k: 2,
      mode: "static",
      filters: {
        ws: ["library"],
        freshness: ["current"],
        date_from: "2026-01-01",
        date_to: "2026-05-17",
        q: "knowledge",
        conf_min: 0.5,
      },
    });

    const { state } = parseUrl(url.split("?")[1] ?? "");

    // P4 dims
    expect(state.node_id).toBe("test-node-id");
    expect(state.focus_mode).toBe("k-hop");
    expect(state.focus_k).toBe(2);

    // P3 dims
    expect(state.filters?.ws).toEqual(["library"]);
    expect(state.filters?.freshness).toEqual(["current"]);
    expect(state.filters?.date_from).toBe("2026-01-01");
    expect(state.filters?.date_to).toBe("2026-05-17");
    expect(state.filters?.q).toBe("knowledge");

    // Client dim
    expect(state.filters?.conf_min).toBe(0.5);
  });
});
