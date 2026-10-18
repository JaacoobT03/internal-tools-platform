import { Role } from './roles';

export interface AuthUser {
  id: string;
  name: string;
  roles: Role[];
}

export interface AuthRequestLike {
  headers: Record<string, string | string[] | undefined>;
}

/**
 * The platform's auth interface (ADR 0001). Apps depend only on this, via the
 * PLATFORM_AUTH token and the @CurrentUser() decorator, never on the mock or a
 * provider SDK. Real SSO replaces the implementation without app changes.
 */
export interface PlatformAuth {
  /**
   * Resolves the current user of a request. Returns null when the request
   * carries no credentials; throws UnauthorizedException for invalid ones.
   */
  authenticate(request: AuthRequestLike): AuthUser | null;
  hasRole(user: AuthUser, role: Role): boolean;
  hasPermission(user: AuthUser, permission: string): boolean;
  permissionsOf(user: AuthUser): string[];
}

export const PLATFORM_AUTH = Symbol('PLATFORM_AUTH');
