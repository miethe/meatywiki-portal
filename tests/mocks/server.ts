import { setupServer } from "msw/node";
import { handlers } from "./handlers";

/**
 * MSW Node server for Jest tests.
 *
 * Usage in test files:
 *   import { server } from "@/tests/mocks/server";
 *   beforeAll(() => server.listen());
 *   afterEach(() => server.resetHandlers());
 *   afterAll(() => server.close());
 *
 * Or add to tests/setup.ts once P3-11 wires the global lifecycle.
 */
export const server = setupServer(...handlers);
