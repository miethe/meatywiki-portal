import "@testing-library/jest-dom";

/**
 * Global test setup for Jest + React Testing Library.
 *
 * P3-11 adds:
 * - MSW server lifecycle (beforeAll / afterEach / afterAll)
 * - axe-core accessibility matcher
 * - Any global mocks (next/navigation, next/image, etc.)
 */

// Suppress Next.js router errors in jsdom
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
