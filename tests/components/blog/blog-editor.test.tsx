/**
 * BlogEditor component tests (P1.5-3-03).
 *
 * Covers:
 * - Renders title and content inputs
 * - Renders Save and Compile buttons
 * - Auto-save fires after interval when content is dirty (debounce/interval test)
 * - Manual save triggers updateBlogPost when post exists
 * - Manual save triggers createBlogPost when no post is provided
 * - Save error renders an inline error message
 * - Compile button triggers the stub compile flow and shows StageTracker
 *
 * Auto-save debounce test uses jest.useFakeTimers() to advance the 30s interval.
 */

import React from "react";
import { renderWithProviders, screen, waitFor, act } from "../../utils/render";
import { userEvent } from "../../utils/userEvent";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/lib/api/blog", () => ({
  createBlogPost: jest.fn(),
  updateBlogPost: jest.fn(),
  publishBlogPost: jest.fn(),
  archiveBlogPost: jest.fn(),
  listBlogPosts: jest.fn(),
  getBlogPost: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn() })),
  usePathname: jest.fn(() => "/blog/posts/new"),
}));

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useQueryClient: jest.fn(() => ({
    invalidateQueries: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { createBlogPost, updateBlogPost } from "@/lib/api/blog";
import { BlogEditor } from "@/components/blog/blog-editor";

const mockCreateBlogPost = createBlogPost as jest.MockedFunction<typeof createBlogPost>;
const mockUpdateBlogPost = updateBlogPost as jest.MockedFunction<typeof updateBlogPost>;

function makeBlogPost(overrides = {}) {
  return {
    artifact_id: "blog-001",
    title: "Existing post",
    content: "# Hello",
    status: "draft" as const,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-16T00:00:00Z",
    slug: null,
    summary: null,
    run_id: null,
    ...overrides,
  };
}

afterEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe("BlogEditor rendering", () => {
  it("renders title and content inputs", () => {
    renderWithProviders(<BlogEditor />);
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/post content/i)).toBeInTheDocument();
  });

  it("renders Save and Compile buttons", () => {
    renderWithProviders(<BlogEditor />);
    expect(screen.getByRole("button", { name: /save post/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /compile post/i })).toBeInTheDocument();
  });

  it("pre-fills title and content from existing post", () => {
    const post = makeBlogPost();
    renderWithProviders(<BlogEditor post={post} />);
    expect(screen.getByDisplayValue("Existing post")).toBeInTheDocument();
    expect(screen.getByDisplayValue("# Hello")).toBeInTheDocument();
  });

  it("shows 'new post' auto-save note when no post", () => {
    renderWithProviders(<BlogEditor />);
    expect(screen.getByText(/created on first save/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Manual save — create
// ---------------------------------------------------------------------------

describe("BlogEditor manual save (create)", () => {
  it("calls createBlogPost when saving a new post", async () => {
    const user = userEvent.setup();
    mockCreateBlogPost.mockResolvedValue(makeBlogPost({ artifact_id: "blog-new" }));

    renderWithProviders(<BlogEditor />);

    const titleInput = screen.getByLabelText(/title/i);
    await user.clear(titleInput);
    await user.type(titleInput, "New draft title");

    const contentArea = screen.getByLabelText(/post content/i);
    await user.click(contentArea);
    await user.type(contentArea, "Some content");

    const saveBtn = screen.getByRole("button", { name: /save post/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(mockCreateBlogPost).toHaveBeenCalledWith({
        title: "New draft title",
        content: "Some content",
      });
    });
  });

  it("shows inline error when createBlogPost fails", async () => {
    const user = userEvent.setup();
    mockCreateBlogPost.mockRejectedValue(new Error("Network error"));

    renderWithProviders(<BlogEditor />);

    const titleInput = screen.getByLabelText(/title/i);
    await user.type(titleInput, "Failing post");

    const contentArea = screen.getByLabelText(/post content/i);
    await user.type(contentArea, "Content");

    const saveBtn = screen.getByRole("button", { name: /save post/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Manual save — update
// ---------------------------------------------------------------------------

describe("BlogEditor manual save (update)", () => {
  it("calls updateBlogPost for an existing post when content changes", async () => {
    const user = userEvent.setup();
    const post = makeBlogPost();
    mockUpdateBlogPost.mockResolvedValue(makeBlogPost({ title: "Updated Title" }));

    renderWithProviders(<BlogEditor post={post} />);

    const titleInput = screen.getByLabelText(/title/i);
    await user.clear(titleInput);
    await user.type(titleInput, "Updated Title");

    const saveBtn = screen.getByRole("button", { name: /save post/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(mockUpdateBlogPost).toHaveBeenCalledWith(
        "blog-001",
        expect.objectContaining({ title: "Updated Title" }),
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Auto-save (debounce / interval)
// ---------------------------------------------------------------------------

describe("BlogEditor auto-save", () => {
  it("auto-saves after 30 seconds when content is dirty", async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ delay: null });
    const post = makeBlogPost();
    mockUpdateBlogPost.mockResolvedValue(makeBlogPost());

    renderWithProviders(<BlogEditor post={post} />);

    // Dirty the content
    const contentArea = screen.getByLabelText(/post content/i);
    await user.clear(contentArea);
    await user.type(contentArea, "Dirty content");

    // No save should have been called yet
    expect(mockUpdateBlogPost).not.toHaveBeenCalled();

    // Advance timers past the 30s auto-save interval
    await act(async () => {
      jest.advanceTimersByTime(31_000);
    });

    await waitFor(() => {
      expect(mockUpdateBlogPost).toHaveBeenCalled();
    });
  });

  it("does NOT auto-save when content is not dirty", async () => {
    jest.useFakeTimers();

    const post = makeBlogPost();
    renderWithProviders(<BlogEditor post={post} />);

    // Advance timers without changing anything
    await act(async () => {
      jest.advanceTimersByTime(31_000);
    });

    expect(mockUpdateBlogPost).not.toHaveBeenCalled();
    expect(mockCreateBlogPost).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Compile trigger
// ---------------------------------------------------------------------------

describe("BlogEditor compile", () => {
  it("shows StageTracker after clicking Compile on an existing post", async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ delay: null });
    const post = makeBlogPost();
    mockUpdateBlogPost.mockResolvedValue(post);

    renderWithProviders(<BlogEditor post={post} />);

    // Dirty the title so save proceeds
    const titleInput = screen.getByLabelText(/title/i);
    await user.clear(titleInput);
    await user.type(titleInput, "Ready to compile");

    const compileBtn = screen.getByRole("button", { name: /compile post/i });
    await user.click(compileBtn);

    await waitFor(() => {
      expect(screen.getByText(/compile workflow/i)).toBeInTheDocument();
    });
  });
});
