import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import type { AuthUser } from '../../platform/auth/platform-auth';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { CreateRefund } from './refunds.schemas';
import { RefundsService } from './refunds.service';

// Local development only: the seed users of the dev mock login (ADR 0001).
const rita: AuthUser = {
  id: 'u-requester',
  name: 'Rita Requester',
  roles: ['requester'],
};
const bea: AuthUser = {
  id: 'u-requester-approver',
  name: 'Bea Both',
  roles: ['requester', 'approver'],
};
const arne: AuthUser = {
  id: 'u-approver',
  name: 'Arne Approver',
  roles: ['approver'],
};

const eur = (amountCents: number) => ({ amountCents, currency: 'EUR' });

const DEMO: { by: AuthUser; refund: CreateRefund; rejectBy?: AuthUser }[] = [
  {
    by: rita,
    refund: {
      paymentReference: 'pay_demo_1001',
      customerEmail: 'jane.doe@example.com',
      cardLast4: '4242',
      amount: eur(2499),
      reason: 'Item arrived damaged',
    },
  },
  {
    by: bea,
    refund: {
      paymentReference: 'pay_demo_1002',
      customerEmail: 'max.mustermann@example.com',
      cardLast4: '1881',
      amount: eur(50000),
      reason: 'Order cancelled before shipping',
    },
  },
  {
    by: rita,
    refund: {
      paymentReference: 'pay_demo_1003',
      customerEmail: 'li.wei@example.com',
      cardLast4: '0005',
      amount: eur(899),
      reason: 'Duplicate charge',
    },
  },
  {
    by: rita,
    refund: {
      paymentReference: 'pay_demo_1004',
      customerEmail: 'sam.taylor@example.com',
      cardLast4: '7310',
      amount: eur(129900),
      reason: 'Laptop returned within 30 days',
    },
  },
  {
    by: bea,
    refund: {
      paymentReference: 'pay_demo_1005',
      customerEmail: 'olga.petrova@example.com',
      cardLast4: '5100',
      amount: eur(64000),
      reason: 'Goodwill refund requested by customer',
    },
    rejectBy: arne,
  },
];

/**
 * Seeds example refunds into an empty table for local development, through
 * the normal service path (paid via the mock adapter, audited). Never runs
 * under tests or in production.
 */
@Injectable()
export class RefundsDemoSeed implements OnApplicationBootstrap {
  private readonly logger = new Logger(RefundsDemoSeed.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly refunds: RefundsService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const env = process.env.NODE_ENV;
    if (env === 'test' || env === 'production') return;
    if ((await this.prisma.refund.count()) > 0) return;
    for (const { by, refund, rejectBy } of DEMO) {
      const created = await this.refunds.create(by, refund);
      if (rejectBy) await this.refunds.reject(rejectBy, created.id);
    }
    this.logger.log(
      `Seeded ${DEMO.length} demo refunds (local development only)`,
    );
  }
}
