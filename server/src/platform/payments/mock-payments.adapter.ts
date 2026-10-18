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
 */
@Injectable()
export class MockPaymentsAdapter implements PaymentsAdapter {
  private readonly operations = new Map<string, StoredOperation>();
  /** Payments actually executed against the (mock) provider. */
  readonly executed: PaymentResult[] = [];

  async charge(request: ChargeRequest): Promise<PaymentResult> {
    return await this.once('charge', request.idempotencyKey, request, () => ({
      id: `mock_ch_${randomUUID()}`,
      kind: 'charge',
      status: 'succeeded',
      amount: PositiveMoneySchema.parse(request.amount),
    }));
  }

  async refund(request: RefundRequest): Promise<PaymentResult> {
    return await this.once('refund', request.idempotencyKey, request, () => ({
      id: `mock_re_${randomUUID()}`,
      kind: 'refund',
      status: 'succeeded',
      amount: PositiveMoneySchema.parse(request.amount),
    }));
  }

  private once(
    kind: PaymentResult['kind'],
    idempotencyKey: string,
    request: ChargeRequest | RefundRequest,
    execute: () => PaymentResult,
  ): Promise<PaymentResult> {
    const key = IdempotencyKeySchema.parse(idempotencyKey);
    const fingerprint = JSON.stringify([kind, request]);
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
