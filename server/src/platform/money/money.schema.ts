import { z } from 'zod';

const ISO_4217 = new Set(Intl.supportedValuesOf('currency'));

/** ISO 4217 alphabetic currency code, e.g. `EUR`. */
export const CurrencyCodeSchema = z
  .string()
  .regex(/^[A-Z]{3}$/, 'Currency must be a 3-letter uppercase ISO 4217 code')
  .refine((code) => ISO_4217.has(code), 'Unknown ISO 4217 currency code');

/**
 * Money (ADR 0006): integer minor units (cents) + ISO 4217 currency.
 * Floats, numeric strings and unsafe integers are rejected.
 */
export const MoneySchema = z
  .object({
    amountCents: z.number().int('Amount must be integer cents').safe(),
    currency: CurrencyCodeSchema,
  })
  .strict();

/** Money with a strictly positive amount (charges, refunds). */
export const PositiveMoneySchema = MoneySchema.refine(
  (money) => money.amountCents > 0,
  { message: 'Amount must be positive', path: ['amountCents'] },
);

export type Money = z.infer<typeof MoneySchema>;
