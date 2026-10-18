# AGENTS.md — internal-tools-platform

Rules for every agent and human contributor. Read the critical rules first; details and ADR links follow.

## Critical rules

1. **Permissions:** every endpoint declares a permission (`@RequirePermission()`) or is explicitly public (`@Public()`). No exceptions. ([ADR 0002](.agents/decisions/0002-permission-per-endpoint.md))
2. **Audit:** every data mutation writes an append-only audit entry: who / what / when / before / after. ([ADR 0003](.agents/decisions/0003-append-only-audit-log.md))
3. **Approvals:** actions above a threshold need a second approver with the `approver` role. No self-approval. ([ADR 0004](.agents/decisions/0004-two-person-approvals.md))
4. **PII:** email and card numbers are masked by default. Reveal requires a permission and writes an audit entry. ([ADR 0005](.agents/decisions/0005-pii-masking-by-default.md))
5. **Money:** integer cents + currency code, never floats. Payments only via the payments adapter, always with an idempotency key. ([ADR 0006](.agents/decisions/0006-money-and-payments-adapter.md))
6. **Isolation:** apps live in `server/src/apps/<name>` and `client/app/<name>`; platform pages live in `client/app/(platform)/`. Apps import platform code only, never another app. ([ADR 0007](.agents/decisions/0007-app-isolation-and-ownership.md))
7. **Ownership:** app PRs must not modify platform code (`server/src/platform/`, `client/lib/`, harness files). Only exception: an app PR may add its own `server/prisma/schema/<app>.prisma`, its own migrations, one module registration in `server/src/app.module.ts`, and one entry in `client/lib/registry.ts`, reviewed by the platform owner via CODEOWNERS. ([ADR 0007](.agents/decisions/0007-app-isolation-and-ownership.md))
8. **Workflow:** spec → failing test → implementation. Lint, build and tests must be green. ([ADR 0008](.agents/decisions/0008-definition-of-done-and-new-tech.md))
9. **New tech:** ask before introducing new foundational technology (framework, database, auth provider, queue, ORM, etc.). ([ADR 0008](.agents/decisions/0008-definition-of-done-and-new-tech.md))

## Enforcement status

Evidence, file paths and caveats: [.agents/enforcement.md](.agents/enforcement.md).

| Rule                                    | Mechanism                                          | Status   |
| --------------------------------------- | -------------------------------------------------- | -------- |
| 1. Permission per endpoint              | Controller convention test + deny-by-default guard | enforced |
| 2. Append-only audit                    | DB trigger test + `asUser` audit tripwire          | enforced |
| 3. Two-person approvals                 | Platform approval API tests                        | enforced |
| 4. PII masking                          | Masking/reveal tests + `asUser` PII tripwire       | enforced |
| 5. Money as cents; payments via adapter | Money schema test + payment-SDK import lint rule   | enforced |
| 6. App isolation                        | `eslint-plugin-boundaries` + fixture test          | enforced |
| 7. App PRs don't touch platform         | Ruleset `protect-main` + `CODEOWNERS` review       | enforced |
| 8a. Green before merge                  | CI job `ci`, required check                        | enforced |
| 8b. Spec → failing test → impl          | Reviewer check                                     | planned  |
| 9. Ask before new tech                  | Written rule                                       | planned  |
| Request input validation                | `validated-request-input` lint rule + fixture test | enforced |
| AGENTS.md ≤ 16,384 bytes                | `tools/agents-md-size.test.cjs`                    | enforced |

Known gap: the app connects as the owner of `audit_entry` and could drop the audit trigger; the fix is a separate role with only INSERT/SELECT (README "Next steps").

> A rule may only be marked `enforced` when the ESLint rule or test implementing it exists in the repo. Do not claim enforcement that isn't there.

---

## Repository state and commands

pnpm workspace with `client/` (Next.js) and `server/` (NestJS), Postgres 16 via `compose.yaml`, Prisma 7, Zod ([ADR 0009](.agents/decisions/0009-stack.md)). The platform security layer (auth, permissions, audit, approvals, PII, money/payments, validation) exists in `server/src/platform/`; no business apps yet.

