export function testDatabaseUrl(): string {
  try {
    process.loadEnvFile('../.env');
  } catch {
    // No local .env (CI): rely on the process environment.
  }
  return (
    process.env.TEST_DATABASE_URL ??
    'postgresql://platform:platform@localhost:5432/platform_test'
  );
}
