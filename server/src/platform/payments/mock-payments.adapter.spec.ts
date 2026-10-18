import { MockPaymentsAdapter } from './mock-payments.adapter';
import { IdempotencyKeyReuseError } from './payments-adapter';

const eur = (amountCents: number) => ({ amountCents, currency: 'EUR' });

describe('MockPaymentsAdapter', () => {
  it('returns the stored result for a repeated idempotency key and pays once', async () => {
    const adapter = new MockPaymentsAdapter();
    const request = {
      idempotencyKey: 'k-1',
      amount: eur(1999),
      reference: 'r',
    };
    const first = await adapter.charge(request);
    const second = await adapter.charge({ ...request });
    expect(second).toEqual(first);
    expect(adapter.executed).toHaveLength(1);
  });

  it('pays once for concurrent calls with the same key', async () => {
    const adapter = new MockPaymentsAdapter();
    const request = { idempotencyKey: 'k-2', amount: eur(500), reference: 'r' };
    const results = await Promise.all([
      adapter.charge(request),
      adapter.charge(request),
      adapter.charge(request),
    ]);
    expect(new Set(results.map((result) => result.id)).size).toBe(1);
    expect(adapter.executed).toHaveLength(1);
  });

  it('executes separately for different keys', async () => {
    const adapter = new MockPaymentsAdapter();
    await adapter.refund({
      idempotencyKey: 'a',
      paymentId: 'p',
      amount: eur(1),
    });
    await adapter.refund({
      idempotencyKey: 'b',
      paymentId: 'p',
      amount: eur(1),
    });
    expect(adapter.executed).toHaveLength(2);
  });

  it('refuses reusing a key for a different request', async () => {
    const adapter = new MockPaymentsAdapter();
    await adapter.charge({
      idempotencyKey: 'k',
      amount: eur(100),
      reference: 'r',
    });
    await expect(
      adapter.charge({ idempotencyKey: 'k', amount: eur(200), reference: 'r' }),
    ).rejects.toBeInstanceOf(IdempotencyKeyReuseError);
    expect(adapter.executed).toHaveLength(1);
  });

  it('treats a retry with reordered fields as the same request', async () => {
    const adapter = new MockPaymentsAdapter();
    const first = await adapter.charge({
      idempotencyKey: 'k',
      amount: { amountCents: 100, currency: 'EUR' },
      reference: 'r',
    });
    const retry = await adapter.charge({
      reference: 'r',
      amount: { currency: 'EUR', amountCents: 100 },
      idempotencyKey: 'k',
    });
    expect(retry).toBe(first);
    expect(adapter.executed).toHaveLength(1);
  });

  it('refuses reusing a charge key for a refund', async () => {
    const adapter = new MockPaymentsAdapter();
    await adapter.charge({
      idempotencyKey: 'k',
      amount: eur(100),
      reference: 'p',
    });
    await expect(
      adapter.refund({ idempotencyKey: 'k', amount: eur(100), paymentId: 'p' }),
    ).rejects.toBeInstanceOf(IdempotencyKeyReuseError);
    expect(adapter.executed).toHaveLength(1);
  });

  it('rejects float amounts and missing idempotency keys without paying', async () => {
    const adapter = new MockPaymentsAdapter();
    await expect(
      adapter.charge({
        idempotencyKey: 'f',
        amount: eur(10.5),
        reference: 'r',
      }),
    ).rejects.toThrow();
    await expect(
      adapter.charge({ idempotencyKey: ' ', amount: eur(100), reference: 'r' }),
    ).rejects.toThrow();
    expect(adapter.executed).toHaveLength(0);
  });
});
