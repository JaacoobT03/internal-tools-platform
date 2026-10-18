# Spec: refunds

## Customer experience

Support agents refund customers. Large refunds need a second person.

1. Anyone with access opens **Refunds** from the header and sees a list: customer (masked email), amount, reason, status, requested by, date. They can filter by status.
2. A requester clicks **New refund** and enters: original payment reference, customer email, card last 4 digits, amount in EUR, reason.
3. Refunds up to and including EUR 500.00 are paid immediately through the payments adapter and show "paid".
4. Refunds above EUR 500.00 show "pending approval" and nothing is paid.
5. An approver opens a pending refund and approves or rejects it. Approve pays it out (status "paid"); reject sets "rejected". Nobody can approve their own refund.
6. An approver can click **Reveal email** on a refund to see the full customer email; every reveal is logged.
7. A viewer can see the list and details (masked) but cannot create, approve or reveal.
8. The auditor sees every step in the Audit log.

Screens: `/refunds` (list + status filter + "New refund" for requesters), `/refunds/new` (form), `/refunds/<id>` (detail; approve/reject for approvers on pending refunds; "Reveal email" for approvers).

## Required behavior

1. `GET /refunds` returns all refunds, newest first, with the customer email masked (`j***@example.com`) and the card as `**** 1234`. `?status=paid|pending_approval|rejected` filters; any other status value returns 400.
2. `GET /refunds/:id` returns one refund (masked). Unknown id returns 404; a malformed id returns 400.
3. `POST /refunds` takes `{ paymentReference, customerEmail, cardLast4, amount: { amountCents, currency }, reason }` and returns 201 with the created refund (masked).
4. Amounts are integer cents greater than zero and the currency must be `EUR`. Floats, zero, negatives, numeric strings and other currencies return 400.
5. `cardLast4` must be exactly 4 digits. Full card numbers are never accepted or stored: unknown fields (e.g. `cardNumber`) return 400, and a run of 12 or more digits in `paymentReference` or `reason` returns 400. The customer email must be a valid email; emails inside `reason` return 400 (they would be stored unmasked).
6. A refund with `amountCents <= 50000` (EUR 500.00) is paid in the same request through `PAYMENTS_ADAPTER.refund()` with the refund id as idempotency key, and is stored as `paid` with the payout id.
7. A refund with `amountCents > 50000` is stored as `pending_approval` together with a platform approval request (action `refunds.payout`, payload `{ refundId }` only) in one transaction. Nothing is paid while pending.
8. `POST /refunds/:id/approve` (approver) approves the approval request through the platform: the refund is paid once through the adapter (idempotency key = refund id) and becomes `paid`, in the same transaction as the approval status change and audit entries.
9. `POST /refunds/:id/reject` (approver) rejects it: the refund becomes `rejected`; nothing is paid.
10. The requester of a refund cannot approve or reject it (403), even with the approver role. Deciding a refund that is not pending returns 409 and pays nothing more.
11. A payment reference can have at most one refund that is `pending_approval` or `paid`; creating another returns 409. A rejected refund does not block a new one.
12. `POST /refunds/:id/reveal-email` (approver) returns the unmasked email and writes a `pii.reveal` audit entry.
13. Every change writes an audit entry (entity `refunds.Refund`) with before/after snapshots (email masked in snapshots): `create`, `pay`, `reject`, plus the platform's `approval.*` and `pii.reveal` entries.
14. Viewers and auditors get 403 on create, approve, reject and reveal; requesters get 403 on approve, reject and reveal.
15. Local development only (not tests, not production): an empty refunds table is seeded with a few example refunds (some paid, one pending approval) through the normal service path, so they are audited too.

**Known limit:** the payout runs inside the database transaction. If the adapter call succeeds and the transaction then rolls back (e.g. the database fails before commit), the payout cannot be undone and the refund is not recorded as paid. Retrying the same refund is safe (same idempotency key), but nothing retries automatically. The real fix is to record the payout intent first (commit a `payout_pending` state), then call the provider with the refund id as idempotency key and retry safely until the result is recorded.

## Roles and permissions

| Permission                      | Granted to roles                     | Endpoints                                               |
| ------------------------------- | ------------------------------------ | ------------------------------------------------------- |
| `refunds.refund.read`           | viewer, requester, approver, auditor | `GET /refunds`, `GET /refunds/:id`                      |
| `refunds.refund.create`         | requester                            | `POST /refunds`                                         |
| `refunds.refund.decide`         | approver                             | `POST /refunds/:id/approve`, `POST /refunds/:id/reject` |
| `refunds.customer-email.reveal` | approver                             | `POST /refunds/:id/reveal-email`                        |

No `@Public()` endpoints.

## Personal data fields

| Field           | Masked format                         | Reveal permission               |
| --------------- | ------------------------------------- | ------------------------------- |
| `customerEmail` | `j***@example.com`                    | `refunds.customer-email.reveal` |
| `cardLast4`     | `**** 1234` (only last 4 ever stored) | None (never revealed further)   |

## Approval rules

| Action                           | Threshold                                    | Approver role | Effect while pending                          |
| -------------------------------- | -------------------------------------------- | ------------- | --------------------------------------------- |
| Refund payout (`refunds.payout`) | `amountCents > 50000` EUR (above EUR 500.00) | approver      | none: status `pending_approval`, nothing paid |
