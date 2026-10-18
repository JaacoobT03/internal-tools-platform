# 0008 — Definition of Done and new technology

## Status

Accepted. Enforcement: planned (CI) / written rule (new tech).

## Context

Agents can produce a lot of code quickly. Without a fixed workflow, behavior drifts from intent, tests get written after the fact (or not at all), and new dependencies accumulate.

## Decision

- Workflow: spec (from `.agents/specs/_template.md`) → failing test → implementation.
- Done means: lint, build and tests are green locally and in CI; required tests (ADR 0004, 0005) are present; no platform files changed in an app PR.
- Ask before introducing new foundational technology (framework, database, ORM, auth provider, queue, hosting, etc.).

## Consequences

- CI lint/build/test steps are added once code lands; until then the CI job is a placeholder so the required check exists.
- New-tech requests go to the platform owner before any code is written.
