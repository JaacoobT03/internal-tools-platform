# 0004 — Two-person approvals

## Status

Accepted. Enforcement: planned (mandated per-app tests).

## Context

High-impact actions (e.g. refunds above EUR 500) must not be executable by a single person, to limit fraud and mistakes.

## Decision

- Each app defines approval thresholds in its spec (example: refunds above EUR 500).
- An action above the threshold is stored as pending and has **no effect** until a second person with the `approver` role approves it.
- A user approving their own request is refused with **403**.
- Approvals and rejections are audited (ADR 0003).

## Consequences

- Every app with approvals must include tests proving:
  - a requester approving their own request is refused (403);
  - an action above the threshold has no effect until a second person with the approver role approves it.
- Planned enforcement is these mandated tests; until they exist per app, the rule is enforced by review.
