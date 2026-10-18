type Route = { status?: number; body?: unknown };
export type Routes = Record<string, Route | ((init?: RequestInit) => Route)>;

/** Routes fetch by "METHOD path" (path without the API base URL). */
export function mockApi(routes: Routes) {
  const fetchMock = jest.fn((url: string, init?: RequestInit) => {
    const path = url.replace(/^https?:\/\/[^/]+/, '');
    const key = `${init?.method ?? 'GET'} ${path}`;
    const entry = routes[key];
    const route =
      typeof entry === 'function' ? entry(init) : (entry ?? { status: 404 });
    const status = route.status ?? 200;
    const body = route.body ?? { message: `No mock for ${key}` };
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      statusText: String(status),
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    });
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

export const users = [
  { id: 'u-requester', name: 'Rita Requester', roles: ['requester'] },
  { id: 'u-approver', name: 'Arne Approver', roles: ['approver'] },
  { id: 'u-viewer', name: 'Vic Viewer', roles: ['viewer'] },
];

export const session = (id: string, permissions: string[]) => ({
  user: users.find((u) => u.id === id),
  permissions,
});

export const refund = (overrides: Record<string, unknown> = {}) => ({
  id: '11111111-1111-4111-8111-111111111111',
  paymentReference: 'pay_1001',
  customerEmail: 'j***@example.com',
  cardLast4: '**** 4242',
  amount: { amountCents: 75000, currency: 'EUR' },
  reason: 'Item arrived damaged',
  status: 'pending_approval',
  requestedBy: 'u-requester',
  payoutId: null,
  approvalRequestId: '22222222-2222-4222-8222-222222222222',
  createdAt: '2026-10-18T12:00:00.000Z',
  ...overrides,
});
