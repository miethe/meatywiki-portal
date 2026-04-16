import userEvent from "@testing-library/user-event";

/**
 * Pre-configured `userEvent` instance with `delay: null` for fast tests.
 *
 * Using `userEvent.setup()` (v14 API) is preferred over the legacy
 * `userEvent.*` direct calls because it more accurately simulates real
 * browser event sequences (pointer down → pointer up → click, etc.).
 *
 * Usage in test files:
 *
 *   import { userEvent } from "../utils/render";
 *   const user = userEvent.setup();
 *   await user.click(screen.getByRole("button", { name: /submit/i }));
 *
 * Or import directly for simple cases:
 *   import { userEvent } from "../utils/userEvent";
 */
export { userEvent };
