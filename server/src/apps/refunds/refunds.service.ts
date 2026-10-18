import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  ApprovalHandlerContext,
  ApprovalsService,
} from '../../platform/approvals/approvals.service';
import { AuditService } from '../../platform/audit/audit.service';
import type { AuthUser } from '../../platform/auth/platform-auth';
import {
  PAYMENTS_ADAPTER,
  type PaymentsAdapter,
} from '../../platform/payments/payments-adapter';
import { PiiRevealService } from '../../platform/pii/pii-reveal.service';
import type { Refund } from '../../platform/prisma/generated/client';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { PrismaTx } from '../../platform/prisma/prisma.types';
import { toRefundView, RefundView } from './refund.view';
import {
  APPROVAL_THRESHOLD_CENTS,
  CreateRefund,
  ListRefundsQuery,
  PayoutPayloadSchema,
} from './refunds.schemas';

export const REFUND_ENTITY = 'refunds.Refund';
export const PAYOUT_ACTION = 'refunds.payout';
export const REVEAL_EMAIL_PERMISSION = 'refunds.customer-email.reveal';

const isUniqueViolation = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  (error as { code?: unknown }).code === 'P2002';

@Injectable()
export class RefundsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly approvals: ApprovalsService,
    private readonly pii: PiiRevealService,
    @Inject(PAYMENTS_ADAPTER) private readonly payments: PaymentsAdapter,
  ) {}

  onModuleInit(): void {
    this.approvals.registerHandler(PAYOUT_ACTION, {
      onApprove: (context) => this.payApproved(context),
      onReject: (context) => this.markRejected(context),
    });
  }

  async list(query: ListRefundsQuery): Promise<RefundView[]> {
    const rows = await this.prisma.refund.findMany({
      where: { status: query.status },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map(toRefundView);
  }

  async get(id: string): Promise<RefundView> {
    return toRefundView(await this.find(this.prisma, id));
  }

  /**
   * Up to the threshold: pays immediately. Above it: stores the refund as
   * pending together with its approval request; nothing is paid.
   */
  async create(user: AuthUser, input: CreateRefund): Promise<RefundView> {
    const id = randomUUID();
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.assertNoActiveRefund(tx, input.paymentReference);
        const needsApproval =
          input.amount.amountCents > APPROVAL_THRESHOLD_CENTS;
        let refund = await tx.refund.create({
          data: {
            id,
            paymentReference: input.paymentReference,
            customerEmail: input.customerEmail,
            cardLast4: input.cardLast4,
            amountCents: input.amount.amountCents,
            currency: input.amount.currency,
            reason: input.reason,
            status: needsApproval ? 'pending_approval' : 'paid',
            requestedBy: user.id,
          },
        });
        if (needsApproval) {
          const approval = await this.approvals.submit(
            user,
            PAYOUT_ACTION,
            { refundId: id },
            tx,
          );
          refund = await tx.refund.update({
            where: { id },
            data: { approvalRequestId: approval.id },
          });
        } else {
          const payoutId = await this.payOut(refund);
          refund = await tx.refund.update({
            where: { id },
            data: { payoutId },
          });
        }
        const view = toRefundView(refund);
        await this.audit.record(tx, {
          actor: user.id,
          entity: REFUND_ENTITY,
          entityId: id,
          action: 'create',
          after: view,
        });
        return view;
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw this.activeRefundConflict();
      throw error;
    }
  }

  approve(user: AuthUser, id: string): Promise<RefundView> {
    return this.decide(id, (requestId) =>
      this.approvals.approve(user, requestId),
    );
  }

  reject(user: AuthUser, id: string): Promise<RefundView> {
    return this.decide(id, (requestId) =>
      this.approvals.reject(user, requestId),
    );
  }

  revealEmail(user: AuthUser, id: string): Promise<{ customerEmail: string }> {
    return this.pii.reveal(
      user,
      {
        permission: REVEAL_EMAIL_PERMISSION,
        entity: REFUND_ENTITY,
        entityId: id,
        field: 'customerEmail',
      },
      async (tx) => ({
        customerEmail: (await this.find(tx, id)).customerEmail,
      }),
    );
  }

  /** The platform approvals enforce approver role, no self-approval and run-once. */
  private async decide(
    id: string,
    decision: (approvalRequestId: string) => Promise<unknown>,
  ): Promise<RefundView> {
    const refund = await this.find(this.prisma, id);
    if (refund.status !== 'pending_approval' || !refund.approvalRequestId) {
      throw new ConflictException(`Refund is ${refund.status}, not pending`);
    }
    await decision(refund.approvalRequestId);
    return this.get(id);
  }

  private async payApproved({
    tx,
    payload,
    approver,
  }: ApprovalHandlerContext): Promise<void> {
    const before = await this.pendingRefund(tx, payload);
    const payoutId = await this.payOut(before);
    await this.transition(tx, before, approver, 'pay', {
      status: 'paid',
      payoutId,
    });
  }

  private async markRejected({
    tx,
    payload,
    approver,
  }: ApprovalHandlerContext): Promise<void> {
    const before = await this.pendingRefund(tx, payload);
    await this.transition(tx, before, approver, 'reject', {
      status: 'rejected',
    });
  }

  private async pendingRefund(tx: PrismaTx, payload: unknown): Promise<Refund> {
    const { refundId } = PayoutPayloadSchema.parse(payload);
    const refund = await this.find(tx, refundId);
    if (refund.status !== 'pending_approval') {
      throw new ConflictException(`Refund is ${refund.status}, not pending`);
    }
    return refund;
  }

  private async transition(
    tx: PrismaTx,
    before: Refund,
    actor: AuthUser,
    action: string,
    data: { status: 'paid' | 'rejected'; payoutId?: string },
  ): Promise<void> {
    const { count } = await tx.refund.updateMany({
      where: { id: before.id, status: 'pending_approval' },
      data,
    });
    if (count === 0) throw new ConflictException('Refund was already decided');
    const after = await this.find(tx, before.id);
    await this.audit.record(tx, {
      actor: actor.id,
      entity: REFUND_ENTITY,
      entityId: before.id,
      action,
      before: toRefundView(before),
      after: toRefundView(after),
    });
  }

  /**
   * Pays through the platform adapter; the refund id is the idempotency key,
   * so a refund is never paid twice. Known limit (see spec): the payout cannot
   * be undone if the surrounding transaction rolls back afterwards.
   */
  private async payOut(refund: Refund): Promise<string> {
    const result = await this.payments.refund({
      idempotencyKey: refund.id,
      paymentId: refund.paymentReference,
      amount: { amountCents: refund.amountCents, currency: refund.currency },
    });
    return result.id;
  }

  private async assertNoActiveRefund(
    tx: PrismaTx,
    paymentReference: string,
  ): Promise<void> {
    const active = await tx.refund.findFirst({
      where: { paymentReference, status: { in: ['pending_approval', 'paid'] } },
      select: { id: true },
    });
    if (active) throw this.activeRefundConflict();
  }

  private activeRefundConflict(): ConflictException {
    return new ConflictException(
      'This payment reference already has a pending or paid refund',
    );
  }

  private async find(client: PrismaTx, id: string): Promise<Refund> {
    const refund = await client.refund.findUnique({ where: { id } });
    if (!refund) throw new NotFoundException('Refund not found');
    return refund;
  }
}
