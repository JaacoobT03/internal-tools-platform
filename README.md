# internal-tools-platform

A governance-first platform for internal tools, intended to replace low-code tools such as Microsoft Power Apps with small custom apps on one shared platform. The platform provides auth, permissions, audit logging, approvals and PII masking; each app lives in its own folder and only builds on the platform.

No business apps exist yet. Rules for contributors (human or agent) are in [AGENTS.md](AGENTS.md); decisions are in [.agents/decisions/](.agents/decisions/).

## Layout

| Path             | What                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------- |
| `server/`        | NestJS API. Platform code in `server/src/platform/`, apps in `server/src/apps/<name>/` |
| `server/prisma/` | Prisma multi-file schema (`schema/`, one `<app>.prisma` per app) and migrations        |
| `client/`        | Next.js UI. Platform code in `client/lib/`, apps in `client/app/<name>/`               |
| `tools/`         | Tests for the harness itself (ESLint boundary rules)                                   |
| `compose.yaml`   | Postgres 16, server and client for local development                                   |

## Run it

Requirements: Docker with Compose, Node 24 (`.nvmrc`) and pnpm (`corepack enable`).

```sh
pnpm install
cp .env.example .env   # optional; the defaults are local-only
pnpm dev               # docker compose up --build
```

- Client: http://localhost:3000
- Server: http://localhost:3001/health → `{"status":"ok","db":"up"}`

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
