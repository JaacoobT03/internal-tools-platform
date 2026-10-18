import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuditService } from '../src/platform/audit/audit.service';
import { SeedUserKey } from '../src/platform/auth/mock-users';
import { PrismaService } from '../src/platform/prisma/prisma.service';
import { asUser } from './helpers/as-user';
import { createTestApp } from './helpers/test-app';

describe('Append-only audit log (ADR 0003)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let entityId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    entityId = randomUUID();
    await prisma.$transaction((tx) =>
      app.get(AuditService).record(tx, {
        actor: 'u-requester',
        entity: 'test.Thing',
        entityId,
        action: 'update',
        before: { email: 'jane.doe@example.com', status: 'old' },
        after: { email: 'jane.doe@example.com', status: 'new' },
      }),
    );
  });

  const entry = () =>
    prisma.auditEntry.findFirstOrThrow({ where: { entityId } });

  describe('database trigger', () => {
    it('rejects UPDATE', async () => {
      await expect(
        prisma.$executeRaw`UPDATE audit_entry SET action = 'tampered' WHERE entity_id = ${entityId}`,
      ).rejects.toThrow(/append-only: UPDATE/);
      await expect(
        prisma.auditEntry.updateMany({
          where: { entityId },
          data: { action: 'tampered' },
        }),
      ).rejects.toThrow(/append-only/);
      expect((await entry()).action).toBe('update');
    });

    it('rejects DELETE', async () => {
      await expect(
        prisma.$executeRaw`DELETE FROM audit_entry WHERE entity_id = ${entityId}`,
      ).rejects.toThrow(/append-only: DELETE/);
      await expect(
        prisma.auditEntry.deleteMany({ where: { entityId } }),
      ).rejects.toThrow(/append-only/);
      await expect(entry()).resolves.toBeDefined();
    });

    it('rejects TRUNCATE', async () => {
      await expect(
        prisma.$executeRawUnsafe('TRUNCATE TABLE audit_entry'),
      ).rejects.toThrow(/append-only: TRUNCATE/);
      await expect(
        prisma.$executeRawUnsafe('TRUNCATE TABLE audit_entry CASCADE'),
      ).rejects.toThrow(/append-only: TRUNCATE/);
      await expect(entry()).resolves.toBeDefined();
    });
  });

  it('rolls the audit entry back with its transaction', async () => {
    const rolledBack = randomUUID();
    await expect(
      prisma.$transaction(async (tx) => {
        await app.get(AuditService).record(tx, {
          actor: 'u-requester',
          entity: 'test.Thing',
          entityId: rolledBack,
          action: 'create',
        });
        throw new Error('mutation failed');
      }),
    ).rejects.toThrow('mutation failed');
    expect(
      await prisma.auditEntry.count({ where: { entityId: rolledBack } }),
    ).toBe(0);
  });

  describe('GET /audit', () => {
    it('returns 200 for the auditor, with PII in snapshots masked', async () => {
      const response = await asUser(app, 'auditor')
        .get(`/audit?entity=test.Thing&entityId=${entityId}`)
        .expect(200);
      expect(response.body).toEqual({
        entries: [
          expect.objectContaining({
            actor: 'u-requester',
            entity: 'test.Thing',
            entityId,
            action: 'update',
            before: { email: 'j***@example.com', status: 'old' },
            after: { email: 'j***@example.com', status: 'new' },
            timestamp: expect.any(String) as unknown,
          }),
        ],
        nextCursor: null,
      });
    });

    it('pages through older entries with a cursor', async () => {
      const pagedId = randomUUID();
      const base = Date.now();
      for (const [i, action] of ['first', 'second', 'third'].entries()) {
        await prisma.auditEntry.create({
          data: {
            actor: 'u-requester',
            entity: 'test.Paged',
            entityId: pagedId,
            action,
            timestamp: new Date(base + i * 1000),
          },
        });
      }
      interface Page {
        entries: { id: string; action: string }[];
        nextCursor: string | null;
      }
      const page = async (cursor?: string): Promise<Page> => {
        const response = await asUser(app, 'auditor')
          .get('/audit')
          .query({ entityId: pagedId, limit: 2, ...(cursor && { cursor }) })
          .expect(200);
        return response.body as Page;
      };
      const actions = (body: Page) => body.entries.map((e) => e.action);

      const first = await page();
      expect(actions(first)).toEqual(['third', 'second']);
      expect(first.nextCursor).toBe(first.entries[1].id);

      const second = await page(first.nextCursor ?? undefined);
      expect(actions(second)).toEqual(['first']);
      expect(second.nextCursor).toBeNull();
    });

    it.each<SeedUserKey>([
      'requester',
      'approver',
      'requesterApprover',
      'viewer',
    ])('returns 403 for %s', async (user) => {
      await asUser(app, user).get('/audit').expect(403);
    });

    it('returns 401 without a user', async () => {
      await request(app.getHttpServer()).get('/audit').expect(401);
    });

    it('validates query parameters', async () => {
      await asUser(app, 'auditor').get('/audit?limit=abc').expect(400);
      await asUser(app, 'auditor').get('/audit?unknown=1').expect(400);
      await asUser(app, 'auditor').get('/audit?cursor=nope').expect(400);
    });
  });
});
