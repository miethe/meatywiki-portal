import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  // Path to Next.js app — loads next.config.mjs and .env* files in test mode.
  // next.config.mjs includes `transpilePackages: ["rettime"]` so that next/jest
  // generates a transformIgnorePatterns that transforms rettime (an ESM-only
  // transitive dependency of MSW v2) with SWC.
  dir: "./",
});

const config: Config = {
  // Use Next.js built-in SWC transform (no custom Babel config needed)
  coverageProvider: "v8",

  // jsdom environment for React component tests
  testEnvironment: "jest-environment-jsdom",

  // Override export conditions for jest-environment-jsdom.
  //
  // Default: ['browser'] — causes @mswjs/interceptors/* and msw/node to resolve
  //   to `null` (browser export condition maps them to null).
  //
  // We use ['node', 'require', 'default'] to:
  //   - 'node': pick Node.js-compatible exports (msw/node → CJS build)
  //   - 'require': prefer CJS entry points over ESM where both exist
  //   - 'default': fallback for packages without node/require conditions
  //
  // Reference: https://mswjs.io/docs/migrations/1.x-to-2.x
  testEnvironmentOptions: {
    customExportConditions: ["node", "require", "default"],
  },

  // polyfills.ts sets Fetch API globals (fetch, Request, Response, etc.)
  // BEFORE MSW is imported in setupFilesAfterEnv.
  setupFiles: ["<rootDir>/tests/polyfills.ts"],

  // Wire global test setup (jest-dom matchers + MSW lifecycle)
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],

  // Module name mapper — @/* → src/* mirrors tsconfig.json paths
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    // isomorphic-dompurify's Node path pulls in jsdom@29 which has ESM-only
    // sub-dependencies incompatible with Jest's CJS transform. In the jsdom
    // test environment, map to the pre-bundled browser build instead — it
    // wraps DOMPurify directly (no jsdom layer) and works fine with Jest.
    "^isomorphic-dompurify$":
      "<rootDir>/node_modules/.pnpm/isomorphic-dompurify@3.10.0/node_modules/isomorphic-dompurify/dist/browser.js",
  },

  // Discover tests in tests/**
  testMatch: ["<rootDir>/tests/**/*.test.{ts,tsx}"],

  // Collect coverage from src/ only; exclude type-definition and layout files
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/app/**/layout.tsx",
    "!src/app/**/page.tsx",
    "!src/app/globals.css",
  ],

  // Coverage thresholds — advisory in Batch 1 (enforced once Batch 3 test
  // authoring is complete).  The thresholds are SET now so CI reports drift
  // immediately; hard enforcement (failing the build) is added in Batch 3.
  //
  // Current status: ADVISORY — low source coverage is expected until Batch 3.
  coverageThreshold: {
    global: {
      lines: 80,
      branches: 80,
      functions: 80,
      statements: 80,
    },
  },
};

// createJestConfig wraps the config with Next.js transforms (SWC, CSS modules,
// static assets, etc.) and merges with any next.config.mjs settings.
export default createJestConfig(config);
