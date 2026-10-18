# API tests

`pnpm test:api` runs `*.api-spec.ts` against the `platform_test` database
(`global-setup.ts` runs `prisma migrate deploy` first; override the URL with
`TEST_DATABASE_URL`).

## Where tests live

- Platform API tests: `server/test/*.api-spec.ts`.
- App API tests: `server/src/apps/<name>/test/<name>.api-spec.ts`, inside the
  app folder so an app PR touches no harness files. `jest-api.json` picks up
  every `*.api-spec.ts`; `tsconfig.build.json` excludes them from the server
  build and the unit-test config never runs them. `tools/app-api-tests.test.cjs`
  guards all three.

## Helpers (`helpers/`)

| Helper               | What it does                                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `createTestApp()`    | Boots the real `AppModule` (plus optional test-only modules) and listens on an ephemeral `127.0.0.1` port.       |
| `asUser(app, user)`  | supertest wrapper that sends `X-User-Id` for a seed user (`'requester'`, `'auditor'`, …) and runs the tripwires. |
| `resetSeed()`        | Empties every data table except the audit log (see below). Seed users live in code, so nothing is re-inserted.   |
| `undeclaredHandlers` | Permission-convention scan: every controller handler needs `@RequirePermission()` or `@Public()`.                |

### Tripwires

Every request made through `asUser()` fails the test (rejects with
`TripwireError`) when:

1. **PII:** the response body contains an unmasked email address or a full,
   Luhn-valid card number, unless the handler is a declared
   `@RevealEndpoint()` (it sends `X-Pii-Reveal: true`).
2. **Audit:** a POST/PUT/PATCH/DELETE answers 2xx but the audit table has no
   new row.

They apply automatically to every app test that uses `asUser()`. The audit
tripwire counts rows, so it cannot tell which mutation wrote an entry; keep
app tests sequential (Jest's default within a file) and still assert the
before/after content of your own entries.

## Resetting without weakening the audit trigger

The audit table (`audit_entry`) is append-only: a trigger rejects `UPDATE`,
`DELETE` and `TRUNCATE`. The reset must not disable, drop or bypass it, so:

- `resetSeed()` truncates only the other tables in `public`
  (`audit_entry` and `_prisma_migrations` are excluded) and never uses
  `CASCADE`, which could reach the audit table through a foreign key.
- Audit rows accumulate across runs. Tests therefore scope audit assertions
  to entity ids they created themselves (random UUIDs), never to global
  counts or "the latest entry".
- For a clean audit table, recreate the test database:
  `docker compose exec postgres dropdb -U platform platform_test` and
  `createdb -U platform platform_test`; the next `pnpm test:api` re-applies
  the migrations. CI starts from a fresh database on every run.

## Test-only fixtures (`fixtures/`)

`fixtures/` holds deliberate violations: a controller without permission
decorators (`undeclared-permission.module.ts`) and endpoints that leak PII or
mutate without auditing (`tripwire-violations.module.ts`). They exist only to
prove the convention scan and the tripwires fail. They are imported only by
specs via `createTestApp(FixtureModule)`, never by `AppModule`; specs assert
their routes return 404 on the real application.
