import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { App } from 'supertest/types';
import { asUser } from '../../../../test/helpers/as-user';
import { resetSeed } from '../../../../test/helpers/reset-seed';
import { createTestApp } from '../../../../test/helpers/test-app';
import { seedUsers } from '../../../platform/auth/mock-users';
import { MockPaymentsAdapter } from '../../../platform/payments/mock-payments.adapter';
import { PAYMENTS_ADAPTER } from '../../../platform/payments/payments-adapter';
import { PrismaService } from '../../../platform/prisma/prisma.service';

interface RefundView {
  id: string;
  paymentReference: string;
  customerEmail: string;
  cardLast4: string;
  amount: { amountCents: number; currency: string };
  reason: string;
  status: 'paid' | 'pending_approval' | 'rejected';
  requestedBy: string;
  payoutId: string | null;
  approvalRequestId: string | null;
  createdAt: string;
}

const EMAIL = 'jane.doe@example.com';
const LIMIT = 50000;

const newRefund = (overrides: Record<string, unknown> = {}) => ({
  paymentReference: `pay_${randomUUID().slice(0, 8)}`,
  customerEmail: EMAIL,
  cardLast4: '4242',
  amount: { amountCents: 1999, currency: 'EUR' },
  reason: 'Item arrived damaged',
  ...overrides,
});

