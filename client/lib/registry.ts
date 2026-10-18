// Header navigation. Each entry is shown only to users holding its
// `requiredPermission`; the server still enforces the permission on every
// endpoint, so hiding a link is convenience, not security.

export interface RegistryEntry {
  name: string;
  path: string;
  requiredPermission: string;
}

export const PERMISSION_PATTERN =
  /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/;

/** Platform pages under client/app/(platform)/. */
export const platformPages: readonly RegistryEntry[] = [
  {
    name: 'Audit log',
    path: '/audit',
    requiredPermission: 'platform.audit.read',
  },
];

/**
 * Apps under client/app/<name>/. An app PR may add exactly one entry here
 * (AGENTS.md rule 7, ADR 0007).
 */
export const apps: readonly RegistryEntry[] = [];

export const registry: readonly RegistryEntry[] = [...platformPages, ...apps];

export function visibleEntries(
  permissions: readonly string[],
  entries: readonly RegistryEntry[] = registry,
): RegistryEntry[] {
  return entries.filter((entry) =>
    permissions.includes(entry.requiredPermission),
  );
}
