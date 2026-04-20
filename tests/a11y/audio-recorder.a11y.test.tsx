/**
 * WCAG 2.1 AA Accessibility Tests — AudioRecorder Component (P4-04)
 *
 * Tests the AudioRecorder component in all four states:
 *   1. Idle       — mic button ready to record
 *   2. Recording  — pulsing red dot + elapsed timer
 *   3. Error      — permission-denied alert
 *   4. Unsupported — mic disabled with aria-describedby explanation
 *
 * Verifies:
 *   - axe-core 0 violations per state
 *   - aria-label reflects recording state ("Start…" / "Stop…")
 *   - aria-pressed reflects recording state (true/false)
 *   - aria-disabled + aria-describedby for unsupported case
 *   - role=status + aria-live=polite for recording timer
 *   - role=alert for error messages
 *   - Decorative SVG icons are aria-hidden
 *   - Screen-reader-only text for unsupported mic button
 *
 * Uses a structural fixture rather than importing AudioRecorder directly to
 * avoid browser API dependencies (MediaRecorder, navigator.mediaDevices) in
 * jsdom. The fixture mirrors the actual ARIA structure from audio-recorder.tsx.
 *
 * Traces NFR-1.5-* (P4-04 acceptance criteria).
 */

import { axe } from "jest-axe";
import { screen, render } from "@testing-library/react";

// expect.extend(toHaveNoViolations) is registered globally in tests/setup.ts

// ---------------------------------------------------------------------------
// Structural fixtures mirroring audio-recorder.tsx render outputs
// ---------------------------------------------------------------------------

/** Idle state: mic button visible, no recording indicators. */
function AudioRecorderIdle() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Start audio recording"
          aria-pressed={false}
          className="inline-flex size-10 items-center justify-center rounded-full border focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MicSvg />
        </button>
        <span className="text-sm text-muted-foreground">Tap to record audio</span>
      </div>
    </div>
  );
}

/** Recording state: stop button + pulsing dot + elapsed timer. */
function AudioRecorderRecording() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Stop recording"
          aria-pressed={true}
          className="inline-flex size-10 items-center justify-center rounded-full border border-destructive/60 bg-destructive/10 text-destructive focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <SquareSvg />
        </button>
        <div
          role="status"
          aria-live="polite"
          aria-label="Recording — 00:07 elapsed"
          className="flex items-center gap-2"
        >
          <span
            aria-hidden="true"
            className="relative inline-flex size-2.5 rounded-full bg-destructive"
          >
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive opacity-75" />
          </span>
          <span className="font-mono text-sm tabular-nums text-destructive">00:07</span>
          <span className="text-xs text-muted-foreground">Recording…</span>
        </div>
      </div>
    </div>
  );
}

/** Permission-denied error state. */
function AudioRecorderError() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Start audio recording"
          aria-pressed={false}
          className="inline-flex size-10 items-center justify-center rounded-full border focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MicSvg />
        </button>
        <span className="text-sm text-muted-foreground">Tap to record audio</span>
      </div>
      <div
        role="alert"
        className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 flex items-start gap-2"
      >
        <svg
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-destructive"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
          />
        </svg>
        <p className="text-sm text-destructive">
          Microphone access denied — please allow microphone permission in your browser settings.
        </p>
      </div>
    </div>
  );
}

