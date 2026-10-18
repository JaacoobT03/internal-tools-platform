import type { Refund } from '../../platform/prisma/generated/client';
import { maskEmail } from '../../platform/pii/mask';
import type { RefundStatus } from './refunds.schemas';

/** API (and audit snapshot) shape of a refund: PII masked (ADR 0005). */
export interface RefundView {
  id: string;
  paymentReference: string;
  customerEmail: string;
  cardLast4: string;
  amount: { amountCents: number; currency: string };
  reason: string;
  status: RefundStatus;
  requestedBy: string;
  approvalRequestId: string | null;
  payoutId: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toRefundView(refund: Refund): RefundView {
  return {
    id: refund.id,
    paymentReference: refund.paymentReference,
    customerEmail: maskEmail(refund.customerEmail),
    cardLast4: `**** ${refund.cardLast4}`,
    amount: { amountCents: refund.amountCents, currency: refund.currency },
    reason: refund.reason,
    status: refund.status,
    requestedBy: refund.requestedBy,
    approvalRequestId: refund.approvalRequestId,
    payoutId: refund.payoutId,
    createdAt: refund.createdAt.toISOString(),
    updatedAt: refund.updatedAt.toISOString(),
  };
}
