/**
 * Mock implementations (auth, payments) must never run in production
 * (ADR 0001, ADR 0006). Called from their provider factories so the server
 * refuses to bootstrap instead of silently serving mock behaviour.
 */
export function assertMockAllowed(
  what: string,
  env: string | undefined = process.env.NODE_ENV,
): void {
  if (env === 'production') {
    throw new Error(
      `Refusing to start: ${what} is a development mock and must not run with NODE_ENV=production.`,
    );
  }
}
