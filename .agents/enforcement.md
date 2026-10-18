# Enforcement evidence

Detail behind the enforcement table in [AGENTS.md](../AGENTS.md#enforcement-status). A rule may only be marked `enforced` when the ESLint rule or test implementing it exists in the repo.

## 1. Permission per endpoint — enforced

- `server/test/permission-convention.api-spec.ts` scans every controller handler registered in `AppModule` and fails on a handler without handler-level `@RequirePermission()` / `@Public()` (class-level metadata does not count).
- Deliberate-violation fixture `server/test/fixtures/undeclared-permission.module.ts` proves the scan catches it; the fixture is never registered in the running app.
- Runtime: the global `PermissionGuard` (`APP_GUARD`) refuses such handlers (deny by default).

## 2. Append-only audit — enforced

- DB trigger on `audit_entry` rejects UPDATE, DELETE and TRUNCATE (`server/test/audit.api-spec.ts`).
- The `asUser` tripwire (`server/test/helpers/as-user.ts`) fails every app's API test when a successful POST/PUT/PATCH/DELETE writes no audit entry; proven in `server/test/tripwires.api-spec.ts`.
- Not covered: before/after completeness still depends on per-app required tests.
- **Known gap:** the app connects to Postgres as the owner of `audit_entry`, so it could still drop or disable the trigger. The real fix is a separate database role with only INSERT/SELECT on the audit table (README "Next steps").

## 3. Two-person approvals — enforced

- `server/test/approvals.api-spec.ts` proves: pending has no effect, self-approval 403, missing approver role 403, the effect runs once in one transaction with the status change and audit entry, double-approve 409 without re-running, every transition audited.
- Not covered: app-specific thresholds need per-app tests.

## 4. PII masking — enforced

- Masking/reveal unit tests in `server/src/platform/pii/` (`mask.spec.ts`, `pii-reveal.service.spec.ts`).
- The `asUser` tripwire fails any app's API test whose response contains an unmasked email or Luhn-valid card number outside a declared `@RevealEndpoint()`; proven in `server/test/tripwires.api-spec.ts`.
- Not covered: reveal-endpoint correctness is still a per-app required test.

## 5. Money as integer cents; payments via adapter — enforced

- Zod `MoneySchema` rejects floats, numeric strings, unsafe integers and invalid currencies (`server/src/platform/money/money.schema.spec.ts`).
- ESLint rule `platform/no-payment-sdk-import` restricts payment provider SDKs (`stripe` et al.) to `server/src/platform/payments/`, proven by `tools/eslint-platform-rules.test.cjs` on fixtures in `tools/fixtures/platform-rules/`.
- The mock adapter returns the stored result for a repeated idempotency key (`mock-payments.adapter.spec.ts`); it keeps keys in memory only.
- Not covered: per-app idempotency-key usage is checked by required tests.

## 6. No cross-app imports; platform never imports apps — enforced

- `eslint-plugin-boundaries` rules in `eslint.config.mjs`. `client/app/(platform)/` is classified `client-platform`, not an app.
- Each rule and the `(platform)` classification are proven on deliberate fixtures by `tools/eslint-boundaries.test.cjs`.

## 7. App PRs don't touch platform — enforced

- GitHub ruleset `protect-main` on `main` requires a PR and code owner review (`CODEOWNERS`).
- `CODEOWNERS` marks the app-PR exceptions (own Prisma schema, own migrations, one `app.module.ts` line, one `client/lib/registry.ts` entry) and `client/app/(platform)/` as platform-owned.
- Caveat: the repo admin can bypass the ruleset in this one-person repo.

## 8a. Lint, build and tests green before merge — enforced

- CI job `ci` (`.github/workflows/ci.yml`) runs lint, build, unit and API tests; it is the required status check in `protect-main`.

## 8b. Spec → failing test → implementation — planned

- Written rule only; reviewers check.

## 9. Ask before new tech — planned

- Written rule only.

## Request input validation — enforced

- ESLint rule `platform/validated-request-input` requires `@Body()` / `@Query()` / `@Param()` from `@nestjs/common` to receive a `ZodValidationPipe`, proven by `tools/eslint-platform-rules.test.cjs`.

## AGENTS.md size — enforced

- Devin automatically includes `AGENTS.md` only up to 16 KiB. `tools/agents-md-size.test.cjs` fails when `AGENTS.md` exceeds 16,384 bytes. Put detail in `.agents/` files and link to them.
