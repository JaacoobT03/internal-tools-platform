import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { AuthUser, PlatformAuth } from '../auth/platform-auth';
import { PLATFORM_AUTH } from '../auth/platform-auth';
import { ApprovalRequest, Prisma } from '../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaTx } from '../prisma/prisma.types';

export const APPROVAL_ENTITY = 'platform.ApprovalRequest';

export interface ApprovalHandlerContext {
  /** Run the effect (and its own audit entry) on this transaction. */
  tx: PrismaTx;
  payload: unknown;
  requestId: string;
  requestedBy: string;
  /** The approver deciding the request. */
  approver: AuthUser;
}

export type ApprovalHandler = (
  context: ApprovalHandlerContext,
) => Promise<void>;

/**
 * `onApprove` runs the effect; optional `onReject` lets the app record the
 * rejection (e.g. set its own status). Each runs at most once, in the same
 * transaction as the status change and the audit entry.
 */
export interface ApprovalHandlers {
  onApprove: ApprovalHandler;
  onReject?: ApprovalHandler;
}

export interface ApprovalView {
  id: string;
  actionName: string;
  status: ApprovalRequest['status'];
  requestedBy: string;
  decidedBy: string | null;
  createdAt: Date;
  decidedAt: Date | null;
}

function toView(request: ApprovalRequest): ApprovalView {
  return {
    id: request.id,
    actionName: request.actionName,
    status: request.status,
    requestedBy: request.requestedBy,
    decidedBy: request.decidedBy,
    createdAt: request.createdAt,
    decidedAt: request.decidedAt,
  };
}

/**
 * Two-person approvals (ADR 0004). Apps register named handlers at startup
 * and submit actions; the effect runs only when a different user with the
 * `approver` role approves, exactly once, in one transaction with the status
 * change and the audit entry.
 */
@Injectable()
export class ApprovalsService {
  private readonly handlers = new Map<string, ApprovalHandlers>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(PLATFORM_AUTH) private readonly auth: PlatformAuth,
  ) {}

  registerHandler(
    actionName: string,
    handler: ApprovalHandler | ApprovalHandlers,
  ): void {
    if (this.handlers.has(actionName)) {
      throw new Error(`Approval handler "${actionName}" is already registered`);
    }
    this.handlers.set(
      actionName,
      typeof handler === 'function' ? { onApprove: handler } : handler,
    );
  }

  /**
   * Stores a pending request. Has no effect until approved. Pass `tx` to
   * create the request in the caller's transaction (e.g. together with the
   * app's own pending record).
   */
  async submit(
    user: AuthUser,
    actionName: string,
    payload: Prisma.InputJsonValue,
    tx?: PrismaTx,
  ): Promise<ApprovalView> {
    if (!this.handlers.has(actionName)) {
      throw new Error(`No approval handler registered for "${actionName}"`);
    }
    if (tx) return this.createRequest(tx, user, actionName, payload);
    return this.prisma.$transaction((ownTx) =>
      this.createRequest(ownTx, user, actionName, payload),
    );
  }

  private async createRequest(
    tx: PrismaTx,
    user: AuthUser,
    actionName: string,
    payload: Prisma.InputJsonValue,
  ): Promise<ApprovalView> {
    const created = await tx.approvalRequest.create({
      data: { actionName, payload, requestedBy: user.id },
    });
    await this.audit.record(tx, {
      actor: user.id,
      entity: APPROVAL_ENTITY,
      entityId: created.id,
      action: 'approval.requested',
      after: { ...toView(created), payload },
    });
    return toView(created);
  }

  approve(user: AuthUser, id: string): Promise<ApprovalView> {
    return this.decide(user, id, 'approved');
  }

  reject(user: AuthUser, id: string): Promise<ApprovalView> {
    return this.decide(user, id, 'rejected');
  }

  private decide(
    user: AuthUser,
    id: string,
    status: 'approved' | 'rejected',
  ): Promise<ApprovalView> {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.approvalRequest.findUnique({ where: { id } });
      if (!request) throw new NotFoundException('Approval request not found');
      if (!this.auth.hasRole(user, 'approver')) {
        throw new ForbiddenException('Deciding requires the approver role');
      }
      if (request.requestedBy === user.id) {
        throw new ForbiddenException('You cannot decide your own request');
      }
      const handlers = this.handlers.get(request.actionName);
      if (status === 'approved' && !handlers) {
        throw new InternalServerErrorException(
          `No approval handler registered for "${request.actionName}"`,
        );
      }

      // Conditional update: concurrent deciders serialize on the row lock and
      // only one sees status=pending, so the effect can run only once.
      const { count } = await tx.approvalRequest.updateMany({
        where: { id, status: 'pending' },
        data: { status, decidedBy: user.id, decidedAt: new Date() },
      });
      if (count === 0) {
        throw new ConflictException('Approval request was already decided');
      }

      const handler =
        status === 'approved' ? handlers?.onApprove : handlers?.onReject;
      if (handler) {
        await handler({
          tx,
          payload: request.payload,
          requestId: request.id,
          requestedBy: request.requestedBy,
          approver: user,
        });
      }

      const decided = await tx.approvalRequest.findUniqueOrThrow({
        where: { id },
      });
      await this.audit.record(tx, {
        actor: user.id,
        entity: APPROVAL_ENTITY,
        entityId: id,
        action: `approval.${status}`,
        before: toView(request),
        after: toView(decided),
      });
      return toView(decided);
    });
  }
}
