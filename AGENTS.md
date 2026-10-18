# AGENTS.md — internal-tools-platform

Rules for every agent and human contributor. Read the critical rules first; details and ADR links follow.

## Critical rules

1. **Permissions:** every endpoint declares a permission (`@RequirePermission()`) or is explicitly public (`@Public()`). No exceptions. ([ADR 0002](.agents/decisions/0002-permission-per-endpoint.md))
2. **Audit:** every data mutation writes an append-only audit entry: who / what / when / before / after. ([ADR 0003](.agents/decisions/0003-append-only-audit-log.md))
3. **Approvals:** actions above a threshold need a second approver with the `approver` role. No self-approval. ([ADR 0004](.agents/decisions/0004-two-person-approvals.md))
4. **PII:** email and card numbers are masked by default. Reveal requires a permission and writes an audit entry. ([ADR 0005](.agents/decisions/0005-pii-masking-by-default.md))
5. **Money:** integer cents + currency code, never floats. Payments only via the payments adapter, always with an idempotency key. ([ADR 0006](.agents/decisions/0006-money-and-payments-adapter.md))
6. **Isolation:** apps live in `server/src/apps/<name>` and `client/app/<name>`. Apps import platform code only, never another app. ([ADR 0007](.agents/decisions/0007-app-isolation-and-ownership.md))
7. **Ownership:** app PRs must not modify platform code (`server/src/platform/`, `client/lib/`, harness files). ([ADR 0007](.agents/decisions/0007-app-isolation-and-ownership.md))
8. **Workflow:** spec → failing test → implementation. Lint, build and tests must be green. ([ADR 0008](.agents/decisions/0008-definition-of-done-and-new-tech.md))
9. **New tech:** ask before introducing new foundational technology (framework, database, auth provider, queue, ORM, etc.). ([ADR 0008](.agents/decisions/0008-definition-of-done-and-new-tech.md))

## Enforcement status

| Rule | Enforcement | Status |
|---|---|---|
| 1. Permission per endpoint | NestJS convention test scanning controllers for `@RequirePermission()` / `@Public()` | planned |
| 2. Append-only audit | No UPDATE/DELETE grants on audit table; no update/delete paths on audit entity | planned |
| 3. Two-person approvals | Per-app tests: self-approval refused (403); above-threshold pending until approved | planned |
| 4. PII masking | Per-app tests: responses masked; reveal writes audit entry | planned |
| 5. Money as integer cents | Money-DTO lint rule forbidding float fields | planned |
| 6. No cross-app imports | ESLint boundary rules | planned |
| 7. App PRs don't touch platform | CODEOWNERS + branch protection (code owner review required) | planned |
| 8. Spec → test → impl, green CI | CI workflow (lint/build/test steps) | planned |
| 9. Ask before new tech | Written rule only | planned |

> A rule may only be marked `enforced` when the ESLint rule or test implementing it exists in the repo. Do not claim enforcement that isn't there.

---

## Repository state

The repository currently contains only harness/governance files. No application code, `client/`, `server/`, or `docker-compose` files exist yet. Do not add them as part of harness changes.

## Auth and roles

- Auth is a **mock login with a role switcher** behind the platform's own auth interface. Real SSO (Entra ID / Okta) replaces the mock implementation later without touching app code. Apps depend only on the interface. ([ADR 0001](.agents/decisions/0001-mock-auth-behind-auth-interface.md))
- Roles:
  - `viewer` — read-only access to permitted data (masked PII).
  - `requester` — can create requests/actions.
  - `approver` — can approve or reject requests from others.
  - `auditor` — can read the audit log.
- Permissions are granted to roles; endpoints check permissions, not roles directly.

## Permissions

- Every controller handler carries `@RequirePermission('<app>.<resource>.<action>')` or `@Public()`.
- Public endpoints are an explicit allowlist (e.g. health check, login). Adding to it needs code owner review.
- Planned enforcement: a NestJS convention test that scans all controllers and fails if any handler lacks one of the two decorators. ([ADR 0002](.agents/decisions/0002-permission-per-endpoint.md))

## Audit log

- Every create/update/delete writes an audit entry: actor (who), entity + action (what), timestamp (when), `before` and `after` snapshots.
- Reveals of PII also write an audit entry.
- The audit log is append-only: no update or delete code paths, and (planned) no UPDATE/DELETE database grants on the audit table. ([ADR 0003](.agents/decisions/0003-append-only-audit-log.md))

## Approvals

- Apps define thresholds in their spec (example: refunds above EUR 500).
- Above threshold, the action is stored as pending and has **no effect** until a second user with the `approver` role approves it.
- A user approving their own request is refused with **403**.
- Every app with approvals must include the required tests (see below). ([ADR 0004](.agents/decisions/0004-two-person-approvals.md))

## Personal data (PII)

- Email addresses and card numbers are masked in all API responses by default.
- A dedicated reveal endpoint returns the unmasked value; it requires a permission and writes an audit entry.
- Every app with personal data must include the required tests (see below). ([ADR 0005](.agents/decisions/0005-pii-masking-by-default.md))

## Money and payments

- Amounts are integers in minor units (cents) plus an ISO 4217 currency code. Never floats.
- Payments go only through the platform payments adapter, and every call carries an idempotency key.
- Planned enforcement: money-DTO lint rule forbidding float fields. ([ADR 0006](.agents/decisions/0006-money-and-payments-adapter.md))

## App isolation and ownership

- Server app code: `server/src/apps/<name>/`. Client app code: `client/app/<name>/`.
- Apps may import from platform (`server/src/platform/`, `client/lib/`) only — never from another app.
- Planned enforcement: ESLint boundary rules banning cross-app imports.
- App PRs must not modify platform or harness code. Platform changes go in separate PRs.
- Ownership is defined in `CODEOWNERS`. ([ADR 0007](.agents/decisions/0007-app-isolation-and-ownership.md))

### Branch protection

`main` is protected: a PR is required, code owner review is required (via `CODEOWNERS`), and CI must pass. No CI job tries to detect whether a PR is app-scoped; the CODEOWNERS review requirement is the mechanism that keeps app PRs out of platform code.

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
