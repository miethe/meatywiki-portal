/**
 * Fetch API and Web globals polyfills for jest-environment-jsdom.
 *
 * jsdom v20 (used by jest-environment-jsdom@29) does not implement the Fetch
 * API or several other Web Platform globals required by MSW v2.
 *
 * This file is listed under `setupFiles` in jest.config.ts and runs BEFORE
 * `setupFilesAfterEnv` (tests/setup.ts), ensuring globals are in place when
 * MSW's `setupServer` is first imported.
 *
 * Approach: import from `undici` (v6) for the Fetch API globals, and from
 * Node 20's built-in modules for other globals.  This matches the approach
 * recommended by the MSW v2 migration guide:
 *   https://mswjs.io/docs/migrations/1.x-to-2.x#requestresponseheaders-are-not-defined-error
 *
 * Globals are assigned in dependency order:
 *   TextDecoder/TextEncoder → ReadableStream → MessagePort → undici → BroadcastChannel
 */

/* eslint-disable @typescript-eslint/no-require-imports */
export {};


// 1. TextDecoder/TextEncoder — required by undici and MSW internals
const { TextDecoder, TextEncoder } = require("node:util") as typeof import("util");
Object.defineProperty(globalThis, "TextDecoder", { writable: true, configurable: true, value: TextDecoder });
Object.defineProperty(globalThis, "TextEncoder", { writable: true, configurable: true, value: TextEncoder });

// 2. ReadableStream / WritableStream / TransformStream — required by undici and MSW
const {
  ReadableStream,
  WritableStream,
  TransformStream,
} = require("node:stream/web") as {
  ReadableStream: typeof globalThis.ReadableStream;
  WritableStream: typeof globalThis.WritableStream;
  TransformStream: typeof globalThis.TransformStream;
};
Object.defineProperty(globalThis, "ReadableStream", { writable: true, configurable: true, value: ReadableStream });
Object.defineProperty(globalThis, "WritableStream", { writable: true, configurable: true, value: WritableStream });
Object.defineProperty(globalThis, "TransformStream", { writable: true, configurable: true, value: TransformStream });

// 3. MessagePort / MessageChannel — required by undici v6
const { MessagePort, MessageChannel } = require("node:worker_threads") as typeof import("worker_threads");
Object.defineProperty(globalThis, "MessagePort", { writable: true, configurable: true, value: MessagePort });
Object.defineProperty(globalThis, "MessageChannel", { writable: true, configurable: true, value: MessageChannel });

// 4. BroadcastChannel — required by MSW v2 ws interceptors
const { BroadcastChannel } = require("node:worker_threads") as typeof import("worker_threads");
Object.defineProperty(globalThis, "BroadcastChannel", { writable: true, configurable: true, value: BroadcastChannel });

// 5. Blob and File — required by undici / FormData
const { Blob, File } = require("node:buffer") as typeof import("buffer");
Object.defineProperty(globalThis, "Blob", { writable: true, configurable: true, value: Blob });
if (typeof File !== "undefined") {
  Object.defineProperty(globalThis, "File", { writable: true, configurable: true, value: File });
}

// 6. Import undici (all its dependencies are now in globalThis)
const {
  fetch,
  Headers,
  FormData,
  Request,
  Response,
} = require("undici") as {
  fetch: typeof globalThis.fetch;
  Headers: typeof globalThis.Headers;
  FormData: typeof globalThis.FormData;
  Request: typeof globalThis.Request;
  Response: typeof globalThis.Response;
};

Object.defineProperty(globalThis, "fetch", { writable: true, configurable: true, value: fetch });
Object.defineProperty(globalThis, "Headers", { writable: true, configurable: true, value: Headers });
Object.defineProperty(globalThis, "FormData", { writable: true, configurable: true, value: FormData });
Object.defineProperty(globalThis, "Request", { writable: true, configurable: true, value: Request });
Object.defineProperty(globalThis, "Response", { writable: true, configurable: true, value: Response });
