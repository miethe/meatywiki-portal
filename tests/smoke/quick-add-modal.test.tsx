/**
 * Quick Add modal smoke tests.
 *
 * Validates the actual shipped component instead of the placeholder-only a11y
 * fixture:
 * - Note submission enters the ingesting state
 * - The accepted run_id is surfaced in the UI
 * - URL validation blocks invalid submissions
 */

import React from "react";
import { renderWithProviders, screen, waitFor } from "../utils/render";
import { userEvent } from "../utils/userEvent";
import { QuickAddModal } from "@/components/quick-add/quick-add-modal";

jest.mock("@/lib/api/intake", () => ({
  ...jest.requireActual("@/lib/api/intake"),
  submitNote: jest.fn(),
  submitUrl: jest.fn(),
}));

jest.mock("@/hooks/useSSE", () => ({
  useSSE: jest.fn(),
}));

import { submitNote, submitUrl } from "@/lib/api/intake";
import { useSSE } from "@/hooks/useSSE";

const mockSubmitNote = submitNote as jest.MockedFunction<typeof submitNote>;
const mockSubmitUrl = submitUrl as jest.MockedFunction<typeof submitUrl>;
const mockUseSSE = useSSE as jest.MockedFunction<typeof useSSE>;

describe("QuickAddModal", () => {
  beforeEach(() => {
    mockSubmitNote.mockResolvedValue({
      run_id: "run-test-quick-add-01",
      status: "queued",
      created_at: "2026-04-17T00:00:00Z",
    });
    mockSubmitUrl.mockResolvedValue({
      run_id: "run-test-quick-add-02",
      status: "queued",
      created_at: "2026-04-17T00:00:00Z",
    });
    mockUseSSE.mockReturnValue({
      events: [],
      status: "open",
      error: null,
      reconnect: jest.fn(),
      close: jest.fn(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("shows the accepted run ID after a note submission is queued", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <QuickAddModal open onOpenChange={jest.fn()} />,
    );

    await user.type(screen.getByLabelText(/note text/i), "A real smoke-test note");
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() => {
      expect(screen.getByText(/processing your submission/i)).toBeInTheDocument();
    });

    expect(mockSubmitNote).toHaveBeenCalledWith({
      text: "A real smoke-test note",
      tags: undefined,
    });
    expect(screen.getByText(/run id:/i)).toBeInTheDocument();
    expect(screen.getByText("run-test-quick-add-01")).toBeInTheDocument();
  });

  it("blocks invalid URL submission until the URL is valid", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <QuickAddModal open onOpenChange={jest.fn()} />,
    );

    await user.click(screen.getByRole("tab", { name: /url/i }));

    const addButton = screen.getByRole("button", { name: /^add$/i });
    expect(addButton).toBeDisabled();

    const urlInput = screen.getByPlaceholderText("https://…");

    await user.type(urlInput, "not-a-valid-url");
    expect(addButton).toBeDisabled();

    await user.clear(urlInput);
    await user.type(urlInput, "https://example.com/article");

    expect(addButton).toBeEnabled();
  });
});
