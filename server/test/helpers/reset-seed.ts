import { PrismaService } from '../../src/platform/prisma/prisma.service';
import { testDatabaseUrl } from '../test-database-url';

const PRESERVED_TABLES = ['audit_entry', '_prisma_migrations'];

/**
 * Resets the test database to its seed state. Seed users live in code
 * (src/platform/auth/mock-users.ts), so this only empties data tables.
 *
 * The append-only audit table is never touched: TRUNCATE/DELETE on it is
 * rejected by its trigger, and the reset must not weaken that trigger. Tests
 * therefore scope audit assertions to entity ids they created themselves.
 * See test/README.md.
 */
export async function resetSeed(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url || url !== testDatabaseUrl()) {
    throw new Error('resetSeed() only runs against the test database');
  }
  const prisma = new PrismaService();
  try {
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND NOT (tablename = ANY(${PRESERVED_TABLES}))`;
    if (tables.length > 0) {
      const list = tables
        .map(({ tablename }) => `"public"."${tablename.replace(/"/g, '""')}"`)
        .join(', ');
      // No CASCADE: it could otherwise reach the audit table.
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY`);
    }
  } finally {
    await prisma.$disconnect();
  }
}
