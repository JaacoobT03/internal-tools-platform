---
name: new-internal-app
description: Step-by-step recipe for building a new internal app on the platform, from spec to Definition of Done. Use whenever creating a new app under server/src/apps/<name> and client/app/<name>.
---

# New internal app

Follow these steps in order. Read `AGENTS.md` first; its critical rules apply throughout.

## 1. Write the spec

1. Copy `.agents/specs/_template.md` to `.agents/specs/<name>.md`.
2. Fill in **Customer experience** and **Required behavior** as numbered, testable statements.
3. Fill in **Roles and permissions**: every endpoint gets a permission `<name>.<resource>.<action>` mapped to roles (`viewer`, `requester`, `approver`, `auditor`). List any `@Public()` endpoint with a justification.
4. Fill in **Personal data fields**: every email/card (or other PII) field, its masked format and its reveal permission.
5. Fill in **Approval rules**: actions above a threshold (amounts in integer cents + currency) that need a second approver.
6. If the app needs new foundational technology, stop and ask before continuing (ADR 0008).

## 2. Scaffold

1. Create `server/src/apps/<name>/` and `client/app/<name>/`.
2. Import only from platform (`server/src/platform/`, `client/lib/`). Never import from another app.
3. Do not modify platform or harness files in this PR. If the platform is missing something, open a separate platform PR. Only exceptions (reviewed by the platform owner via CODEOWNERS): put the app's Prisma models in `server/prisma/schema/<name>.prisma`, add its migrations under `server/prisma/migrations/`, and register its module with one line in `server/src/app.module.ts`.

## 3. Write failing tests first

Write tests for every Required behavior item and every test in **Required tests** below. Confirm they fail before implementing.

## 4. Implement

1. **Auth and permissions:** use the platform auth interface only. Put `@RequirePermission('<name>.<resource>.<action>')` on every controller handler, or `@Public()` if listed in the spec.
2. **Audit writes:** every create/update/delete writes an audit entry (who, what, when, before, after) in the same unit of work as the mutation.
3. **Approval flow:** above-threshold actions are stored as pending with no effect; only a different user with the `approver` role can approve; self-approval returns 403; approvals/rejections are audited.
4. **Masking:** mask email/card fields in every API response; implement a reveal endpoint that requires its permission and writes an audit entry.
5. **Money:** integer cents + currency; payments/refunds only via the platform payments adapter with an idempotency key.

## 5. Required tests

This section is mandatory.

Every app with approvals or personal data must include tests proving:
(a) a requester approving their own request is refused (403);
(b) an action above the threshold has no effect until a second person with the approver role approves it;
(c) API responses never contain unmasked email or card numbers unless the reveal endpoint is used, and every reveal creates an audit entry.

Also add tests that every mutation writes an audit entry with before/after values.

## 6. Definition of Done checklist

- [ ] Spec at `.agents/specs/<name>.md` is complete (all five sections filled or "None").
- [ ] Tests were written first and initially failed.
- [ ] Every endpoint has `@RequirePermission()` or `@Public()`.
- [ ] Every mutation writes an audit entry.
- [ ] Approval flow implemented and tested (if applicable).
- [ ] PII masked by default; reveal requires permission and is audited (if applicable).
- [ ] Money is integer cents + currency; payments via adapter with idempotency key (if applicable).
- [ ] Required tests (a), (b), (c) present where applicable.
- [ ] No cross-app imports; no platform or harness files changed.
- [ ] No new foundational technology without prior approval.
- [ ] Lint, build and tests green locally and in CI.
