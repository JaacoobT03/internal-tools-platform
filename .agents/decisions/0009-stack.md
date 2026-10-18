# 0009 — Stack

## Status

Accepted (approved by the platform owner). Enforcement: written rule; changes need a new ADR (ADR 0008).

## Context

The platform needs a concrete, boring stack that agents and humans can work in consistently, with a real database in tests and mechanical enforcement through lint.

## Decision

- **Monorepo:** pnpm workspaces (`client/`, `server/`); Node 24 LTS (`.nvmrc`), pnpm pinned via `packageManager`.
- **Client:** Next.js (App Router), TypeScript. Platform code in `client/lib/`, apps in `client/app/<name>/`.
- **Server:** NestJS, TypeScript. Platform code in `server/src/platform/`, apps in `server/src/apps/<name>/`; `server/src/app.module.ts` is the composition root.
- **Database:** Postgres 16 via Docker Compose (`compose.yaml`).
- **ORM/migrations:** Prisma 7 with `@prisma/adapter-pg`, multi-file schema in `server/prisma/schema/` (one `<app>.prisma` per app), migrations in `server/prisma/migrations/`.
- **Validation:** Zod (approved by the platform owner) for request input (`ZodValidationPipe`) and the money schema.
- **Tests:** Jest for unit tests; supertest API tests against a real Postgres (`platform_test` database).
- **Lint/format:** ESLint flat config (`eslint.config.mjs`, incl. `eslint-config-next`, `typescript-eslint`, `eslint-plugin-boundaries`, local platform rules in `tools/eslint-rules/`) + Prettier.

## Consequences

- `pnpm dev` runs everything through `docker compose up --build`.
- Versions are pinned to current stable majors; newer majors (e.g. Prisma 8) need an explicit upgrade decision.
- Any further foundational technology requires asking first (ADR 0008).
