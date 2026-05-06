import { expect, test, type Page, type Route } from "@playwright/test";

const PACK_ID = "pack-launch-brief-001";
const PACK_NAME = "Launch briefing pack";
const PACK_DESCRIPTION = "Five-artifact project context for launch planning.";

const ARTIFACTS = Array.from({ length: 5 }, (_, index) => {
  const number = index + 1;
  return {
    id: `artifact-${number}`,
    workspace: index % 2 === 0 ? "library" : "research",
    type: index === 4 ? "synthesis" : "concept",
    title: `Project source ${number}`,
    status: "active",
    file_path: `wiki/concepts/project-source-${number}.md`,
    created: "2026-05-01T00:00:00Z",
    updated: `2026-05-0${number}T12:00:00Z`,
    preview: `Source ${number} for the launch briefing pack.`,
  };
});

const PACK = {
  pack_id: PACK_ID,
  name: PACK_NAME,
  description: PACK_DESCRIPTION,
  artifact_ids: ARTIFACTS.map((artifact) => artifact.id),
  artifact_count: 5,
  version: 3,
  created_at: "2026-05-05T10:00:00Z",
  updated_at: "2026-05-05T11:00:00Z",
};

const VERSIONS = {
  data: [
    {
      version: 3,
      updated_at: "2026-05-05T11:00:00Z",
      description: "Created from five selected artifacts.",
    },
    {
      version: 2,
      updated_at: "2026-05-05T10:30:00Z",
      description: "Artifact scope refined.",
    },
  ],
  cursor: null,
};

const PACK_ARTIFACT_CARD = {
  id: PACK_ID,
  workspace: "projects",
  type: "synthesis",
  title: PACK_NAME,
  status: "active",
  file_path: `projects/${PACK_ID}.md`,
  created: PACK.created_at,
  updated: PACK.updated_at,
  preview: PACK_DESCRIPTION,
};

async function seedAuth(page: Page): Promise<void> {
  const token = process.env.MEATYWIKI_PORTAL_TOKEN ?? "test-token-e2e";
  await page.context().addCookies(
    ["127.0.0.1", "localhost"].map((domain) => ({
      name: "portal_session",
      value: token,
      domain,
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax" as const,
    })),
  );
}

async function fulfillJson(
  route: Route,
  body: unknown,
  status = 200,
): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function installProjectsMocks(
  page: Page,
  options: {
    createStatus?: number;
    createBody?: unknown;
    requestUrls?: string[];
    createBodies?: unknown[];
  } = {},
): Promise<void> {
  await page.route("**/api/auth/session", async (route) => {
    await fulfillJson(route, { authenticated: true, valid: true });
  });

  await page.route("**/api/projects**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    options.requestUrls?.push(url.pathname);

    if (
      request.method() === "POST" &&
      url.pathname.endsWith("/api/projects/")
    ) {
      const rawBody = request.postData();
      if (rawBody) {
        options.createBodies?.push(JSON.parse(rawBody));
      }
      return fulfillJson(
        route,
        options.createBody ?? { pack_id: PACK_ID },
        options.createStatus ?? 200,
      );
    }

    if (request.method() !== "GET") return route.continue();

    if (url.pathname.endsWith(`/api/projects/${PACK_ID}/versions`)) {
      return fulfillJson(route, VERSIONS);
    }

    if (url.pathname.endsWith(`/api/projects/${PACK_ID}`)) {
      return fulfillJson(route, PACK);
    }

    if (url.pathname.endsWith("/api/projects/")) {
      return fulfillJson(route, { data: [PACK], cursor: null });
    }

    return fulfillJson(route, { error: "not_found" }, 404);
  });

  await page.route("**/api/artifacts**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    options.requestUrls?.push(url.pathname);

    if (request.method() !== "GET") return route.continue();

    if (url.pathname.endsWith(`/api/artifacts/${PACK_ID}`)) {
      return fulfillJson(route, { error: "not_found" }, 404);
    }

    if (url.pathname.endsWith("/edges")) {
      return fulfillJson(route, {
        artifact_id: PACK_ID,
        incoming: [],
        outgoing: [],
      });
    }

    if (
      url.pathname.endsWith("/derivatives") ||
      url.pathname.endsWith("/workflow-runs") ||
      url.pathname.endsWith("/activity") ||
      url.pathname.endsWith("/backlinks") ||
      url.pathname.endsWith("/processing-history") ||
      url.pathname.endsWith("/quality-gates")
    ) {
      return fulfillJson(route, { data: { items: [], cursor: null } });
    }

    if (url.pathname.endsWith("/api/artifacts")) {
      const isProjectsList = url.searchParams.get("facet") === "projects";
      return fulfillJson(route, {
        data: isProjectsList ? [PACK_ARTIFACT_CARD] : ARTIFACTS,
        cursor: null,
      });
    }

    return fulfillJson(route, { error: "not_found" }, 404);
  });

  await page.route("**/api/workflows/runs**", async (route) => {
    options.requestUrls?.push(new URL(route.request().url()).pathname);
    await fulfillJson(route, { data: { items: [], cursor: null, total: 0 } });
  });

  await page.route("**/api/workflow-events**", async (route) => {
    options.requestUrls?.push(new URL(route.request().url()).pathname);
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: "",
    });
  });
}

