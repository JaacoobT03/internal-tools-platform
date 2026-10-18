export type RefundStatus = 'pending_approval' | 'paid' | 'rejected';

export const STATUS_LABELS: Record<RefundStatus, string> = {
  pending_approval: 'Pending approval',
  paid: 'Paid',
  rejected: 'Rejected',
};

export interface Refund {
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
}

/** "500.01" / "500,01" → 50001. String arithmetic only, never floats (ADR 0006). */
export function parseEurToCents(input: string): number | null {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(input.trim());
  if (!match) return null;
  const cents =
    Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

export function formatEur(amountCents: number): string {
  const euros = Math.floor(amountCents / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `EUR ${euros}.${String(amountCents % 100).padStart(2, '0')}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}
