# 0005 — PII masking by default

## Status

Accepted. Enforcement: planned (mandated per-app tests).

## Context

Internal tools routinely display customer emails and card numbers. Most users only need masked values; full values leaking into responses, logs or screenshots is a compliance risk.

## Decision

- Email addresses and card numbers are masked in all API responses by default (e.g. `j***@example.com`, `**** **** **** 4242`).
- A dedicated reveal endpoint returns the unmasked value. It requires a specific permission and writes an audit entry (ADR 0003).
- Each app lists its personal data fields in its spec.

## Consequences

- Every app with personal data must include tests proving API responses never contain unmasked email or card numbers unless the reveal endpoint is used, and every reveal creates an audit entry.
- Masking happens server-side; the client never receives unmasked values outside the reveal flow.
