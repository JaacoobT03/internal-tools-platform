import { z } from 'zod';
import { PositiveMoneySchema } from '../../platform/money/money.schema';
import { findUnmaskedPii } from '../../platform/pii/mask';

export const REFUND_STATUSES = [
  'pending_approval',
  'paid',
  'rejected',
] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

/** Refunds above EUR 500.00 need a second approver. */
export const APPROVAL_THRESHOLD_CENTS = 50000;
const MAX_AMOUNT_CENTS = 2_147_483_647;

// Any run of 12+ digits (spaces/dashes allowed) could be a card number.
const LONG_DIGIT_RUN = /\d(?:[ -]?\d){11,}/;
const noCardNumber = (text: string) => !LONG_DIGIT_RUN.test(text);
const noPii = (text: string) => findUnmaskedPii(text).length === 0;

export const CreateRefundSchema = z
  .object({
    paymentReference: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .refine(noCardNumber, 'Must not contain a card number')
      .refine(noPii, 'Must not contain an email address or card number'),
    customerEmail: z.email().max(254),
    cardLast4: z
      .string()
      .regex(/^\d{4}$/, 'Card last 4 must be exactly 4 digits'),
    amount: PositiveMoneySchema.refine((money) => money.currency === 'EUR', {
      message: 'Only EUR refunds are supported',
      path: ['currency'],
    }).refine((money) => money.amountCents <= MAX_AMOUNT_CENTS, {
      message: 'Amount is too large',
      path: ['amountCents'],
    }),
    reason: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .refine(noCardNumber, 'Must not contain a card number')
      .refine(noPii, 'Must not contain an email address or card number'),
  })
  .strict();
export type CreateRefund = z.infer<typeof CreateRefundSchema>;

export const ListRefundsQuerySchema = z
  .object({ status: z.enum(REFUND_STATUSES).optional() })
  .strict();
export type ListRefundsQuery = z.infer<typeof ListRefundsQuerySchema>;

export const RefundIdSchema = z.uuid();

export const PayoutPayloadSchema = z.object({ refundId: z.uuid() }).strict();
