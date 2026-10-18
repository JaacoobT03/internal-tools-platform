# 0006 — Money and payments adapter

## Status

Accepted. Enforcement: planned.

## Context

Floating-point money causes rounding errors, and direct calls to payment providers from app code risk duplicate charges/refunds and vendor lock-in.

## Decision

- Money is represented as an integer amount in minor units (cents) plus an ISO 4217 currency code. Never floats.
- Payments and refunds go only through the platform payments adapter.
- Every adapter call carries an idempotency key, so retries never execute an operation twice.

## Consequences

- Planned enforcement: a money-DTO lint rule forbidding float/number-with-decimals fields for amounts.
- Apps never import a payment provider SDK directly; swapping providers is a platform change.
- Until the lint rule exists, this rule is enforced by review.
