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
3. Do not modify platform or harness files in this PR. If the platform is missing something, open a separate platform PR. Only exceptions (reviewed by the platform owner via CODEOWNERS): put the app's Prisma models in `server/prisma/schema/<name>.prisma`, add its migrations under `server/prisma/migrations/`, register its module with one line in `server/src/app.module.ts`, and add one entry for the app to `client/lib/registry.ts` (`{ name, path, requiredPermission }`; drives the header navigation).

## 3. Write failing tests first

Write tests for every Required behavior item and every test in **Required tests** below. Confirm they fail before implementing.

Use the platform test helpers in `server/test/helpers/` (see `server/test/README.md`):

- `createTestApp()` boots the real app; `asUser(app, 'requester' | 'approver' | 'requesterApprover' | 'auditor' | 'viewer')` sends requests as a seed user; `resetSeed()` empties data tables (never the audit log) in `beforeEach`.
- The `asUser` tripwires apply automatically: a test fails if any response contains an unmasked email or card number (unless the handler is a `@RevealEndpoint()`), or if a successful POST/PUT/PATCH/DELETE writes no audit entry. Do not bypass them with raw supertest calls.

## 4. Implement

1. **Auth and permissions:** use the platform auth interface only (`PLATFORM_AUTH`, `@CurrentUser()`). Put `@RequirePermission('<name>.<resource>.<action>')` on every controller handler (not the class), or `@Public()` if listed in the spec. Grant the app's permissions to roles with `PermissionRegistry.grant()` at startup.
2. **Input:** every `@Body()`, `@Query()`, `@Param()` passes `new ZodValidationPipe(schema)` (lint-enforced).
3. **Audit writes:** every create/update/delete calls `AuditService.record(tx, { actor, entity, entityId, action, before, after })` inside the mutation's `prisma.$transaction`.
4. **Approval flow:** register the effect with `ApprovalsService.registerHandler('<name>.<action>', fn)` at startup and call `submit(user, name, payload)` for above-threshold actions. The platform enforces pending-has-no-effect, approver role, no self-approval (403), run-once and 409 on re-approval, and audits every transition.
5. **Masking:** mask email/card fields in every API response with `maskEmail` / `maskCard`; reveal endpoints use `@RevealEndpoint(permission)` and `PiiRevealService.reveal()`, which checks the permission and writes the audit entry.
6. **Money:** amounts use `MoneySchema` (integer cents + currency); payments/refunds only via the injected `PAYMENTS_ADAPTER` with an idempotency key (provider SDK imports are lint-blocked outside the platform).

## 5. Required tests

This section is mandatory.

Every app with approvals or personal data must include tests proving:
(a) a requester approving their own request is refused (403);
(b) an action above the threshold has no effect until a second person with the approver role approves it;
(c) API responses never contain unmasked email or card numbers unless the reveal endpoint is used, and every reveal creates an audit entry.

Also add tests that every mutation writes an audit entry with before/after values.

## 6. Walk the customer experience in the browser

Before opening the PR:

1. Run the app (`pnpm dev`, client at http://localhost:3000).
2. For each role relevant to the spec, select the seed user in the header's "Acting as" switcher and walk every **Customer experience** item of the spec in the browser, including refusals (e.g. a viewer refused, a requester refused self-approval).
3. Take a screenshot of each step per role and attach them to the PR description.

## 7. Definition of Done checklist

- [ ] Spec at `.agents/specs/<name>.md` is complete (all five sections filled or "None").
- [ ] Tests were written first and initially failed.
- [ ] Every endpoint has `@RequirePermission()` or `@Public()`.
- [ ] Every mutation writes an audit entry.
- [ ] Approval flow implemented and tested (if applicable).
- [ ] PII masked by default; reveal requires permission and is audited (if applicable).
- [ ] Money is integer cents + currency; payments via adapter with idempotency key (if applicable).
- [ ] Required tests (a), (b), (c) present where applicable; API tests use `asUser()` so the tripwires apply.
- [ ] Customer experience walked in the browser as each relevant role; screenshots attached to the PR.
- [ ] No cross-app imports; no platform or harness files changed (except the allowed schema, migrations, one `app.module.ts` line and one `client/lib/registry.ts` entry).
- [ ] No new foundational technology without prior approval.
- [ ] Lint, build and tests green locally and in CI.
