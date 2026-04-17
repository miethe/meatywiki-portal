/**
 * Minimal ambient type declarations for jest-axe@8.
 *
 * jest-axe@8 ships no bundled .d.ts files. This file:
 * 1. Declares the "jest-axe" module so TS7016 is suppressed.
 * 2. Augments jest.Matchers<R> so .toHaveNoViolations() type-checks.
 *
 * Must remain a *script* file (no top-level import/export) so the global
 * namespace augmentation applies everywhere.
 */

declare module "jest-axe" {
  /** Opaque axe result type; the test suite only needs violations present. */
  export interface AxeResults {
    violations: Array<{
      id: string;
      impact: "minor" | "moderate" | "serious" | "critical" | null;
      description: string;
      help: string;
      helpUrl: string;
      nodes: Array<{
        html: string;
        target: string[];
        failureSummary?: string;
      }>;
    }>;
    passes: unknown[];
    incomplete: unknown[];
    inapplicable: unknown[];
  }

  /** Run axe-core against a DOM container or HTML string. */
  export function axe(
    html: Element | string,
    options?: Record<string, unknown>,
  ): Promise<AxeResults>;

  /**
   * Jest matcher factory — pass once to expect.extend() in tests/setup.ts.
   * After that, every expect() call gains .toHaveNoViolations().
   */
  export const toHaveNoViolations: Record<
    "toHaveNoViolations",
    (this: jest.MatcherContext, received: AxeResults) => jest.CustomMatcherResult
  >;
}

// ---------------------------------------------------------------------------
// Augment jest.Matchers so .toHaveNoViolations() resolves without TS2339
// ---------------------------------------------------------------------------
declare namespace jest {
  interface Matchers<R> {
    toHaveNoViolations(): R;
  }
}