describe('Refunds app (.agents/specs/refunds.md)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let payments: MockPaymentsAdapter;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    payments = app.get<MockPaymentsAdapter>(PAYMENTS_ADAPTER);
  });
  afterAll(() => app.close());
  beforeEach(() => resetSeed());

  const create = async (
    overrides: Record<string, unknown> = {},
    user: 'requester' | 'requesterApprover' = 'requester',
  ): Promise<RefundView> => {
    const response = await asUser(app, user)
      .post('/refunds')
      .send(newRefund(overrides))
      .expect(201);
    return response.body as RefundView;
  };

  const get = async (id: string): Promise<RefundView> =>
    (await asUser(app, 'viewer').get(`/refunds/${id}`).expect(200))
      .body as RefundView;

  const refundAudit = (id: string) =>
    prisma.auditEntry.findMany({
      where: { entity: 'refunds.Refund', entityId: id },
      orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
    });

  describe('create', () => {
    it('pays EUR 500.00 immediately, once, through the adapter', async () => {
      const paidBefore = payments.executed.length;
      const refund = await create({
        amount: { amountCents: LIMIT, currency: 'EUR' },
      });
      expect(refund.status).toBe('paid');
      expect(refund.payoutId).toMatch(/^mock_re_/);
      expect(refund.approvalRequestId).toBeNull();
      expect(payments.executed.length).toBe(paidBefore + 1);
      expect(payments.executed.at(-1)).toMatchObject({
        id: refund.payoutId,
        kind: 'refund',
        amount: { amountCents: LIMIT, currency: 'EUR' },
      });
    });

    it('keeps EUR 500.01 pending approval and pays nothing', async () => {
      const paidBefore = payments.executed.length;
      const refund = await create({
        amount: { amountCents: LIMIT + 1, currency: 'EUR' },
      });
      expect(refund.status).toBe('pending_approval');
      expect(refund.payoutId).toBeNull();
      expect(refund.approvalRequestId).toEqual(expect.any(String));
      expect(payments.executed.length).toBe(paidBefore);
      const approval = await prisma.approvalRequest.findUniqueOrThrow({
        where: { id: refund.approvalRequestId as string },
      });
      expect(approval).toMatchObject({
        actionName: 'refunds.payout',
        status: 'pending',
        requestedBy: seedUsers.requester.id,
        payload: { refundId: refund.id },
      });
    });

    it('masks the email and card in create, list and detail responses', async () => {
      const refund = await create();
      expect(refund.customerEmail).toBe('j***@example.com');
      expect(refund.cardLast4).toBe('**** 4242');
      expect(refund.requestedBy).toBe(seedUsers.requester.id);
      const list = (await asUser(app, 'viewer').get('/refunds').expect(200))
        .body as RefundView[];
      expect(list.map((r) => r.customerEmail)).toEqual(['j***@example.com']);
      expect((await get(refund.id)).customerEmail).toBe('j***@example.com');
    });

    it.each([
      ['a float amount', { amount: { amountCents: 19.99, currency: 'EUR' } }],
      [
        'a numeric string',
        { amount: { amountCents: '1999', currency: 'EUR' } },
      ],
      ['zero', { amount: { amountCents: 0, currency: 'EUR' } }],
      ['a negative amount', { amount: { amountCents: -5, currency: 'EUR' } }],
      [
        'a non-EUR currency',
        { amount: { amountCents: 1999, currency: 'USD' } },
      ],
      ['a 5-digit card value', { cardLast4: '42424' }],
      ['a 3-digit card value', { cardLast4: '424' }],
      ['a full card number as last 4', { cardLast4: '4242424242424242' }],
      ['a full card number field', { cardNumber: '4242424242424242' }],
      ['a card number in the reason', { reason: 'card 4242 4242 4242 4242' }],
      ['a card number as reference', { paymentReference: '4242424242424242' }],
      ['an email in the reason', { reason: 'customer bob@example.com' }],
      ['an invalid email', { customerEmail: 'not-an-email' }],
      ['an empty reason', { reason: '' }],
      ['a missing reference', { paymentReference: undefined }],
    ])('rejects %s with 400 and stores nothing', async (_label, overrides) => {
      await asUser(app, 'requester')
        .post('/refunds')
        .send(newRefund(overrides))
        .expect(400);
      expect(
        (await asUser(app, 'viewer').get('/refunds').expect(200)).body,
      ).toEqual([]);
    });

    it('refuses a second pending or paid refund for the same payment reference (409)', async () => {
      const paymentReference = 'pay_dup_1';
      await create({ paymentReference });
      await asUser(app, 'requester')
        .post('/refunds')
        .send(newRefund({ paymentReference }))
        .expect(409);

      const pendingRef = 'pay_dup_2';
      await create({
        paymentReference: pendingRef,
        amount: { amountCents: LIMIT + 1, currency: 'EUR' },
      });
      await asUser(app, 'requester')
        .post('/refunds')
        .send(newRefund({ paymentReference: pendingRef }))
        .expect(409);
    });

    it('allows a new refund once the earlier one for that reference was rejected', async () => {
      const paymentReference = 'pay_dup_3';
      const first = await create({
        paymentReference,
        amount: { amountCents: LIMIT + 1, currency: 'EUR' },
      });
      await asUser(app, 'approver')
        .post(`/refunds/${first.id}/reject`)
        .expect(200);
      expect((await create({ paymentReference })).status).toBe('paid');
    });
  });

  describe('list and detail', () => {
    it('filters by status and rejects unknown status values', async () => {
      const paid = await create();
      const pending = await create({
        amount: { amountCents: LIMIT + 1, currency: 'EUR' },
      });
      const byStatus = async (status: string) =>
        (
          (
            await asUser(app, 'viewer')
              .get(`/refunds?status=${status}`)
              .expect(200)
          ).body as RefundView[]
        ).map((r) => r.id);
      expect(await byStatus('paid')).toEqual([paid.id]);
      expect(await byStatus('pending_approval')).toEqual([pending.id]);
      expect(await byStatus('rejected')).toEqual([]);
      await asUser(app, 'viewer').get('/refunds?status=bogus').expect(400);
    });

    it('lets every role read; 404 for unknown and 400 for malformed ids', async () => {
      const refund = await create();
      for (const role of [
        'viewer',
        'requester',
        'approver',
        'requesterApprover',
        'auditor',
      ] as const) {
        await asUser(app, role).get('/refunds').expect(200);
        await asUser(app, role).get(`/refunds/${refund.id}`).expect(200);
      }
      await asUser(app, 'viewer').get(`/refunds/${randomUUID()}`).expect(404);
      await asUser(app, 'viewer').get('/refunds/not-a-uuid').expect(400);
    });
  });

  describe('approval (two-person rule)', () => {
    const createPending = (
      user: 'requester' | 'requesterApprover' = 'requester',
    ) => create({ amount: { amountCents: 75000, currency: 'EUR' } }, user);

    it('refuses self-approval and self-rejection (403), even with the approver role', async () => {
      const refund = await createPending('requesterApprover');
      const paidBefore = payments.executed.length;
      await asUser(app, 'requesterApprover')
        .post(`/refunds/${refund.id}/approve`)
        .expect(403);
      await asUser(app, 'requesterApprover')
        .post(`/refunds/${refund.id}/reject`)
        .expect(403);
      expect((await get(refund.id)).status).toBe('pending_approval');
      expect(payments.executed.length).toBe(paidBefore);
    });

    it('a second approver pays it exactly once; approving again returns 409', async () => {
      const refund = await createPending('requesterApprover');
      const paidBefore = payments.executed.length;
      const approved = (
        await asUser(app, 'approver')
          .post(`/refunds/${refund.id}/approve`)
          .expect(200)
      ).body as RefundView;
      expect(approved.status).toBe('paid');
      expect(approved.payoutId).toMatch(/^mock_re_/);
      expect(payments.executed.length).toBe(paidBefore + 1);
      expect(payments.executed.at(-1)).toMatchObject({
        id: approved.payoutId,
        amount: { amountCents: 75000, currency: 'EUR' },
      });

      await asUser(app, 'approver')
        .post(`/refunds/${refund.id}/approve`)
        .expect(409);
      await asUser(app, 'approver')
        .post(`/refunds/${refund.id}/reject`)
        .expect(409);
      expect(payments.executed.length).toBe(paidBefore + 1);
      expect((await get(refund.id)).status).toBe('paid');
    });

    it('reject sets rejected and pays nothing; approving afterwards returns 409', async () => {
      const refund = await createPending();
      const paidBefore = payments.executed.length;
      const rejected = (
        await asUser(app, 'approver')
          .post(`/refunds/${refund.id}/reject`)
          .expect(200)
      ).body as RefundView;
      expect(rejected.status).toBe('rejected');
      await asUser(app, 'requesterApprover')
        .post(`/refunds/${refund.id}/approve`)
        .expect(409);
      expect(payments.executed.length).toBe(paidBefore);
      expect((await get(refund.id)).status).toBe('rejected');
    });

    it('returns 409 when deciding a refund that was paid immediately', async () => {
      const refund = await create();
      await asUser(app, 'approver')
        .post(`/refunds/${refund.id}/approve`)
        .expect(409);
    });

    it('returns 404 for an unknown refund id', async () => {
      await asUser(app, 'approver')
        .post(`/refunds/${randomUUID()}/approve`)
        .expect(404);
      await asUser(app, 'approver')
        .post(`/refunds/${randomUUID()}/reject`)
        .expect(404);
    });
  });

  describe('reveal email', () => {
    it('returns the full email to an approver and audits every reveal', async () => {
      const refund = await create();
      for (let i = 0; i < 2; i++) {
        const response = await asUser(app, 'approver')
          .post(`/refunds/${refund.id}/reveal-email`)
          .expect(200);
        expect(response.body).toEqual({ customerEmail: EMAIL });
      }
      const reveals = (await refundAudit(refund.id)).filter(
        (entry) => entry.action === 'pii.reveal',
      );
      expect(reveals).toHaveLength(2);
      expect(reveals[0]).toMatchObject({
        actor: seedUsers.approver.id,
        after: {
          field: 'customerEmail',
          permission: 'refunds.customer-email.reveal',
        },
      });
    });

    it('returns 404 for an unknown refund id', async () => {
      await asUser(app, 'approver')
        .post(`/refunds/${randomUUID()}/reveal-email`)
        .expect(404);
    });
  });

  describe('permissions', () => {
    it('refuses create, approve, reject and reveal to viewers and auditors (403)', async () => {
      const refund = await create({
        amount: { amountCents: LIMIT + 1, currency: 'EUR' },
      });
      for (const role of ['viewer', 'auditor'] as const) {
        await asUser(app, role).post('/refunds').send(newRefund()).expect(403);
        await asUser(app, role)
          .post(`/refunds/${refund.id}/approve`)
          .expect(403);
        await asUser(app, role)
          .post(`/refunds/${refund.id}/reject`)
          .expect(403);
        await asUser(app, role)
          .post(`/refunds/${refund.id}/reveal-email`)
          .expect(403);
      }
      expect((await get(refund.id)).status).toBe('pending_approval');
    });

    it('refuses approve, reject and reveal to a requester-only user, and create to an approver-only user', async () => {
      const refund = await create({
        amount: { amountCents: LIMIT + 1, currency: 'EUR' },
      });
      await asUser(app, 'requester')
        .post(`/refunds/${refund.id}/approve`)
        .expect(403);
      await asUser(app, 'requester')
        .post(`/refunds/${refund.id}/reject`)
        .expect(403);
      await asUser(app, 'requester')
        .post(`/refunds/${refund.id}/reveal-email`)
        .expect(403);
      await asUser(app, 'approver')
        .post('/refunds')
        .send(newRefund())
        .expect(403);
    });
  });

  describe('audit', () => {
    it('audits an immediate refund with a masked after snapshot', async () => {
      const refund = await create();
      const entries = await refundAudit(refund.id);
      expect(entries.map((e) => [e.action, e.actor])).toEqual([
        ['create', seedUsers.requester.id],
      ]);
      expect(entries[0].before).toBeNull();
      expect(entries[0].after).toMatchObject({
        status: 'paid',
        payoutId: refund.payoutId,
        customerEmail: 'j***@example.com',
        amount: { amountCents: 1999, currency: 'EUR' },
      });
      expect(JSON.stringify(entries)).not.toContain(EMAIL);
    });

    it('audits create, approval and payout with before/after', async () => {
      const refund = await create({
        amount: { amountCents: LIMIT + 1, currency: 'EUR' },
      });
      await asUser(app, 'approver')
        .post(`/refunds/${refund.id}/approve`)
        .expect(200);
      const entries = await refundAudit(refund.id);
      expect(entries.map((e) => [e.action, e.actor])).toEqual([
        ['create', seedUsers.requester.id],
        ['pay', seedUsers.approver.id],
      ]);
      expect(entries[0].after).toMatchObject({ status: 'pending_approval' });
      expect(entries[1].before).toMatchObject({ status: 'pending_approval' });
      expect(entries[1].after).toMatchObject({ status: 'paid' });
      expect((entries[1].after as { payoutId: string }).payoutId).toMatch(
        /^mock_re_/,
      );
      const approvalActions = (
        await prisma.auditEntry.findMany({
          where: { entityId: refund.approvalRequestId as string },
          orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
        })
      ).map((e) => e.action);
      expect(approvalActions).toEqual([
        'approval.requested',
        'approval.approved',
      ]);
    });

    it('audits a rejection with before/after', async () => {
      const refund = await create({
        amount: { amountCents: LIMIT + 1, currency: 'EUR' },
      });
      await asUser(app, 'approver')
        .post(`/refunds/${refund.id}/reject`)
        .expect(200);
      const entries = await refundAudit(refund.id);
      expect(entries.map((e) => [e.action, e.actor])).toEqual([
        ['create', seedUsers.requester.id],
        ['reject', seedUsers.approver.id],
      ]);
      expect(entries[1].before).toMatchObject({ status: 'pending_approval' });
      expect(entries[1].after).toMatchObject({ status: 'rejected' });
    });
  });
});
