import { ForbiddenException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { MockAuthService } from '../auth/mock-auth.service';
import { seedUsers } from '../auth/mock-users';
import { PermissionRegistry } from '../auth/permission-registry';
import { PrismaService } from '../prisma/prisma.service';
import { PiiRevealService } from './pii-reveal.service';

describe('PiiRevealService', () => {
  const registry = new PermissionRegistry();
  registry.grant('crm.customer.reveal-email', ['approver']);
  const record = jest.fn();
  const tx = { marker: 'tx' };
  const prisma = {
    $transaction: (fn: (t: unknown) => Promise<unknown>) => fn(tx),
  } as unknown as PrismaService;
  const service = new PiiRevealService(
    new MockAuthService(registry),
    { record } as unknown as AuditService,
    prisma,
  );
  const target = {
    permission: 'crm.customer.reveal-email',
    entity: 'crm.Customer',
    entityId: 'c-1',
    field: 'email',
  };

  beforeEach(() => record.mockReset());

  it('returns the value and audits the reveal in the same transaction', async () => {
    const load = jest.fn().mockResolvedValue('jane@example.com');
    await expect(
      service.reveal(
        { ...seedUsers.approver, roles: ['approver'] },
        target,
        load,
      ),
    ).resolves.toBe('jane@example.com');
    expect(load).toHaveBeenCalledWith(tx);
    expect(record).toHaveBeenCalledWith(tx, {
      actor: 'u-approver',
      entity: 'crm.Customer',
      entityId: 'c-1',
      action: 'pii.reveal',
      after: { field: 'email', permission: 'crm.customer.reveal-email' },
    });
    expect(JSON.stringify(record.mock.calls)).not.toContain('jane@');
  });

  it('refuses users without the reveal permission and audits nothing', async () => {
    const load = jest.fn();
    await expect(
      service.reveal({ ...seedUsers.viewer, roles: ['viewer'] }, target, load),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(load).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('does not return the value if the audit write fails', async () => {
    record.mockRejectedValue(new Error('db down'));
    await expect(
      service.reveal(
        { ...seedUsers.approver, roles: ['approver'] },
        target,
        () => Promise.resolve('jane@example.com'),
      ),
    ).rejects.toThrow('db down');
  });
});
