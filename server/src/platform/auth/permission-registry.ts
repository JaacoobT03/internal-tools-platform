import { Injectable } from '@nestjs/common';
import { assertPermissionName } from './permission-name';
import { ROLES, Role } from './roles';

/** Grants owned by the platform. Apps cannot add or change `platform.*` grants. */
const PLATFORM_GRANTS: Record<string, readonly Role[]> = {
  'platform.session.read': ROLES,
  'platform.audit.read': ['auditor'],
  'platform.approvals.decide': ['approver'],
};

/**
 * Maps permissions to roles (ADR 0002: permissions are granted to roles;
 * endpoints check permissions). Apps grant their own `<app>.*` permissions at
 * startup, e.g. in their module constructor:
 *
 *   registry.grant('refunds.refund.create', ['requester']);
 */
@Injectable()
export class PermissionRegistry {
  private readonly grants = new Map<string, Set<Role>>(
    Object.entries(PLATFORM_GRANTS).map(([permission, roles]) => [
      permission,
      new Set(roles),
    ]),
  );

  grant(permission: string, roles: readonly Role[]): void {
    assertPermissionName(permission);
    if (permission.startsWith('platform.')) {
      throw new Error(
        `Apps cannot grant platform permissions (${permission}); platform grants are fixed in PermissionRegistry.`,
      );
    }
    const granted = this.grants.get(permission) ?? new Set<Role>();
    for (const role of roles) {
      if (!ROLES.includes(role)) throw new Error(`Unknown role: ${role}`);
      granted.add(role);
    }
    this.grants.set(permission, granted);
  }

  rolesFor(permission: string): Role[] {
    return [...(this.grants.get(permission) ?? [])];
  }

  permissionsFor(roles: readonly Role[]): string[] {
    return [...this.grants.entries()]
      .filter(([, granted]) => roles.some((role) => granted.has(role)))
      .map(([permission]) => permission)
      .sort();
  }
}
