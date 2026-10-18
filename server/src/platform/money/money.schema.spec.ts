import { MoneySchema, PositiveMoneySchema } from './money.schema';

describe('MoneySchema', () => {
  it('accepts integer cents with an ISO 4217 currency', () => {
    expect(MoneySchema.parse({ amountCents: 50000, currency: 'EUR' })).toEqual({
      amountCents: 50000,
      currency: 'EUR',
    });
    expect(
      MoneySchema.safeParse({ amountCents: -100, currency: 'USD' }).success,
    ).toBe(true);
  });

  it.each([
    ['float', { amountCents: 10.5, currency: 'EUR' }],
    ['tiny float', { amountCents: 0.1, currency: 'EUR' }],
    ['numeric string', { amountCents: '1000', currency: 'EUR' }],
    ['unsafe integer', { amountCents: 2 ** 53, currency: 'EUR' }],
    ['NaN', { amountCents: Number.NaN, currency: 'EUR' }],
    ['lowercase currency', { amountCents: 100, currency: 'eur' }],
    ['unknown currency', { amountCents: 100, currency: 'XXZ' }],
    ['extra field', { amountCents: 100, currency: 'EUR', amount: 1 }],
    ['missing currency', { amountCents: 100 }],
  ])('rejects %s', (_label, input) => {
    expect(MoneySchema.safeParse(input).success).toBe(false);
  });
});

describe('PositiveMoneySchema', () => {
  it.each([0, -1])('rejects %s', (amountCents) => {
    expect(
      PositiveMoneySchema.safeParse({ amountCents, currency: 'EUR' }).success,
    ).toBe(false);
  });
});
