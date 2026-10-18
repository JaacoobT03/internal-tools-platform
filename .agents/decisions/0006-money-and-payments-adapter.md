# 0006 — Money and payments adapter

## Status

Accepted. Enforcement: enforced (money schema test + SDK-import lint rule); idempotency-key usage via per-app tests.

## Context

Floating-point money causes rounding errors, and direct calls to payment providers from app code risk duplicate charges/refunds and vendor lock-in.

## Decision

- Money is represented as an integer amount in minor units (cents) plus an ISO 4217 currency code. Never floats.
- Payments and refunds go only through the platform payments adapter.
- Every adapter call carries an idempotency key, so retries never execute an operation twice.

## Consequences

- Enforced: the Zod `MoneySchema` (`server/src/platform/money/`) accepts only safe integer cents plus an ISO 4217 code and rejects floats (tested). The mock payments adapter returns the stored result for a repeated idempotency key (tested).
- Apps never import a payment provider SDK directly; swapping providers is a platform change. Enforced by the ESLint rule `platform/no-payment-sdk-import`, proven by `tools/eslint-platform-rules.test.cjs`.
