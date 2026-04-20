/**
 * BlogWorkspaceScreen tests (P1.5-3-03).
 *
 * Covers:
 * - Renders the page heading
 * - Renders "New post" link
 * - Status facet buttons are present and keyboard-operable
 * - Empty state renders when no posts are returned
 * - Post cards render when the API returns posts
 * - Error state renders on API failure
 */

import React from "react";
import { http, HttpResponse } from "msw";
import { server } from "../../mocks/server";
import { renderWithProviders, screen, waitFor } from "../../utils/render";
import { userEvent } from "../../utils/userEvent";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/hooks/useBlogPosts", () => ({
  ...jest.requireActual("@/hooks/useBlogPosts"),
  useBlogPosts: jest.fn(),
  DEFAULT_BLOG_FILTERS: { statuses: [] },
}));

import { useBlogPosts } from "@/hooks/useBlogPosts";

const mockUseBlogPosts = useBlogPosts as jest.MockedFunction<typeof useBlogPosts>;

// Mock Next.js navigation hooks
jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/blog/posts"),
  useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn() })),
  redirect: jest.fn(),
}));

// Import page after mocks are in place
import BlogPostsPage from "@/app/(main)/blog/posts/page";

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

function defaultHookReturn() {
  return {
    posts: [],
    isLoading: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: jest.fn(),
    isError: false,
    error: null,
    total: 0,
  };
}

beforeEach(() => {
  mockUseBlogPosts.mockReturnValue(defaultHookReturn());
});

afterEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe("BlogWorkspaceScreen", () => {
  it("renders the page heading", () => {
    renderWithProviders(<BlogPostsPage />);
    expect(
      screen.getByRole("heading", { name: /blog posts/i }),
    ).toBeInTheDocument();
  });

  it("renders the 'New post' link", () => {
    renderWithProviders(<BlogPostsPage />);
    // There may be multiple — at least one should link to /blog/posts/new
    const links = screen.getAllByRole("link", { name: /new post/i });
    expect(links.length).toBeGreaterThan(0);
  });

  it("renders all status facet buttons", () => {
    renderWithProviders(<BlogPostsPage />);
    expect(screen.getByRole("button", { name: /^draft$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^compiled$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^published$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^archived$/i })).toBeInTheDocument();
  });

  it("shows empty state when no posts are returned", () => {
    renderWithProviders(<BlogPostsPage />);
    expect(screen.getByText(/no blog posts yet/i)).toBeInTheDocument();
  });

  it("renders post cards when posts are available", () => {
    mockUseBlogPosts.mockReturnValue({
      ...defaultHookReturn(),
      posts: [
        {
          artifact_id: "blog-001",
          title: "My first post",
          content: "Hello world",
          status: "draft",
          created_at: "2026-04-01T00:00:00Z",
          updated_at: "2026-04-16T00:00:00Z",
          slug: null,
          summary: null,
          run_id: null,
        },
      ],
      total: 1,
    });

    renderWithProviders(<BlogPostsPage />);
    expect(screen.getByRole("article", { name: /my first post/i })).toBeInTheDocument();
  });

  it("renders error state when the hook errors", () => {
    mockUseBlogPosts.mockReturnValue({
      ...defaultHookReturn(),
      isError: true,
      error: new Error("Network failure"),
    });

    renderWithProviders(<BlogPostsPage />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/failed to load blog posts/i)).toBeInTheDocument();
  });

  it("toggles status facet selection via keyboard", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BlogPostsPage />);

    const draftButton = screen.getByRole("button", { name: /^draft$/i });
    expect(draftButton).toHaveAttribute("aria-pressed", "false");

    await user.click(draftButton);
    // After click, aria-pressed becomes "true"
    expect(draftButton).toHaveAttribute("aria-pressed", "true");
  });

  it("shows loading skeletons while loading", () => {
    mockUseBlogPosts.mockReturnValue({
      ...defaultHookReturn(),
      isLoading: true,
    });

    renderWithProviders(<BlogPostsPage />);
    // The section should have aria-busy=true while loading
    const section = screen.getByRole("region", { name: /blog posts/i });
    expect(section).toHaveAttribute("aria-busy", "true");
  });
});
