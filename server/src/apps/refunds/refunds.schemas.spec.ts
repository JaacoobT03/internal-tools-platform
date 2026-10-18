import { CreateRefundSchema, ListRefundsQuerySchema } from './refunds.schemas';

const valid = {
  paymentReference: 'pay_1001',
  customerEmail: 'jane.doe@example.com',
  cardLast4: '4242',
  amount: { amountCents: 50000, currency: 'EUR' },
  reason: 'Item arrived damaged',
};

describe('CreateRefundSchema', () => {
  it('accepts a valid refund', () => {
    expect(CreateRefundSchema.parse(valid)).toEqual(valid);
  });

  it.each([
    ['float', { amount: { amountCents: 1.5, currency: 'EUR' } }],
    ['zero', { amount: { amountCents: 0, currency: 'EUR' } }],
    ['USD', { amount: { amountCents: 100, currency: 'USD' } }],
    ['too large', { amount: { amountCents: 2 ** 31, currency: 'EUR' } }],
    ['5 digits', { cardLast4: '12345' }],
    ['letters', { cardLast4: '12a4' }],
    ['full card field', { cardNumber: '4242424242424242' }],
    ['card in reason', { reason: 'paid with 4000-0000-0000-0002' }],
    ['digits in reference', { paymentReference: '123456789012' }],
    ['email in reason', { reason: 'see bob@example.com' }],
    ['email in reference', { paymentReference: 'bob@example.com' }],
  ])('rejects %s', (_label, overrides) => {
    expect(
      CreateRefundSchema.safeParse({ ...valid, ...overrides }).success,
    ).toBe(false);
  });
});

describe('ListRefundsQuerySchema', () => {
  it('accepts known statuses and no status', () => {
    expect(ListRefundsQuerySchema.parse({})).toEqual({});
    expect(ListRefundsQuerySchema.parse({ status: 'paid' })).toEqual({
      status: 'paid',
    });
  });

  it('rejects unknown statuses and fields', () => {
    expect(ListRefundsQuerySchema.safeParse({ status: 'x' }).success).toBe(
      false,
    );
    expect(ListRefundsQuerySchema.safeParse({ foo: '1' }).success).toBe(false);
  });
});
