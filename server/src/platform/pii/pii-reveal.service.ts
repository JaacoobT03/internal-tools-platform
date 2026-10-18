import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { AuthUser, PlatformAuth } from '../auth/platform-auth';
import { PLATFORM_AUTH } from '../auth/platform-auth';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaTx } from '../prisma/prisma.types';

export interface RevealTarget {
  /** Reveal permission, e.g. `crm.customer.reveal-email`. */
  permission: string;
  entity: string;
  entityId: string;
  /** Field being revealed, e.g. `email`. The value itself is never audited. */
  field: string;
}

/** Audited reveal of an unmasked PII value (ADR 0005). */
@Injectable()
export class PiiRevealService {
  constructor(
    @Inject(PLATFORM_AUTH) private readonly auth: PlatformAuth,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Checks `target.permission`, loads the value and writes a `pii.reveal`
   * audit entry in one transaction. Nothing is returned unless the audit
   * entry is written.
   */
  async reveal<T>(
    user: AuthUser,
    target: RevealTarget,
    load: (tx: PrismaTx) => Promise<T>,
  ): Promise<T> {
    if (!this.auth.hasPermission(user, target.permission)) {
      throw new ForbiddenException(`Missing permission ${target.permission}`);
    }
    return this.prisma.$transaction(async (tx) => {
      const value = await load(tx);
      await this.audit.record(tx, {
        actor: user.id,
        entity: target.entity,
        entityId: target.entityId,
        action: 'pii.reveal',
        after: { field: target.field, permission: target.permission },
      });
      return value;
    });
  }
}
