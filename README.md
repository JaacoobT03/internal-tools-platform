# internal-tools-platform

A governance-first platform for internal tools, intended to replace low-code tools such as Microsoft Power Apps with small custom apps on one shared platform. The platform provides auth, permissions, audit logging, approvals and PII masking; each app lives in its own folder and only builds on the platform.

The platform security layer is in place; no business apps exist yet. Rules for contributors (human or agent) are in [AGENTS.md](AGENTS.md); decisions are in [.agents/decisions/](.agents/decisions/).

## Layout

| Path                     | What                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------- |
| `server/`                | NestJS API. Platform code in `server/src/platform/`, apps in `server/src/apps/<name>/` |
| `server/prisma/`         | Prisma multi-file schema (`schema/`, one `<app>.prisma` per app) and migrations        |
| `client/`                | Next.js UI. Platform code in `client/lib/`, apps in `client/app/<name>/`               |
| `client/app/(platform)/` | Platform pages (audit log), platform-owned, not an app                                 |
| `tools/`                 | Tests for the harness itself (ESLint boundary and platform rules, with fixtures)       |
| `compose.yaml`           | Postgres 16, server and client for local development                                   |

## Run it

Just running the app needs only Docker with Compose:

```sh
docker compose up --build
```

Node 24 (`.nvmrc`) and pnpm (`corepack enable`) are only needed for development and tests:

```sh
pnpm install
cp .env.example .env   # optional; the defaults are local-only
pnpm dev               # same as docker compose up --build
```

- Client: http://localhost:3000
- Server: http://localhost:3001/health → `{"status":"ok","db":"up"}`

Use the "Acting as" switcher in the page header to pick a seed user (mock login). The audit log at http://localhost:3000/audit works for the auditor and shows a refusal for every other role.

The server applies migrations on startup. Source folders are mounted into the containers, so edits hot-reload.

## Test it

```sh
pnpm lint       # ESLint (incl. app-boundary rules) + Prettier check
pnpm build      # server (prisma generate + nest build) and client (next build)
pnpm test       # unit tests: boundary-rule tests, server, client
pnpm test:api   # supertest API tests against the platform_test database
```

`pnpm test:api` needs Postgres running (`docker compose up -d postgres`). It applies migrations to `platform_test` first; override the URL with `TEST_DATABASE_URL`.

CI (`.github/workflows/ci.yml`, job `ci`) runs install, lint, build, unit tests and API tests against a Postgres 16 service on every PR to `main`.

## Security surface

| Area                        | What exists                                                                                                                                                  | Enforcement                                                                                                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Auth (ADR 0001)             | `PlatformAuth` behind `PLATFORM_AUTH`; mock login via `X-User-Id` with seed users requester, approver, requester+approver, auditor, viewer; unknown id → 401 | Server refuses to start with mock auth/payments when `NODE_ENV=production` (test)                                                                                                                |
| Permissions (ADR 0002)      | `@RequirePermission('<app>.<resource>.<action>')`, `@Public()`, global deny-by-default guard; permissions granted to roles                                   | Convention test over every controller handler + deliberate-violation proof                                                                                                                       |
| Audit (ADR 0003)            | Append-only `AuditEntry`; `AuditService.record(tx, …)` in the mutation's transaction; `GET /audit` + `/audit` page (auditor only)                            | DB trigger rejects UPDATE/DELETE/TRUNCATE (test); `asUser` tripwire fails unaudited mutations. **Caveat:** the app connects as the table owner and could still drop the trigger (see Next steps) |
| Approvals (ADR 0004)        | `ApprovalsService`: `registerHandler`, `submit`, `approve`, `reject`; `POST /approvals/:id/approve` and `/reject`                                            | Tests: pending has no effect, self-approval 403, effect once in one transaction, double-approve 409, all transitions audited                                                                     |
| PII (ADR 0005)              | `maskEmail`, `maskCard`, `@RevealEndpoint()`, audited `PiiRevealService.reveal()`; `GET /audit` masks snapshots                                              | Unit tests; `asUser` tripwire fails responses with unmasked email/card                                                                                                                           |
| Money & payments (ADR 0006) | Zod `MoneySchema` (integer cents + ISO 4217); `PaymentsAdapter` + idempotent mock adapter                                                                    | Tests; lint rule `platform/no-payment-sdk-import`                                                                                                                                                |
| Input validation            | `ZodValidationPipe`                                                                                                                                          | Lint rule `platform/validated-request-input`                                                                                                                                                     |
| App isolation (ADR 0007)    | Boundary lint; `client/lib/registry.ts` drives header navigation                                                                                             | Lint fixtures; CODEOWNERS + ruleset                                                                                                                                                              |

## Next steps

- **Real SSO** (Entra ID / Okta) replacing `MockAuthService` behind `PLATFORM_AUTH`.
- **Role-assignment UI** (roles are currently fixed seed users).
- **Notifications** (e.g. approvers notified of pending requests).
- **Access reviews** (periodic review of who holds which role).
- **Rate limiting** on the API.
- **Production deployment** (no production configuration exists yet; mocks refuse to start in production).
- **Monitoring** and alerting.
- **Separate database role for the audit table.** The app currently connects as the owner of `audit_entry`, so it could still drop or disable the append-only trigger. The real fix is a separate database role for the application with only INSERT and SELECT on the audit table, with migrations run by a different owner role.
