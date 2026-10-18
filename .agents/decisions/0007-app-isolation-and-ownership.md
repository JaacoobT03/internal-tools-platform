# 0007 — App isolation and ownership

## Status

Accepted. Enforcement: planned.

## Context

Many internal apps will be built on one platform, often by agents. Without boundaries, apps couple to each other and app changes drift into shared platform code.

## Decision

- Server app code lives in `server/src/apps/<name>/`; client app code in `client/app/<name>/`.
- Apps import platform code only (`server/src/platform/`, `client/lib/`), never another app.
- App PRs must not modify platform or harness code.
- Platform and harness code are owned via `CODEOWNERS`.
- `main` is protected: PR required, code owner review required, CI must pass.

## Consequences

- Planned enforcement: ESLint boundary rules banning cross-app imports.
- No CI job tries to detect whether a PR is app-scoped; the CODEOWNERS review requirement is the mechanism that keeps platform changes reviewed.
- Shared logic needed by several apps is moved into platform in a separate, code-owner-reviewed PR.
