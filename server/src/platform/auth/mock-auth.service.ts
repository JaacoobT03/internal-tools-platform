import { Injectable, UnauthorizedException } from '@nestjs/common';
import { seedUsers } from './mock-users';
import { PermissionRegistry } from './permission-registry';
import { AuthRequestLike, AuthUser, PlatformAuth } from './platform-auth';
import { Role } from './roles';

export const USER_ID_HEADER = 'x-user-id';

/** Development-only PlatformAuth: trusts the `X-User-Id` header. */
@Injectable()
export class MockAuthService implements PlatformAuth {
  private readonly users = new Map<string, AuthUser>(
    Object.values(seedUsers).map((user) => [
      user.id,
      { ...user, roles: [...user.roles] },
    ]),
  );

  constructor(private readonly registry: PermissionRegistry) {}

  listUsers(): AuthUser[] {
    return [...this.users.values()];
  }

  authenticate(request: AuthRequestLike): AuthUser | null {
    const header = request.headers[USER_ID_HEADER];
    const id = Array.isArray(header) ? header[0] : header;
    if (id === undefined || id === '') return null;
    const user = this.users.get(id);
    if (!user) throw new UnauthorizedException('Unknown user');
    return user;
  }

  hasRole(user: AuthUser, role: Role): boolean {
    return user.roles.includes(role);
  }

  hasPermission(user: AuthUser, permission: string): boolean {
    return this.registry
      .rolesFor(permission)
      .some((role) => user.roles.includes(role));
  }

  permissionsOf(user: AuthUser): string[] {
    return this.registry.permissionsFor(user.roles);
  }
}
