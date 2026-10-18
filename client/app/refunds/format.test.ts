import { formatEur, parseEurToCents } from './format';

describe('refund money formatting', () => {
  it.each([
    ['500', 50000],
    ['500.00', 50000],
    ['500.01', 50001],
    ['0.5', 50],
    ['1,25', 125],
    [' 12.3 ', 1230],
  ])('parses %p as %i cents without floats', (input, cents) => {
    expect(parseEurToCents(input)).toBe(cents);
  });

  it.each(['', 'abc', '1.234', '-5', '0', '0.00', '1e3'])(
    'rejects %p',
    (input) => {
      expect(parseEurToCents(input)).toBeNull();
    },
  );

  it('formats integer cents as EUR', () => {
    expect(formatEur(50000)).toBe('EUR 500.00');
    expect(formatEur(5)).toBe('EUR 0.05');
    expect(formatEur(123456)).toBe('EUR 1,234.56');
  });
});
