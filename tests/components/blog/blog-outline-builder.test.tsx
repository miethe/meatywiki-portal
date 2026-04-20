/**
 * BlogOutlineBuilder component tests (P1.5-3-03).
 *
 * Covers:
 * - Renders the form with topic and source inputs + submit button
 * - Submit shows validation error when topic is empty
 * - Submit transitions to running phase + shows StageTracker
 * - On completion, renders the generated outline sections
 * - "New outline" button resets to form phase
 */

import React from "react";
import { renderWithProviders, screen, waitFor, act } from "../../utils/render";
import { userEvent } from "../../utils/userEvent";
import { BlogOutlineBuilder } from "@/components/blog/blog-outline-builder";

afterEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Form rendering
// ---------------------------------------------------------------------------

describe("BlogOutlineBuilder form", () => {
  it("renders topic input", () => {
    renderWithProviders(<BlogOutlineBuilder />);
    expect(screen.getByRole("textbox", { name: /topic/i })).toBeInTheDocument();
  });

  it("renders source artifacts textarea", () => {
    renderWithProviders(<BlogOutlineBuilder />);
    expect(
      screen.getByRole("textbox", { name: /source artifact ids/i }),
    ).toBeInTheDocument();
  });

  it("renders submit button", () => {
    renderWithProviders(<BlogOutlineBuilder />);
    expect(
      screen.getByRole("button", { name: /generate outline/i }),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe("BlogOutlineBuilder validation", () => {
  it("shows validation error when topic is empty on submit", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BlogOutlineBuilder />);

    const submitBtn = screen.getByRole("button", { name: /generate outline/i });
    await user.click(submitBtn);

    expect(screen.getByRole("alert")).toHaveTextContent(/topic is required/i);
    expect(mockStageTracker()).toBeFalsy();
  });
});

function mockStageTracker() {
  return document.querySelector('[aria-label^="Workflow progress"]');
}

// ---------------------------------------------------------------------------
// Workflow phases
// ---------------------------------------------------------------------------

describe("BlogOutlineBuilder workflow phases", () => {
  it("transitions to running phase on valid submit (stub timer)", async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ delay: null });
    renderWithProviders(<BlogOutlineBuilder />);

    const topicInput = screen.getByRole("textbox", { name: /topic/i });
    await user.type(topicInput, "AI in education");

    const submitBtn = screen.getByRole("button", { name: /generate outline/i });
    await user.click(submitBtn);

    // Running phase should show the topic text
    await waitFor(() => {
      expect(screen.getByText(/ai in education/i)).toBeInTheDocument();
    });

    jest.useRealTimers();
  });

  it("renders the generated outline after completion", async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ delay: null });
    renderWithProviders(<BlogOutlineBuilder />);

    const topicInput = screen.getByRole("textbox", { name: /topic/i });
    await user.type(topicInput, "Testing topic");

    const submitBtn = screen.getByRole("button", { name: /generate outline/i });
    await user.click(submitBtn);

    // Advance past stub 2s timer
    await act(async () => {
      jest.advanceTimersByTime(2_500);
    });

    await waitFor(() => {
      expect(screen.getByText(/introduction/i)).toBeInTheDocument();
      expect(screen.getByText(/conclusion/i)).toBeInTheDocument();
    });
  });

  it("resets to form phase on 'New outline' click", async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ delay: null });
    renderWithProviders(<BlogOutlineBuilder />);

    const topicInput = screen.getByRole("textbox", { name: /topic/i });
    await user.type(topicInput, "Reset test topic");

    await user.click(screen.getByRole("button", { name: /generate outline/i }));

    await act(async () => {
      jest.advanceTimersByTime(2_500);
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /new outline/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /new outline/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /generate outline/i })).toBeInTheDocument();
    });
  });
});
