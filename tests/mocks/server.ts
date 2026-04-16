import { setupServer } from "msw/node";
import { handlers } from "./handlers";

/**
 * MSW Node.js server for Jest tests.
 *
 * The global lifecycle (listen / resetHandlers / close) is wired in
 * `tests/setup.ts` so every test file gets MSW automatically.
 *
 * To override a handler in a specific test file:
 *
 *   import { server } from "../mocks/server";
 *   import { http, HttpResponse } from "msw";
 *
 *   server.use(
 *     http.get("http://127.0.0.1:8787/api/artifacts", () =>
 *       HttpResponse.json({ data: { items: [], cursor: null } }),
 *     ),
 *   );
 *
 * The override is active only for the current test; `afterEach` in
 * setup.ts calls `server.resetHandlers()` to restore baseline handlers.
 */
export const server = setupServer(...handlers);
