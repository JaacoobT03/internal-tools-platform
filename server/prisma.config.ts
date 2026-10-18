import { defineConfig } from 'prisma/config';

try {
  process.loadEnvFile('../.env');
} catch {
  // No local .env (CI, containers): rely on the process environment.
}

export default defineConfig({
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