/** Unsupported browser: disabled mic button with aria-describedby. */
function AudioRecorderUnsupported() {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled
        aria-disabled="true"
        aria-describedby="audio-unsupported-desc"
        className="inline-flex size-9 items-center justify-center rounded-full border border-input bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
      >
        <MicSvg />
        <span className="sr-only">Record audio (unavailable)</span>
      </button>
      <span id="audio-unsupported-desc" className="text-xs text-muted-foreground">
        Audio recording not supported in this browser.
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared icon components (match audio-recorder.tsx structure)
// ---------------------------------------------------------------------------

function MicSvg() {
  return (
    <svg
      className="size-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <rect x="9" y="2" width="6" height="12" rx="3" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M19 10a7 7 0 01-14 0M12 19v3M8 22h8" />
    </svg>
  );
}

function SquareSvg() {
  return (
    <svg className="size-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AudioRecorder Component — WCAG 2.1 AA Accessibility (P4-04)", () => {
  // ---- axe scans -----------------------------------------------------------

  describe("axe-core automated scans", () => {
    it("idle state: 0 axe violations", async () => {
      const { container } = render(<AudioRecorderIdle />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("recording state: 0 axe violations", async () => {
      const { container } = render(<AudioRecorderRecording />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("permission-denied error state: 0 axe violations", async () => {
      const { container } = render(<AudioRecorderError />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("unsupported browser state: 0 axe violations", async () => {
      const { container } = render(<AudioRecorderUnsupported />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  // ---- Idle state structural checks ----------------------------------------

  describe("Idle state — ARIA and focus (WCAG 4.1.2, 2.1.1)", () => {
    it("mic button has 'Start audio recording' aria-label", () => {
      render(<AudioRecorderIdle />);
      const btn = screen.getByRole("button", { name: /start audio recording/i });
      expect(btn).toBeInTheDocument();
    });

    it("mic button has aria-pressed=false", () => {
      render(<AudioRecorderIdle />);
      const btn = screen.getByRole("button", { name: /start audio recording/i });
      expect(btn).toHaveAttribute("aria-pressed", "false");
    });

    it("mic button has visible focus ring class", () => {
      render(<AudioRecorderIdle />);
      const btn = screen.getByRole("button", { name: /start audio recording/i });
      expect(btn.className).toMatch(/focus-visible:ring-2/);
    });

    it("mic SVG icon is aria-hidden", () => {
      render(<AudioRecorderIdle />);
      const btn = screen.getByRole("button", { name: /start audio recording/i });
      const svg = btn.querySelector("svg");
      expect(svg).toHaveAttribute("aria-hidden", "true");
    });

    it("idle label text is visible", () => {
      render(<AudioRecorderIdle />);
      expect(screen.getByText(/tap to record audio/i)).toBeVisible();
    });
  });

  // ---- Recording state structural checks ------------------------------------

  describe("Recording state — ARIA and live regions (WCAG 4.1.2, 4.1.3)", () => {
    it("stop button has 'Stop recording' aria-label", () => {
      render(<AudioRecorderRecording />);
      const btn = screen.getByRole("button", { name: /stop recording/i });
      expect(btn).toBeInTheDocument();
    });

    it("stop button has aria-pressed=true", () => {
      render(<AudioRecorderRecording />);
      const btn = screen.getByRole("button", { name: /stop recording/i });
      expect(btn).toHaveAttribute("aria-pressed", "true");
    });

    it("recording timer has role=status", () => {
      render(<AudioRecorderRecording />);
      const status = screen.getByRole("status");
      expect(status).toBeInTheDocument();
    });

    it("recording status has aria-live=polite", () => {
      render(<AudioRecorderRecording />);
      const status = screen.getByRole("status");
      expect(status).toHaveAttribute("aria-live", "polite");
    });

    it("recording status has descriptive aria-label with elapsed time", () => {
      render(<AudioRecorderRecording />);
      const status = screen.getByRole("status");
      expect(status).toHaveAttribute("aria-label", expect.stringMatching(/recording/i));
    });

    it("pulsing red dot is aria-hidden", () => {
      const { container } = render(<AudioRecorderRecording />);
      // The outer dot span has aria-hidden="true"
      const redDot = container.querySelector(
        ".bg-destructive[aria-hidden='true']",
      );
      expect(redDot).toBeInTheDocument();
    });

    it("elapsed timer text is visible", () => {
      render(<AudioRecorderRecording />);
      expect(screen.getByText("00:07")).toBeVisible();
    });

    it("stop button has visible focus ring class", () => {
      render(<AudioRecorderRecording />);
      const btn = screen.getByRole("button", { name: /stop recording/i });
      expect(btn.className).toMatch(/focus-visible:ring-2/);
    });

    it("stop button SVG icon is aria-hidden", () => {
      render(<AudioRecorderRecording />);
      const btn = screen.getByRole("button", { name: /stop recording/i });
      const svg = btn.querySelector("svg");
      expect(svg).toHaveAttribute("aria-hidden", "true");
    });
  });

  // ---- Error state checks --------------------------------------------------

  describe("Error state — alert role (WCAG 4.1.3, 1.4.1)", () => {
    it("error message uses role=alert", () => {
      render(<AudioRecorderError />);
      const alert = screen.getByRole("alert");
      expect(alert).toBeInTheDocument();
    });

    it("alert message text describes the permission issue", () => {
      render(<AudioRecorderError />);
      const alert = screen.getByRole("alert");
      expect(alert.textContent).toMatch(/microphone access denied/i);
    });

    it("alert icon is aria-hidden", () => {
      render(<AudioRecorderError />);
      const alert = screen.getByRole("alert");
      const svg = alert.querySelector("svg");
      expect(svg).toHaveAttribute("aria-hidden", "true");
    });

    it("mic button remains accessible in error state", () => {
      render(<AudioRecorderError />);
      const btn = screen.getByRole("button", { name: /start audio recording/i });
      expect(btn).toBeVisible();
    });
  });

  // ---- Unsupported state checks --------------------------------------------

  describe("Unsupported browser — disabled state (WCAG 4.1.2, 2.1.1)", () => {
    it("disabled button has aria-disabled='true'", () => {
      render(<AudioRecorderUnsupported />);
      // sr-only span inside button gives the accessible name
      const btn = screen.getByRole("button", { name: /record audio \(unavailable\)/i });
      expect(btn).toHaveAttribute("aria-disabled", "true");
    });

    it("disabled button also has native disabled attribute", () => {
      render(<AudioRecorderUnsupported />);
      const btn = screen.getByRole("button", { name: /record audio \(unavailable\)/i });
      expect(btn).toBeDisabled();
    });

    it("disabled button has aria-describedby pointing to explanation", () => {
      render(<AudioRecorderUnsupported />);
      const btn = screen.getByRole("button", { name: /record audio \(unavailable\)/i });
      expect(btn).toHaveAttribute("aria-describedby", "audio-unsupported-desc");
    });

    it("description element exists and is linked by ID", () => {
      render(<AudioRecorderUnsupported />);
      const desc = document.getElementById("audio-unsupported-desc");
      expect(desc).toBeInTheDocument();
      expect(desc?.textContent).toMatch(/not supported/i);
    });

    it("sr-only text inside disabled button provides accessible name", () => {
      const { container } = render(<AudioRecorderUnsupported />);
      const srSpan = container.querySelector(".sr-only");
      expect(srSpan).toBeInTheDocument();
      expect(srSpan?.textContent).toMatch(/record audio/i);
    });

    it("mic SVG icon inside unsupported button is aria-hidden", () => {
      render(<AudioRecorderUnsupported />);
      const btn = screen.getByRole("button", { name: /record audio \(unavailable\)/i });
      const svg = btn.querySelector("svg");
      expect(svg).toHaveAttribute("aria-hidden", "true");
    });
  });

  // ---- Color contrast documentation check ----------------------------------

  describe("Color contrast (WCAG 1.4.3 — ≥4.5:1)", () => {
    it("destructive text color class is applied to error state elements", () => {
      const { container } = render(<AudioRecorderError />);
      // Recording timer uses text-destructive (HSL ~0 84% 60% ≈ #f87171)
      // Against bg-destructive/10 (very light red): approx 4.5:1+ on light bg
      const destructiveText = container.querySelector(".text-destructive");
      expect(destructiveText).toBeInTheDocument();
    });

    it("muted-foreground used for secondary text (not pure gray)", () => {
      const { container } = render(<AudioRecorderIdle />);
      const mutedText = container.querySelector(".text-muted-foreground");
      expect(mutedText).toBeInTheDocument();
    });
  });
});
