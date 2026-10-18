# 0003 — Append-only audit log

## Status

Accepted. Enforcement: enforced (DB trigger + `asUser` audit tripwire); separate DB role still planned.

## Context

Replacing Power Apps workflows means we must be able to answer "who changed what, when, and from what to what" for every record, and that history must not be editable after the fact.

## Decision

- Every data mutation (create, update, delete) writes an audit entry with: who (actor), what (entity, id, action), when (timestamp), before and after snapshots.
- PII reveals also write an audit entry.
- The audit log is append-only. Entries are never updated or deleted.

## Consequences

- Enforced: a trigger on `audit_entry` rejects UPDATE, DELETE and TRUNCATE (tested), `AuditService` exposes no update or delete paths, and the `asUser` API-test tripwire fails a test when a successful mutation writes no audit entry.
- Gap: the application connects as the table owner, which could drop the trigger. Planned: a separate database role with only INSERT/SELECT on the audit table.
- The `auditor` role reads the audit log; nobody edits it.
- Audit writes are part of the same unit of work as the mutation, so a mutation without an audit entry is a bug.