| Command           | What it does                                                                     |
| ----------------- | -------------------------------------------------------------------------------- |
| `pnpm dev`        | `docker compose up --build`: postgres, server (:3001), client (:3000)            |
| `pnpm lint`       | ESLint (incl. boundary rules) + `prettier --check`                               |
| `pnpm build`      | Build server (incl. `prisma generate`) and client                                |
| `pnpm test`       | Unit tests (root boundary tests, server, client)                                 |
| `pnpm test:api`   | supertest API tests against `platform_test` in Postgres (needs postgres running) |
| `pnpm db:migrate` | `prisma migrate deploy` against `DATABASE_URL`                                   |

## Auth and roles

- Auth is a **mock login with a role switcher** behind the platform's own auth interface. Real SSO (Entra ID / Okta) replaces the mock implementation later without touching app code. Apps depend only on the interface. ([ADR 0001](.agents/decisions/0001-mock-auth-behind-auth-interface.md))
- Roles:
  - `viewer` — read-only access to permitted data (masked PII).
  - `requester` — can create requests/actions.
  - `approver` — can approve or reject requests from others.
  - `auditor` — can read the audit log.
- Permissions are granted to roles; endpoints check permissions, not roles directly.
- Implementation: apps inject `PLATFORM_AUTH` (`PlatformAuth`: current user, roles, `hasPermission`) and use `@CurrentUser()`. The mock (`MockAuthService`) resolves the user from the `X-User-Id` header; unknown ids get 401. Seed users (`server/src/platform/auth/mock-users.ts`): `u-requester`, `u-approver`, `u-requester-approver` (both roles), `u-auditor`, `u-viewer`. The server refuses to start with mock auth or the mock payments adapter when `NODE_ENV=production`.
- Apps grant their own `<app>.*` permissions to roles with `PermissionRegistry.grant()`; `platform.*` grants are fixed (`platform.audit.read` → auditor only, `platform.approvals.decide` → approver only).

## Permissions

- Every controller handler carries `@RequirePermission('<app>.<resource>.<action>')` or `@Public()`.
- Public endpoints are an explicit allowlist (e.g. health check, login). Adding to it needs code owner review.
- The decorators must be on the handler; class-level metadata is ignored. The global guard denies any handler without one.
- Enforced: `server/test/permission-convention.api-spec.ts` scans all controllers and fails if any handler lacks one of the two decorators. ([ADR 0002](.agents/decisions/0002-permission-per-endpoint.md))

## Input validation

- Every `@Body()`, `@Query()` and `@Param()` passes `new ZodValidationPipe(schema)` (`server/src/platform/validation/`).
- Enforced: ESLint rule `platform/validated-request-input`, proven by `tools/eslint-platform-rules.test.cjs`.

## Audit log

- Every create/update/delete writes an audit entry: actor (who), entity + action (what), timestamp (when), `before` and `after` snapshots.
- Reveals of PII also write an audit entry.
- Write entries with `AuditService.record(tx, …)` inside the mutation's Prisma transaction.
- The audit log is append-only: no update or delete code paths, and a database trigger rejects UPDATE, DELETE and TRUNCATE on `audit_entry`. Auditors read it via `GET /audit` and the `/audit` page. ([ADR 0003](.agents/decisions/0003-append-only-audit-log.md))
- Known gap: the app connects as the table owner, which could drop the trigger. The fix is a separate database role with only INSERT/SELECT on the audit table (README "Next steps").

## Approvals

- Apps define thresholds in their spec (example: refunds above EUR 500).
- Above threshold, the action is stored as pending and has **no effect** until a second user with the `approver` role approves it.
- A user approving their own request is refused with **403**.
- Implementation: register the effect at startup with `ApprovalsService.registerHandler(name, fn)` and store requests with `submit(user, name, payload)`; approval runs the handler once, in one transaction with the status change and audit entry.
- Every app with approvals must include the required tests (see below). ([ADR 0004](.agents/decisions/0004-two-person-approvals.md))

## Personal data (PII)

- Email addresses and card numbers are masked in all API responses by default.
- A dedicated reveal endpoint returns the unmasked value; it requires a permission and writes an audit entry. Use `maskEmail` / `maskCard`, and `@RevealEndpoint(permission)` + `PiiRevealService.reveal()` for reveal endpoints.
- Every app with personal data must include the required tests (see below). ([ADR 0005](.agents/decisions/0005-pii-masking-by-default.md))

## Money and payments

