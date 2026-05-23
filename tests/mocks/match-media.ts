/**
 * matchMedia stub helpers for usePointerType tests.
 *
 * usePointerType listens to `(pointer: coarse)`. These helpers replace
 * window.matchMedia with a minimal stub so tests can control the pointer
 * type without a real browser environment.
 *
 * Usage:
 *
 *   import { setPointerType, resetMatchMedia } from "../mocks/match-media";
 *
 *   beforeEach(() => setPointerType("fine"));
 *   afterEach(() => resetMatchMedia());
 */

type ChangeHandler = (e: MediaQueryListEvent) => void;

let _currentPointerType: "coarse" | "fine" = "fine";
const _listeners: ChangeHandler[] = [];

function makeMediaQueryList(query: string): MediaQueryList {
  const isCoarseQuery = query === "(pointer: coarse)";
  const matches = isCoarseQuery ? _currentPointerType === "coarse" : false;

  const mql: MediaQueryList = {
    matches,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated but included for completeness
    removeListener: jest.fn(),
    addEventListener: jest.fn((_type: string, handler: EventListenerOrEventListenerObject) => {
      if (isCoarseQuery && typeof handler === "function") {
        _listeners.push(handler as ChangeHandler);
      }
    }),
    removeEventListener: jest.fn((_type: string, handler: EventListenerOrEventListenerObject) => {
      if (isCoarseQuery && typeof handler === "function") {
        const idx = _listeners.indexOf(handler as ChangeHandler);
        if (idx !== -1) _listeners.splice(idx, 1);
      }
    }),
    dispatchEvent: jest.fn(() => true),
  };

  return mql;
}

/**
 * Stub window.matchMedia and set the active pointer type.
 *
 * Call in `beforeEach` or at the top of a test. Also fires a synthetic
 * `change` event to any already-registered listeners so reactive hooks
 * (like usePointerType) update their state.
 */
export function setPointerType(value: "coarse" | "fine"): void {
  _currentPointerType = value;

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: jest.fn((query: string) => makeMediaQueryList(query)),
  });

  // Notify any existing listeners (supports mid-test pointer switches)
  const event = { matches: value === "coarse" } as MediaQueryListEvent;
  _listeners.forEach((handler) => handler(event));
}

/**
 * Restore window.matchMedia to undefined and clear tracked listeners.
 * Call in `afterEach`.
 */
export function resetMatchMedia(): void {
  _currentPointerType = "fine";
  _listeners.length = 0;

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: undefined,
  });
}