async function selectAllArtifactsAndContinue(page: Page): Promise<void> {
  await expect(
    page.getByRole("heading", { name: "Context Pack Builder" }),
  ).toBeVisible({ timeout: 20_000 });

  for (const artifact of ARTIFACTS) {
    await page.getByRole("checkbox", { name: artifact.title }).check();
  }

  await expect(page.getByText("5 selected")).toBeVisible();
  await page.getByRole("button", { name: /^continue$/i }).click();
}

test.describe("Portal v2 Projects context-pack journey", () => {
  test("creates a five-artifact context pack, opens Projects, and renders overlay detail fallback", async ({
    page,
  }) => {
    const createBodies: unknown[] = [];
    const requestUrls: string[] = [];
    await seedAuth(page);
    await installProjectsMocks(page, { createBodies, requestUrls });

    await page.goto("/projects/new");
    await selectAllArtifactsAndContinue(page);

    await page.getByLabel("Name").fill(PACK_NAME);
    await page.getByLabel("Description").fill(PACK_DESCRIPTION);
    await page.getByRole("button", { name: /create context pack/i }).click();

    await expect(page.getByText("Context pack created")).toBeVisible();
    await expect(page.getByText(PACK_ID)).toBeVisible();
    await expect(page.getByText("v3")).toBeVisible();
    await expect(page.getByText("5")).toBeVisible();
    expect(createBodies).toEqual([
      {
        name: PACK_NAME,
        description: PACK_DESCRIPTION,
        artifact_ids: ARTIFACTS.map((artifact) => artifact.id),
      },
    ]);

    await expect(
      page.getByRole("link", { name: "View Projects" }),
    ).toHaveAttribute("href", "/projects");
    await page.goto("/projects");
    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: `View ${PACK_NAME}` }),
    ).toBeVisible();

    await page.getByRole("link", { name: `View ${PACK_NAME}` }).click();
    const contextPackDetail = page.locator(
      '[aria-label="Context pack detail"]',
    );
    await expect(contextPackDetail).toBeVisible({ timeout: 20_000 });
    await expect(
      contextPackDetail.getByRole("heading", { name: PACK_NAME }),
    ).toBeVisible();
    await expect(contextPackDetail.getByText(PACK_DESCRIPTION)).toBeVisible();
    await expect(contextPackDetail.getByText("v3").first()).toBeVisible();
    await expect(contextPackDetail.getByText("v2")).toBeVisible();
    await expect(
      page.getByRole("list", { name: "Context pack member artifacts" }),
    ).toBeVisible();
    for (const artifact of ARTIFACTS) {
      await expect(page.getByRole("link", { name: artifact.id })).toBeVisible();
    }

    expect(requestUrls).toContain(`/api/artifacts/${PACK_ID}`);
    expect(requestUrls).toContain(`/api/projects/${PACK_ID}`);
    expect(requestUrls).toContain(`/api/projects/${PACK_ID}/versions`);
  });

  test("surfaces invalid artifact and duplicate-name API errors without SAM or SSE dependencies", async ({
    page,
  }) => {
    const cases = [
      { status: 422, body: { detail: "invalid artifact_ids" } },
      { status: 409, body: { detail: "context pack name already exists" } },
    ];

    for (const apiCase of cases) {
      const requestUrls: string[] = [];
      await seedAuth(page);
      await installProjectsMocks(page, {
        createStatus: apiCase.status,
        createBody: apiCase.body,
        requestUrls,
      });

      await page.goto("/projects/new");
      await selectAllArtifactsAndContinue(page);
      await page.getByLabel("Name").fill(PACK_NAME);
      await page.getByLabel("Description").fill(PACK_DESCRIPTION);
      await page.getByRole("button", { name: /create context pack/i }).click();

      await expect(
        page.getByRole("alert").filter({
          hasText: `API error ${apiCase.status}`,
        }),
      ).toBeVisible();
      await expect(page.getByText("Context pack created")).not.toBeVisible();

      expect(requestUrls.some((url) => url.includes("sam"))).toBe(false);
      expect(requestUrls.some((url) => url.includes("sse"))).toBe(false);
      expect(requestUrls.some((url) => url.includes("workflow-events"))).toBe(
        false,
      );

      await page.unroute("**/api/projects**");
      await page.unroute("**/api/artifacts**");
      await page.unroute("**/api/auth/session");
      await page.unroute("**/api/workflows/runs**");
      await page.unroute("**/api/workflow-events**");
    }
  });
});
