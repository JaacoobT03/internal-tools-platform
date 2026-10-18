import { Injectable } from '@nestjs/common';
import { Prisma } from '../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaTx } from '../prisma/prisma.types';

export interface AuditRecordInput {
  /** User id of who did it. */
  actor: string;
  /** What kind of record, e.g. `refunds.Refund`. */
  entity: string;
  entityId: string;
  /** e.g. `create`, `update`, `delete`, `approval.approved`, `pii.reveal`. */
  action: string;
  before?: unknown;
  after?: unknown;
}

export interface AuditQuery {
  entity?: string;
  entityId?: string;
  limit: number;
}

function toJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (value === undefined || value === null) return Prisma.DbNull;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/**
 * Append-only audit log (ADR 0003). There is deliberately no update or delete
 * method; the database trigger rejects UPDATE/DELETE/TRUNCATE as well.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records an audit entry. Pass the mutation's transaction client so the
   * entry commits or rolls back together with the change:
   *
   *   await prisma.$transaction(async (tx) => {
   *     const after = await tx.refund.update(...);
   *     await audit.record(tx, { actor: user.id, entity, entityId, action: 'update', before, after });
   *   });
   */
  async record(tx: PrismaTx, input: AuditRecordInput): Promise<void> {
    await tx.auditEntry.create({
      data: {
        actor: input.actor,
        entity: input.entity,
        entityId: input.entityId,
        action: input.action,
        before: toJson(input.before),
        after: toJson(input.after),
      },
    });
  }

  list(query: AuditQuery) {
    return this.prisma.auditEntry.findMany({
      where: { entity: query.entity, entityId: query.entityId },
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      take: query.limit,
    });
  }
}
