export const ROLES = ['viewer', 'requester', 'approver', 'auditor'] as const;

export type Role = (typeof ROLES)[number];
