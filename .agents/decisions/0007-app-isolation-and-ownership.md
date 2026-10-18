# 0007 — App isolation and ownership

## Status

Accepted. Enforcement: boundary lint and code owner review enforced; see AGENTS.md table.

## Context

Many internal apps will be built on one platform, often by agents. Without boundaries, apps couple to each other and app changes drift into shared platform code.

## Decision

- Server app code lives in `server/src/apps/<name>/`; client app code in `client/app/<name>/`.
- Apps import platform code only (`server/src/platform/`, `client/lib/`), never another app.
- App PRs must not modify platform or harness code, with one exception: an app PR may add its own Prisma schema file (`server/prisma/schema/<app>.prisma`), its own migrations (`server/prisma/migrations/`), and a one-line registration of its module in `server/src/app.module.ts`. Nothing else outside its app folders. These changes are reviewed by the platform owner via CODEOWNERS.
- Platform and harness code are owned via `CODEOWNERS`.
- `main` is protected by the GitHub ruleset `protect-main`: PR required, code owner review required, status check `ci` required.

## Consequences

- Enforced: ESLint boundary rules (`eslint-plugin-boundaries` in `eslint.config.mjs`) reject app → other app and platform → app imports; `tools/eslint-boundaries.test.cjs` proves they fail on deliberate violations.
- The repo admin can bypass `protect-main` in this one-person repo.
- No CI job tries to detect whether a PR is app-scoped; the CODEOWNERS review requirement is the mechanism that keeps platform changes reviewed.
- Shared logic needed by several apps is moved into platform in a separate, code-owner-reviewed PR.
