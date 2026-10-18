# 0003 — Append-only audit log

## Status

Accepted. Enforcement: planned.

## Context

Replacing Power Apps workflows means we must be able to answer "who changed what, when, and from what to what" for every record, and that history must not be editable after the fact.

## Decision

- Every data mutation (create, update, delete) writes an audit entry with: who (actor), what (entity, id, action), when (timestamp), before and after snapshots.
- PII reveals also write an audit entry.
- The audit log is append-only. Entries are never updated or deleted.

## Consequences

- Planned enforcement: the application database user has no UPDATE/DELETE grants on the audit table, and the audit entity/repository exposes no update or delete paths.
- The `auditor` role reads the audit log; nobody edits it.
- Audit writes are part of the same unit of work as the mutation, so a mutation without an audit entry is a bug.
