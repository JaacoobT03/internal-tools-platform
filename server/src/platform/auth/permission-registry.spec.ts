import { PermissionRegistry } from './permission-registry';

describe('PermissionRegistry', () => {
  it('grants platform.audit.read to the auditor role only', () => {
    expect(new PermissionRegistry().rolesFor('platform.audit.read')).toEqual([
      'auditor',
    ]);
  });

  it('lets apps grant their own permissions', () => {
    const registry = new PermissionRegistry();
    registry.grant('refunds.refund.create', ['requester']);
    expect(registry.permissionsFor(['requester'])).toContain(
      'refunds.refund.create',
    );
    expect(registry.permissionsFor(['viewer'])).not.toContain(
      'refunds.refund.create',
    );
  });

  it('refuses app grants of platform permissions', () => {
    expect(() =>
      new PermissionRegistry().grant('platform.audit.read', ['viewer']),
    ).toThrow(/cannot grant platform permissions/);
  });

  it.each(['refunds', 'Refunds.refund.create', 'a.b'])(
    'rejects malformed permission %s',
    (permission) => {
      expect(() =>
        new PermissionRegistry().grant(permission, ['viewer']),
      ).toThrow(/Invalid permission/);
    },
  );
});
