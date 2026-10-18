import { AuthUser } from './platform-auth';

/**
 * Seed users of the mock auth (ADR 0001). Selected via the `X-User-Id`
 * header; the client header has a switcher for them.
 */
export const seedUsers = {
  requester: {
    id: 'u-requester',
    name: 'Rita Requester',
    roles: ['requester'],
  },
  approver: { id: 'u-approver', name: 'Arne Approver', roles: ['approver'] },
  requesterApprover: {
    id: 'u-requester-approver',
    name: 'Bea Both',
    roles: ['requester', 'approver'],
  },
  auditor: { id: 'u-auditor', name: 'Aud Auditor', roles: ['auditor'] },
  viewer: { id: 'u-viewer', name: 'Vic Viewer', roles: ['viewer'] },
} as const satisfies Record<string, AuthUser>;

export type SeedUserKey = keyof typeof seedUsers;
