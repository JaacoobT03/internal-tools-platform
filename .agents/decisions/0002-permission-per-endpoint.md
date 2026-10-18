# 0002 — Permission per endpoint

## Status

Accepted. Enforcement: planned.

## Context

Internal tools handle sensitive operations (refunds, customer data). An endpoint that forgets an authorization check is a silent security hole, and reviewers miss such omissions.

## Decision

- Every endpoint declares a required permission via `@RequirePermission('<app>.<resource>.<action>')`.
- Endpoints without authorization must be explicitly marked `@Public()`, and belong to a short, reviewed public allowlist (e.g. health check, login).
- Permissions are granted to roles; endpoints check permissions, not role names.

## Consequences

- Planned enforcement: a NestJS convention test scans all controllers and fails if any handler lacks `@RequirePermission()` or `@Public()`.
- Adding a public endpoint is a visible, reviewable change.
- Until the convention test exists, this rule is enforced only by review.
