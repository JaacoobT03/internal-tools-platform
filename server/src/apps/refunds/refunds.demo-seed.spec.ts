import { MockPaymentsAdapter } from '../../platform/payments/mock-payments.adapter';
import type { PaymentsAdapter } from '../../platform/payments/payments-adapter';
import type { PrismaService } from '../../platform/prisma/prisma.service';
import { RefundsDemoSeed } from './refunds.demo-seed';
import type { RefundsService } from './refunds.service';

describe('RefundsDemoSeed', () => {
  const originalEnv = process.env.NODE_ENV;
  let prisma: { refund: { count: jest.Mock } };
  let refunds: { create: jest.Mock; reject: jest.Mock };

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    prisma = { refund: { count: jest.fn().mockResolvedValue(0) } };
    refunds = {
      create: jest.fn().mockResolvedValue({ id: 'r1' }),
      reject: jest.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  const seed = (payments: PaymentsAdapter) =>
    new RefundsDemoSeed(
      prisma as unknown as PrismaService,
      refunds as unknown as RefundsService,
      payments,
    ).onApplicationBootstrap();

  it('seeds an empty table when payouts go to the mock adapter', async () => {
    await seed(new MockPaymentsAdapter());
    expect(refunds.create).toHaveBeenCalled();
  });

  it('does not run with a non-mock payments adapter', async () => {
    const realProvider: PaymentsAdapter = {
      charge: jest.fn(),
      refund: jest.fn(),
    };
    await seed(realProvider);
    expect(refunds.create).not.toHaveBeenCalled();
    expect(refunds.reject).not.toHaveBeenCalled();
  });

  it.each(['test', 'production'])(
    'does not run with NODE_ENV=%s',
    async (env) => {
      process.env.NODE_ENV = env;
      await seed(new MockPaymentsAdapter());
      expect(refunds.create).not.toHaveBeenCalled();
    },
  );
});
