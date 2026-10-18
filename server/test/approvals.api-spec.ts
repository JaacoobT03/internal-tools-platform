import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { App } from 'supertest/types';
import {
  APPROVAL_ENTITY,
  ApprovalsService,
} from '../src/platform/approvals/approvals.service';
import { AuditService } from '../src/platform/audit/audit.service';
import { seedUsers, SeedUserKey } from '../src/platform/auth/mock-users';
import { PrismaService } from '../src/platform/prisma/prisma.service';
import { asUser } from './helpers/as-user';
import { resetSeed } from './helpers/reset-seed';
import { createTestApp } from './helpers/test-app';

const user = (key: SeedUserKey) => ({
  ...seedUsers[key],
  roles: [...seedUsers[key].roles],
});

describe('Two-person approvals (ADR 0004)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let approvals: ApprovalsService;
  const effectRuns = new Map<string, number>();
  const rejectRuns = new Map<string, number>();

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    approvals = app.get(ApprovalsService);
    const audit = app.get(AuditService);
    approvals.registerHandler(
      'test.effect',
      async ({ tx, payload, approver }) => {
        const { ref } = payload as { ref: string };
        effectRuns.set(ref, (effectRuns.get(ref) ?? 0) + 1);
        await audit.record(tx, {
          actor: approver.id,
          entity: 'test.Effect',
          entityId: ref,
          action: 'create',
          after: { ref },
        });
      },
    );
    approvals.registerHandler(
      'test.failing',
      async ({ tx, payload, approver }) => {
        const { ref } = payload as { ref: string };
        await audit.record(tx, {
          actor: approver.id,
          entity: 'test.Effect',
          entityId: ref,
          action: 'create',
        });
        throw new Error('effect failed');
      },
    );
    approvals.registerHandler('test.with-reject', {
      onApprove: async ({ tx, payload, approver }) => {
        const { ref } = payload as { ref: string };
        effectRuns.set(ref, (effectRuns.get(ref) ?? 0) + 1);
        await audit.record(tx, {
          actor: approver.id,
          entity: 'test.Effect',
          entityId: ref,
          action: 'approve-effect',
        });
      },
      onReject: async ({ tx, payload, approver }) => {
        const { ref } = payload as { ref: string };
        rejectRuns.set(ref, (rejectRuns.get(ref) ?? 0) + 1);
        await audit.record(tx, {
          actor: approver.id,
          entity: 'test.Effect',
          entityId: ref,
          action: 'reject-effect',
        });
      },
    });
    approvals.registerHandler('test.failing-reject', {
      onApprove: () => Promise.resolve(),
      onReject: async ({ tx, payload, approver }) => {
        const { ref } = payload as { ref: string };
        await audit.record(tx, {
          actor: approver.id,
          entity: 'test.Effect',
          entityId: ref,
          action: 'reject-effect',
        });
        throw new Error('reject effect failed');
      },
    });
  });
  afterAll(() => app.close());
  beforeEach(() => resetSeed());

  const effectEntries = (ref: string) =>
    prisma.auditEntry.count({
      where: { entity: 'test.Effect', entityId: ref },
    });
  const approvalActions = async (id: string) =>
    (
      await prisma.auditEntry.findMany({
        where: { entity: APPROVAL_ENTITY, entityId: id },
        orderBy: { timestamp: 'asc' },
      })
    ).map((entry) => [entry.action, entry.actor]);
  const status = async (id: string) =>
    (await prisma.approvalRequest.findUniqueOrThrow({ where: { id } })).status;

  async function submit(by: SeedUserKey, actionName = 'test.effect') {
    const ref = randomUUID();
    const request = await approvals.submit(user(by), actionName, { ref });
    return { id: request.id, ref };
  }

  it('a pending request has no effect and the request is audited', async () => {
    const { id, ref } = await submit('requester');
    expect(await status(id)).toBe('pending');
    expect(effectRuns.get(ref)).toBeUndefined();
    expect(await effectEntries(ref)).toBe(0);
    expect(await approvalActions(id)).toEqual([
      ['approval.requested', 'u-requester'],
    ]);
  });

  it('refuses self-approval with 403 (user with requester+approver roles)', async () => {
    const { id, ref } = await submit('requesterApprover');
    await asUser(app, 'requesterApprover')
      .post(`/approvals/${id}/approve`)
      .expect(403);
    expect(await status(id)).toBe('pending');
    expect(effectRuns.get(ref)).toBeUndefined();
  });

  it.each<SeedUserKey>(['requester', 'viewer', 'auditor'])(
    'refuses approval by %s (no approver role) with 403',
    async (by) => {
      const { id, ref } = await submit('requesterApprover');
      await asUser(app, by).post(`/approvals/${id}/approve`).expect(403);
      await expect(approvals.approve(user(by), id)).rejects.toMatchObject({
        status: 403,
      });
      expect(await status(id)).toBe('pending');
      expect(effectRuns.get(ref)).toBeUndefined();
    },
  );

  it('runs the effect only on approval, in one transaction with the status change and audit entry', async () => {
    const { id, ref } = await submit('requester');
    const response = await asUser(app, 'approver')
      .post(`/approvals/${id}/approve`)
      .expect(200);
    expect(response.body).toMatchObject({
      id,
      status: 'approved',
      requestedBy: 'u-requester',
      decidedBy: 'u-approver',
    });
    expect(effectRuns.get(ref)).toBe(1);
    expect(await effectEntries(ref)).toBe(1);
    expect(await approvalActions(id)).toEqual([
      ['approval.requested', 'u-requester'],
      ['approval.approved', 'u-approver'],
    ]);
    const approved = await prisma.auditEntry.findFirstOrThrow({
      where: { entityId: id, action: 'approval.approved' },
    });
    expect(approved.before).toMatchObject({ status: 'pending' });
    expect(approved.after).toMatchObject({ status: 'approved' });
  });

  it('a different user with requester+approver roles may approve', async () => {
    const { id, ref } = await submit('requester');
    await asUser(app, 'requesterApprover')
      .post(`/approvals/${id}/approve`)
      .expect(200);
    expect(effectRuns.get(ref)).toBe(1);
  });

  it('double approve returns 409 and the effect ran once', async () => {
    const { id, ref } = await submit('requester');
    await asUser(app, 'approver').post(`/approvals/${id}/approve`).expect(200);
    await asUser(app, 'requesterApprover')
      .post(`/approvals/${id}/approve`)
      .expect(409);
    await asUser(app, 'approver').post(`/approvals/${id}/approve`).expect(409);
    expect(effectRuns.get(ref)).toBe(1);
    expect(await effectEntries(ref)).toBe(1);
  });

  it('concurrent approvals run the effect exactly once', async () => {
    const { id, ref } = await submit('requester');
    const responses = await Promise.all([
      asUser(app, 'approver').post(`/approvals/${id}/approve`),
      asUser(app, 'requesterApprover').post(`/approvals/${id}/approve`),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(effectRuns.get(ref)).toBe(1);
    expect(await effectEntries(ref)).toBe(1);
  });

  it('a failing effect rolls back the status change and every audit entry', async () => {
    const { id, ref } = await submit('requester', 'test.failing');
    await asUser(app, 'approver').post(`/approvals/${id}/approve`).expect(500);
    expect(await status(id)).toBe('pending');
    expect(await effectEntries(ref)).toBe(0);
    expect(await approvalActions(id)).toEqual([
      ['approval.requested', 'u-requester'],
    ]);
  });

  it('rejection has no effect, is audited, and blocks later approval', async () => {
    const { id, ref } = await submit('requester');
    await asUser(app, 'approver').post(`/approvals/${id}/reject`).expect(200);
    await asUser(app, 'requesterApprover')
      .post(`/approvals/${id}/approve`)
      .expect(409);
    expect(await status(id)).toBe('rejected');
    expect(effectRuns.get(ref)).toBeUndefined();
    expect(await approvalActions(id)).toEqual([
      ['approval.requested', 'u-requester'],
      ['approval.rejected', 'u-approver'],
    ]);
  });

  it('runs onReject once, in the rejection transaction, and never onApprove', async () => {
    const { id, ref } = await submit('requester', 'test.with-reject');
    await asUser(app, 'approver').post(`/approvals/${id}/reject`).expect(200);
    await asUser(app, 'requesterApprover')
      .post(`/approvals/${id}/reject`)
      .expect(409);
    expect(rejectRuns.get(ref)).toBe(1);
    expect(effectRuns.get(ref)).toBeUndefined();
    expect(await effectEntries(ref)).toBe(1);
    expect(await status(id)).toBe('rejected');
  });

  it('runs onApprove (not onReject) for a handler registered with both', async () => {
    const { id, ref } = await submit('requester', 'test.with-reject');
    await asUser(app, 'approver').post(`/approvals/${id}/approve`).expect(200);
    expect(effectRuns.get(ref)).toBe(1);
    expect(rejectRuns.get(ref)).toBeUndefined();
  });

  it('a failing onReject rolls back the rejection and every audit entry', async () => {
    const { id, ref } = await submit('requester', 'test.failing-reject');
    await asUser(app, 'approver').post(`/approvals/${id}/reject`).expect(500);
    expect(await status(id)).toBe('pending');
    expect(await effectEntries(ref)).toBe(0);
    expect(await approvalActions(id)).toEqual([
      ['approval.requested', 'u-requester'],
    ]);
  });

  it('submit(tx) joins the caller transaction and rolls back with it', async () => {
    const ref = randomUUID();
    let id = '';
    await expect(
      prisma.$transaction(async (tx) => {
        ({ id } = await approvals.submit(
          user('requester'),
          'test.effect',
          { ref },
          tx,
        ));
        throw new Error('caller failed');
      }),
    ).rejects.toThrow('caller failed');
    expect(id).not.toBe('');
    expect(
      await prisma.approvalRequest.findUnique({ where: { id } }),
    ).toBeNull();
    expect(await approvalActions(id)).toEqual([]);

    const committed = await prisma.$transaction((tx) =>
      approvals.submit(user('requester'), 'test.effect', { ref }, tx),
    );
    expect(await status(committed.id)).toBe('pending');
    expect(await approvalActions(committed.id)).toEqual([
      ['approval.requested', 'u-requester'],
    ]);
  });

  it('returns 404 for an unknown id and 400 for a malformed one', async () => {
    await asUser(app, 'approver')
      .post(`/approvals/${randomUUID()}/approve`)
      .expect(404);
    await asUser(app, 'approver')
      .post('/approvals/not-a-uuid/approve')
      .expect(400);
  });

  it('refuses unknown action names and duplicate handler registration', async () => {
    await expect(
      approvals.submit(user('requester'), 'test.unknown', {}),
    ).rejects.toThrow(/No approval handler/);
    expect(() =>
      approvals.registerHandler('test.effect', () => Promise.resolve()),
    ).toThrow(/already registered/);
  });
});
