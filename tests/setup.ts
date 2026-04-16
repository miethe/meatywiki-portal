import "@testing-library/jest-dom";

/**
 * Global test setup for Jest + React Testing Library.
 *
 * P3-11 wires:
 * - MSW server lifecycle (beforeAll / afterEach / afterAll)
 * - next/navigation + next/image mocks
 *
 * The MSW server is imported lazily (via require() inside beforeAll) so that
 * `tests/polyfills.ts` (in setupFiles) has already set the Fetch API globals
 * on `globalThis` before @mswjs/interceptors evaluates its module-level
 * `class FetchResponse extends Response` statement.
 *
 * If the import were at the module top-level, it would be hoisted and
 * evaluated before setupFiles polyfills run, causing:
 *   ReferenceError: Response is not defined
 */

// ---------------------------------------------------------------------------
// MSW server lifecycle (lazy import to allow polyfills.ts to run first)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-require-imports
type ServerModule = typeof import("./mocks/server");

let server: ServerModule["server"] | null = null;

beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { server: s } = require("./mocks/server") as ServerModule;
  server = s;
  server.listen({ onUnhandledRequest: "warn" });
});

afterEach(() => {
  server?.resetHandlers();
});

afterAll(() => {
  server?.close();
});

// ---------------------------------------------------------------------------
// Next.js router mock — suppresses jsdom navigation errors
// ---------------------------------------------------------------------------

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  redirect: jest.fn(),
}));

// ---------------------------------------------------------------------------
// next/image — replace with a plain <img> in tests.
// Uses React.createElement to avoid JSX in a .ts file.
// ---------------------------------------------------------------------------

jest.mock("next/image", () => ({
  __esModule: true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: function NextImageMock(props: Record<string, any>) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    return require("react").createElement("img", {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      src: props["src"],
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      alt: props["alt"] ?? "",
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      width: props["width"],
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      height: props["height"],
    });
  },
}));
