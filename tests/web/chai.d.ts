/**
 * Type shim: the workspace has @types/mocha but not @types/chai, and the web
 * test suites use chai's expect. Declared as loosely-typed on purpose — the
 * assertions are exercised at runtime.
 */
declare module "chai" {
  export function expect(actual: unknown): any;
  export function assert(expression: unknown, message?: string): void;
}