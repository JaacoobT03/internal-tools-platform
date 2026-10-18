const PERMISSION_PATTERN =
  /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/;

/** Permissions are named `<app>.<resource>.<action>` (ADR 0002). */
export function assertPermissionName(permission: string): void {
  if (!PERMISSION_PATTERN.test(permission)) {
    throw new Error(
      `Invalid permission "${permission}": expected <app>.<resource>.<action> (lowercase, e.g. refunds.refund.approve).`,
    );
  }
}
