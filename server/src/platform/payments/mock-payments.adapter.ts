import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { PositiveMoneySchema } from '../money/money.schema';
import {
  ChargeRequest,
  IdempotencyKeyReuseError,
  PaymentResult,
  PaymentsAdapter,
  RefundRequest,
} from './payments-adapter';

const IdempotencyKeySchema = z.string().trim().min(1).max(255);

interface StoredOperation {
  fingerprint: string;
  result: Promise<PaymentResult>;
}

/**
 * Development-only adapter. Keyed by idempotency key: a repeated call with
 * the same key returns the stored result (even while the first call is still
 * in flight) and never executes the payment twice.
 *
 * Keys live in process memory, so the guarantee holds only until the server
 * restarts. That is acceptable for a mock that moves no money; a real adapter
 * must forward the key to the provider (or persist it) so retries survive
 * restarts (see `PaymentsAdapter`).
 */
@Injectable()
export class MockPaymentsAdapter implements PaymentsAdapter {
  private readonly operations = new Map<string, StoredOperation>();
  /** Payments actually executed against the (mock) provider. */
  readonly executed: PaymentResult[] = [];

  async charge(request: ChargeRequest): Promise<PaymentResult> {
    const fingerprint = JSON.stringify([
      'charge',
      request.amount?.amountCents,
      request.amount?.currency,
      request.reference,
    ]);
    return await this.once(request.idempotencyKey, fingerprint, () => ({
      id: `mock_ch_${randomUUID()}`,
      kind: 'charge',
      status: 'succeeded',
      amount: PositiveMoneySchema.parse(request.amount),
    }));
  }

  async refund(request: RefundRequest): Promise<PaymentResult> {
    const fingerprint = JSON.stringify([
      'refund',
      request.amount?.amountCents,
      request.amount?.currency,
      request.paymentId,
    ]);
    return await this.once(request.idempotencyKey, fingerprint, () => ({
      id: `mock_re_${randomUUID()}`,
      kind: 'refund',
      status: 'succeeded',
      amount: PositiveMoneySchema.parse(request.amount),
    }));
  }

  private once(
    idempotencyKey: string,
    fingerprint: string,
    execute: () => PaymentResult,
  ): Promise<PaymentResult> {
    const key = IdempotencyKeySchema.parse(idempotencyKey);
    const stored = this.operations.get(key);
    if (stored) {
      if (stored.fingerprint !== fingerprint) {
        return Promise.reject(new IdempotencyKeyReuseError(key));
      }
      return stored.result;
    }
    const result = Promise.resolve().then(() => {
      const payment = execute();
      this.executed.push(payment);
      return payment;
    });
    this.operations.set(key, { fingerprint, result });
    result.catch(() => this.operations.delete(key));
    return result;
  }
}
