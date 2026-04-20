/**
 * Tests for ServiceWorkerRegister (P4-01).
 *
 * Covers:
 *   - No-op when NEXT_PUBLIC_PORTAL_ENABLE_PWA is not "1"
 *   - No-op when serviceWorker is absent from navigator
 *   - No-op when not a secure context (non-localhost HTTP)
 *   - Calls navigator.serviceWorker.register("/sw.js") when flag is on
 *     and secure context conditions are met (localhost)
 *   - Registration errors are caught and logged without throwing
 *   - Component renders null (no DOM nodes)
 */

import React from "react";
import { render, act } from "@testing-library/react";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";

// ---------------------------------------------------------------------------
// Helpers — save / restore navigator + window patches
// ---------------------------------------------------------------------------

/**
 * Installs a minimal navigator.serviceWorker mock on globalThis.
 * Returns a jest.fn() for the register call so tests can assert on it.
 */
function mockServiceWorker(
  registerImpl?: () => Promise<ServiceWorkerRegistration>
): jest.Mock {
  const registerFn = jest.fn(
    registerImpl ??
      (() =>
        Promise.resolve({
          scope: "/",
          installing: null,
          addEventListener: jest.fn(),
        } as unknown as ServiceWorkerRegistration))
  );

  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    writable: true,
    value: { register: registerFn },
  });

  return registerFn;
}

/** Removes navigator.serviceWorker so the "not supported" branch is hit. */
function removeServiceWorker(): void {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    writable: true,
    value: undefined,
  });
}

/** Sets window.isSecureContext. */
function setSecureContext(secure: boolean): void {
  Object.defineProperty(window, "isSecureContext", {
    configurable: true,
    writable: true,
    value: secure,
  });
}

/** Sets window.location.hostname via Object.defineProperty (jsdom workaround). */
function setHostname(hostname: string): void {
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: { ...window.location, hostname },
  });
}

// ---------------------------------------------------------------------------
// PWA flag helpers
// ---------------------------------------------------------------------------

const ENV_KEY = "NEXT_PUBLIC_PORTAL_ENABLE_PWA";

function enablePwa(): void {
  process.env[ENV_KEY] = "1";
}

function disablePwa(): void {
  delete process.env[ENV_KEY];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ServiceWorkerRegister", () => {
  // Silence console.info / console.warn / console.error in tests
  const consoleSpy = {
    info: jest.spyOn(console, "info").mockImplementation(() => undefined),
    warn: jest.spyOn(console, "warn").mockImplementation(() => undefined),
    error: jest.spyOn(console, "error").mockImplementation(() => undefined),
  };

  afterEach(() => {
    disablePwa();
    removeServiceWorker();
    jest.clearAllMocks();
  });

  afterAll(() => {
    consoleSpy.info.mockRestore();
    consoleSpy.warn.mockRestore();
    consoleSpy.error.mockRestore();
  });

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  it("renders null — no DOM nodes", () => {
    disablePwa();
    const { container } = render(<ServiceWorkerRegister />);
    expect(container).toBeEmptyDOMElement();
  });

  // -------------------------------------------------------------------------
  // Feature flag guard
  // -------------------------------------------------------------------------

  it("does not register SW when flag is absent", async () => {
    disablePwa();
    const registerFn = mockServiceWorker();
    setSecureContext(true);

    await act(async () => {
      render(<ServiceWorkerRegister />);
    });

    expect(registerFn).not.toHaveBeenCalled();
  });

  it("does not register SW when flag is '0'", async () => {
    process.env[ENV_KEY] = "0";
    const registerFn = mockServiceWorker();
    setSecureContext(true);

    await act(async () => {
      render(<ServiceWorkerRegister />);
    });

    expect(registerFn).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Browser support guard
  // -------------------------------------------------------------------------

  it("does not register SW when serviceWorker is absent from navigator", async () => {
    enablePwa();
    removeServiceWorker();
    setSecureContext(true);

    // Should not throw
    await act(async () => {
      render(<ServiceWorkerRegister />);
    });

    // Nothing to assert on register since it doesn't exist; just verify no crash
    expect(consoleSpy.info).toHaveBeenCalledWith(
      expect.stringContaining("not supported")
    );
  });

  // -------------------------------------------------------------------------
  // Secure context guard
  // -------------------------------------------------------------------------

  it("does not register SW on non-secure non-localhost origin", async () => {
    enablePwa();
    const registerFn = mockServiceWorker();
    setSecureContext(false);
    setHostname("example.com");

    await act(async () => {
      render(<ServiceWorkerRegister />);
    });

    expect(registerFn).not.toHaveBeenCalled();
    expect(consoleSpy.warn).toHaveBeenCalledWith(
      expect.stringContaining("secure context")
    );
  });

  // -------------------------------------------------------------------------
  // Happy path — flag on + secure context
  // -------------------------------------------------------------------------

  it("calls navigator.serviceWorker.register('/sw.js') when flag is on and context is secure", async () => {
    enablePwa();
    const registerFn = mockServiceWorker();
    setSecureContext(true);

    // Simulate document.readyState = "complete" so register fires immediately
    Object.defineProperty(document, "readyState", {
      configurable: true,
      writable: true,
      value: "complete",
    });

    await act(async () => {
      render(<ServiceWorkerRegister />);
    });

    expect(registerFn).toHaveBeenCalledTimes(1);
    expect(registerFn).toHaveBeenCalledWith("/sw.js", { scope: "/" });
  });

  it("calls register on localhost even when isSecureContext is false", async () => {
    enablePwa();
    const registerFn = mockServiceWorker();
    setSecureContext(false);
    setHostname("localhost");

    Object.defineProperty(document, "readyState", {
      configurable: true,
      writable: true,
      value: "complete",
    });

    await act(async () => {
      render(<ServiceWorkerRegister />);
    });

    expect(registerFn).toHaveBeenCalledTimes(1);
  });

  it("calls register on 127.0.0.1 even when isSecureContext is false", async () => {
    enablePwa();
    const registerFn = mockServiceWorker();
    setSecureContext(false);
    setHostname("127.0.0.1");

    Object.defineProperty(document, "readyState", {
      configurable: true,
      writable: true,
      value: "complete",
    });

    await act(async () => {
      render(<ServiceWorkerRegister />);
    });

    expect(registerFn).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  it("catches registration errors and logs them without throwing", async () => {
    enablePwa();
    const error = new Error("SW registration failed");
    mockServiceWorker(() => Promise.reject(error));
    setSecureContext(true);

    Object.defineProperty(document, "readyState", {
      configurable: true,
      writable: true,
      value: "complete",
    });

    await act(async () => {
      render(<ServiceWorkerRegister />);
      // Let the rejected promise settle
      await Promise.resolve();
    });

    expect(consoleSpy.error).toHaveBeenCalledWith(
      expect.stringContaining("registration failed"),
      error
    );
  });
});
