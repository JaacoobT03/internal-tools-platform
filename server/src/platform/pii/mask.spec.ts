import { findUnmaskedPii, maskCard, maskEmail, maskPiiDeep } from './mask';

describe('maskEmail', () => {
  it.each([
    ['jane.doe@example.com', 'j***@example.com'],
    ['a@b.co', 'a***@b.co'],
    ['not-an-email', '***'],
  ])('%s → %s', (input, expected) => {
    expect(maskEmail(input)).toBe(expected);
  });
});

describe('maskCard', () => {
  it.each([
    ['4242424242424242', '**** **** **** 4242'],
    ['4242 4242 4242 4242', '**** **** **** 4242'],
    ['5555-5555-5555-4444', '**** **** **** 4444'],
    ['123', '****'],
  ])('%s → %s', (input, expected) => {
    expect(maskCard(input)).toBe(expected);
  });
});

describe('findUnmaskedPii', () => {
  it('finds emails and Luhn-valid card numbers anywhere in a value', () => {
    expect(
      findUnmaskedPii({
        customer: { contact: ['x', 'Mail jane@example.com now'] },
        card: '4242 4242 4242 4242',
      }),
    ).toEqual([
      { kind: 'email', masked: 'j***@example.com' },
      { kind: 'card', masked: '**** **** **** 4242' },
    ]);
  });

  it('finds PII used as object keys', () => {
    expect(findUnmaskedPii({ 'jane@example.com': true })).toEqual([
      { kind: 'email', masked: 'j***@example.com' },
    ]);
  });

  it('ignores masked values, ids and non-Luhn digit runs', () => {
    expect(
      findUnmaskedPii({
        email: 'j***@example.com',
        card: '**** **** **** 4242',
        id: '4f9c6a1e-6a55-4b8e-9d1a-1234567890ab',
        timestamp: '2026-10-18T12:00:00.000Z',
        order: '1234567890123',
      }),
    ).toEqual([]);
  });
});

describe('maskPiiDeep', () => {
  it('masks nested strings and keeps other values', () => {
    const date = new Date();
    expect(
      maskPiiDeep({
        after: { email: 'jane@example.com', card: '4242424242424242', n: 5 },
        timestamp: date,
      }),
    ).toEqual({
      after: { email: 'j***@example.com', card: '**** **** **** 4242', n: 5 },
      timestamp: date,
    });
  });

  it('masks PII used as object keys without merging colliding keys', () => {
    const masked = maskPiiDeep({
      byEmail: { 'jane@example.com': 1, 'jim@example.com': 2 },
      '4242424242424242': 'card',
    });
    expect(masked).toEqual({
      byEmail: { 'j***@example.com': 1, 'j***@example.com (2)': 2 },
      '**** **** **** 4242': 'card',
    });
    expect(findUnmaskedPii(masked)).toEqual([]);
  });
});
