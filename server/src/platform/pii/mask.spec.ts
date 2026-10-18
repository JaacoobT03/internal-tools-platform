import { randomUUID } from 'node:crypto';
import { findUnmaskedPii, maskCard, maskEmail, maskPiiDeep } from './mask';

// Its digits contain `9-9501-4319-8403`, a Luhn-valid 13-digit run.
const LUHN_UUID = 'c980d5b9-9501-4319-8403-fed366253389';

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
  it('ignores Luhn-valid digit runs inside UUIDs', () => {
    expect(
      findUnmaskedPii({
        id: LUHN_UUID,
        payoutId: `mock_re_${LUHN_UUID}`,
        upper: LUHN_UUID.toUpperCase(),
        [LUHN_UUID]: true,
      }),
    ).toEqual([]);
  });

  it('never flags random UUIDs', () => {
    const ids = Array.from({ length: 20000 }, () => randomUUID());
    expect(findUnmaskedPii(ids)).toEqual([]);
  });

  it('still finds a card number next to a UUID', () => {
    expect(findUnmaskedPii(`${LUHN_UUID} 4242 4242 4242 4242`)).toEqual([
      { kind: 'card', masked: '**** **** **** 4242' },
    ]);
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

  it.each([
    [{ 'jane@example.com': 1, 'j***@example.com': 2 }],
    [{ 'j***@example.com': 2, 'jane@example.com': 1 }],
  ])('keeps an already-masked key and the masked email key (%j)', (input) => {
    expect(maskPiiDeep(input)).toEqual({
      'j***@example.com': 2,
      'j***@example.com (2)': 1,
    });
  });

  it('does not reuse a suffix that exists as an original key', () => {
    expect(
      maskPiiDeep({
        'jane@example.com': 1,
        'j***@example.com': 2,
        'j***@example.com (2)': 3,
      }),
    ).toEqual({
      'j***@example.com': 2,
      'j***@example.com (2)': 3,
      'j***@example.com (3)': 1,
    });
  });

  it('keeps an own __proto__ key from a JSON snapshot', () => {
    const snapshot: unknown = JSON.parse(
      '{"__proto__":{"email":"jane@example.com"},"id":1}',
    );
    expect(JSON.stringify(maskPiiDeep(snapshot))).toBe(
      '{"__proto__":{"email":"j***@example.com"},"id":1}',
    );
  });
  it('leaves UUIDs in values and keys unchanged', () => {
    const snapshot = {
      entityId: LUHN_UUID,
      after: { id: LUHN_UUID, payoutId: `mock_re_${LUHN_UUID}` },
      byId: { [LUHN_UUID]: 1 },
    };
    expect(maskPiiDeep(snapshot)).toEqual(snapshot);
  });

  it('masks a card number next to a UUID but keeps the UUID', () => {
    expect(maskPiiDeep(`${LUHN_UUID} 4242 4242 4242 4242`)).toBe(
      `${LUHN_UUID} **** **** **** 4242`,
    );
  });

  it('masks a card whose digits also appear inside a UUID', () => {
    expect(maskPiiDeep(`${LUHN_UUID} card 9-9501-4319-8403`)).toBe(
      `${LUHN_UUID} card **** **** **** 8403`,
    );
  });
});
