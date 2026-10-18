## Summary

<!-- What changes and why. -->

## Checklist

- [ ] **Spec link:** <!-- .agents/specs/<name>.md, or "n/a (platform/harness change)" -->
- [ ] **Roles and permissions:** every new endpoint has `@RequirePermission()` or `@Public()`; roles listed in the spec
- [ ] **Audited actions:** every mutation writes an append-only audit entry (who/what/when/before/after)
- [ ] **Personal data fields:** email/card fields masked by default; reveal requires permission and writes an audit entry
- [ ] **Approval rules:** thresholds and approver role documented; self-approval refused
- [ ] **Required tests:** self-approval → 403, above-threshold has no effect until approved, no unmasked PII outside reveal + reveal audited (see `.agents/skills/new-internal-app/SKILL.md`)
- [ ] **Screenshots:** UI changes attached (or "no UI change")
- [ ] App PRs only: nothing changed outside `server/src/apps/<name>/`, `client/app/<name>/`, `server/prisma/schema/<name>.prisma`, its migrations, one module line in `server/src/app.module.ts`, and one entry in `client/lib/registry.ts`
