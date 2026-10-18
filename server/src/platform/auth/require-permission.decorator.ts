import { SetMetadata } from '@nestjs/common';
import { assertPermissionName } from './permission-name';

export const REQUIRED_PERMISSION_KEY = 'requiredPermission';

/**
 * Declares the permission a handler requires (ADR 0002). Every handler needs
 * this or @Public(); the global PermissionGuard refuses handlers with neither.
 */
export const RequirePermission = (permission: string) => {
  assertPermissionName(permission);
  return SetMetadata(REQUIRED_PERMISSION_KEY, permission);
};