- Amounts are integers in minor units (cents) plus an ISO 4217 currency code. Never floats.
- Payments go only through the platform payments adapter, and every call carries an idempotency key.
- Use `MoneySchema` (`server/src/platform/money/`) for amounts and inject `PAYMENTS_ADAPTER` for payments.
- Enforced: `MoneySchema` rejects floats (test); ESLint rule `platform/no-payment-sdk-import` keeps provider SDKs inside `server/src/platform/payments/`. ([ADR 0006](.agents/decisions/0006-money-and-payments-adapter.md))

## App isolation and ownership

- Server app code: `server/src/apps/<name>/`. Client app code: `client/app/<name>/`. Platform pages: `client/app/(platform)/` (platform-owned, not an app).
- Apps may import from platform (`server/src/platform/`, `client/lib/`) only — never from another app.
- Enforced: ESLint boundary rules (`eslint.config.mjs`) reject app → other app and platform → app imports and classify `client/app/(platform)/` as platform; `tools/eslint-boundaries.test.cjs` proves it.
- `server/src/app.module.ts` is the composition root and the only server file outside an app that registers app modules.
- App PRs must not modify platform or harness code. Platform changes go in separate PRs. Exception: an app PR may add its own Prisma schema file `server/prisma/schema/<app>.prisma`, its own migrations in `server/prisma/migrations/`, one module registration in `server/src/app.module.ts`, and one entry (its header navigation link) in `client/lib/registry.ts`; nothing else outside its app folders. The platform owner reviews these via CODEOWNERS.
- Ownership is defined in `CODEOWNERS`. ([ADR 0007](.agents/decisions/0007-app-isolation-and-ownership.md))

### Branch protection

`main` is protected by the GitHub ruleset `protect-main`: a PR is required, code owner review is required (via `CODEOWNERS`), and the CI job `ci` is a required status check. No CI job tries to detect whether a PR is app-scoped; the CODEOWNERS review requirement is the mechanism. The repo admin can bypass the ruleset in this one-person repo.

## Definition of Done

1. Spec written from `.agents/specs/_template.md` (customer experience, behavior, roles/permissions, PII fields, approval rules).
2. Failing tests written first, covering the spec and the required tests.
3. Implementation makes them pass.
4. Lint, build and tests green locally and in CI.
5. No platform/harness files changed in an app PR.
6. No new foundational technology introduced without asking first. ([ADR 0008](.agents/decisions/0008-definition-of-done-and-new-tech.md))

To build a new app, follow `.agents/skills/new-internal-app/SKILL.md`.

## Required tests (apps with approvals or personal data)

Every app with approvals or personal data must include tests proving:

- (a) a requester approving their own request is refused (403);
- (b) an action above the threshold has no effect until a second person with the approver role approves it;
- (c) API responses never contain unmasked email or card numbers unless the reveal endpoint is used, and every reveal creates an audit entry.

Write API tests with `createTestApp()`, `asUser()` and `resetSeed()` from `server/test/helpers/` (see `server/test/README.md`). The `asUser` tripwires then fail any test whose response leaks unmasked PII or whose successful mutation writes no audit entry.

## Written-only rules

These have no mechanical enforcement planned; reviewers check them:

- Roles list: `viewer`, `requester`, `approver`, `auditor`.
- Mock auth sits behind the internal auth interface and must stay replaceable by Entra/Okta.
- Definition of Done workflow (spec → failing test → implementation).
- Ask before introducing new foundational technology.

## Decisions

All architecture decisions live in `.agents/decisions/`:

- [0001 Mock auth behind auth interface](.agents/decisions/0001-mock-auth-behind-auth-interface.md)
- [0002 Permission per endpoint](.agents/decisions/0002-permission-per-endpoint.md)
- [0003 Append-only audit log](.agents/decisions/0003-append-only-audit-log.md)
- [0004 Two-person approvals](.agents/decisions/0004-two-person-approvals.md)
- [0005 PII masking by default](.agents/decisions/0005-pii-masking-by-default.md)
- [0006 Money and payments adapter](.agents/decisions/0006-money-and-payments-adapter.md)
- [0007 App isolation and ownership](.agents/decisions/0007-app-isolation-and-ownership.md)
- [0008 Definition of Done and new tech](.agents/decisions/0008-definition-of-done-and-new-tech.md)
- [0009 Stack](.agents/decisions/0009-stack.md)
