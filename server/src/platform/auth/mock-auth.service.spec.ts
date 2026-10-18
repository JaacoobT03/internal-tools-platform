import { UnauthorizedException } from '@nestjs/common';
import { MockAuthService } from './mock-auth.service';
import { seedUsers } from './mock-users';
import { PermissionRegistry } from './permission-registry';

describe('MockAuthService', () => {
  const auth = new MockAuthService(new PermissionRegistry());

  it('offers the five seed users, incl. one requester+approver', () => {
    expect(auth.listUsers().map((user) => user.roles)).toEqual([
      ['requester'],
      ['approver'],
      ['requester', 'approver'],
      ['auditor'],
      ['viewer'],
    ]);
  });

  it('resolves the user from X-User-Id', () => {
    expect(
      auth.authenticate({ headers: { 'x-user-id': seedUsers.auditor.id } }),
    ).toMatchObject({ id: 'u-auditor', roles: ['auditor'] });
  });

  it('returns null without the header', () => {
    expect(auth.authenticate({ headers: {} })).toBeNull();
  });

  it('rejects an unknown user id with 401', () => {
    expect(() =>
      auth.authenticate({ headers: { 'x-user-id': 'u-nobody' } }),
    ).toThrow(UnauthorizedException);
  });

  it('checks permissions through role grants', () => {
    const auditor = auth.authenticate({
      headers: { 'x-user-id': seedUsers.auditor.id },
    })!;
    const viewer = auth.authenticate({
      headers: { 'x-user-id': seedUsers.viewer.id },
    })!;
    expect(auth.hasPermission(auditor, 'platform.audit.read')).toBe(true);
    expect(auth.hasPermission(viewer, 'platform.audit.read')).toBe(false);
    expect(auth.hasRole(viewer, 'viewer')).toBe(true);
  });
});
