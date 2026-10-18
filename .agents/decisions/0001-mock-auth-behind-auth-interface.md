# 0001 — Mock auth behind an auth interface

## Status

Accepted. Enforcement: written rule (replaceability); production refusal of the mock is tested (`server/test/auth.api-spec.ts`).

## Context

Apps need authenticated users and roles from day one, but the organization's SSO provider (Entra ID or Okta) is not yet integrated. Coupling app code to a specific identity provider would force rewrites later.

## Decision

- The platform defines its own auth interface (current user, roles, permission checks).
- The first implementation is a mock login with a role switcher, for development and demos.
- Roles: `viewer`, `requester`, `approver`, `auditor`.
- Apps depend only on the platform auth interface, never on the mock or a provider SDK.

## Consequences

- Real SSO (Entra/Okta) replaces the mock implementation later without touching app code.
- The mock must never be reachable in production; the swap is a platform change reviewed by code owners.
- Tests can switch roles cheaply to exercise permission and approval rules.
- Implemented: `PlatformAuth` behind the `PLATFORM_AUTH` token; `MockAuthService` reads `X-User-Id` (unknown id → 401) and refuses to bootstrap with `NODE_ENV=production`. The client user switcher lives in `client/lib/header.tsx`.
