import { Test } from '@nestjs/testing';
import { PAYMENTS_ADAPTER } from './payments-adapter';
import { PaymentsModule } from './payments.module';

describe('PaymentsModule', () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('provides the mock adapter outside production', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PaymentsModule],
    }).compile();
    expect(moduleRef.get(PAYMENTS_ADAPTER)).toBeDefined();
  });

  it('refuses the mock adapter with NODE_ENV=production', async () => {
    process.env.NODE_ENV = 'production';
    await expect(
      Test.createTestingModule({ imports: [PaymentsModule] }).compile(),
    ).rejects.toThrow(/Refusing to start: Mock payments adapter/);
  });
});
