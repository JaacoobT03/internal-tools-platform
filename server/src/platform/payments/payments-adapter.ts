import { Money } from '../money/money.schema';

export interface ChargeRequest {
  /** Retries with the same key return the stored result and never pay twice. */
  idempotencyKey: string;
  amount: Money;
  reference: string;
}

export interface RefundRequest {
  idempotencyKey: string;
  paymentId: string;
  amount: Money;
}

export interface PaymentResult {
  id: string;
  kind: 'charge' | 'refund';
  status: 'succeeded';
  amount: Money;
}

/**
 * The only way to move money (ADR 0006). Payment provider SDKs may only be
 * imported under server/src/platform/payments/ (ESLint rule
 * `platform/no-payment-sdk-imports`).
 */
export interface PaymentsAdapter {
  charge(request: ChargeRequest): Promise<PaymentResult>;
  refund(request: RefundRequest): Promise<PaymentResult>;
}

export const PAYMENTS_ADAPTER = Symbol('PAYMENTS_ADAPTER');

export class IdempotencyKeyReuseError extends Error {
  constructor(key: string) {
    super(`Idempotency key "${key}" was already used for a different request`);
  }
}
