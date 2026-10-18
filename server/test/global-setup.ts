import { execSync } from 'node:child_process';
import { testDatabaseUrl } from './test-database-url';

export default function globalSetup(): void {
  execSync('pnpm exec prisma migrate deploy', {
    cwd: `${__dirname}/..`,
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
    stdio: 'inherit',
  });
}
