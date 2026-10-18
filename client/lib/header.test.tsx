import { fireEvent, render, screen, within } from '@testing-library/react';
import { Header } from './header';
import { getCurrentUserId } from './session';

const users = [
  { id: 'u-requester', name: 'Rita Requester', roles: ['requester'] },
  { id: 'u-auditor', name: 'Aud Auditor', roles: ['auditor'] },
  { id: 'u-viewer', name: 'Vic Viewer', roles: ['viewer'] },
];
const permissions: Record<string, string[]> = {
  'u-requester': ['platform.session.read'],
  'u-auditor': ['platform.audit.read', 'platform.session.read'],
  'u-viewer': ['platform.session.read'],
};

function respond(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

beforeEach(() => {
  global.fetch = jest.fn((url: string, init?: RequestInit) => {
    if (url.endsWith('/auth/users')) return respond(users);
    const userId = (init?.headers as Record<string, string>)['X-User-Id'];
    const user = users.find((u) => u.id === userId);
    return respond({ user, permissions: permissions[userId] });
  }) as unknown as typeof fetch;
});
afterEach(() => window.localStorage.clear());

describe('Header', () => {
  it('offers every seed user and defaults to the viewer', async () => {
    render(<Header />);
    const select = await screen.findByRole('combobox', { name: 'Acting as' });
    expect(
      await within(select).findByRole('option', { name: /Aud Auditor/ }),
    ).toBeInTheDocument();
    expect(within(select).getAllByRole('option')).toHaveLength(3);
    expect(select).toHaveValue('u-viewer');
  });

  it('switching user updates the session and the registry nav', async () => {
    render(<Header />);
    const select = await screen.findByRole('combobox', { name: 'Acting as' });
    await within(select).findByRole('option', { name: /Aud Auditor/ });
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).queryByRole('link')).not.toBeInTheDocument();

    fireEvent.change(select, { target: { value: 'u-auditor' } });
    expect(getCurrentUserId()).toBe('u-auditor');
    expect(
      await within(nav).findByRole('link', { name: 'Audit log' }),
    ).toHaveAttribute('href', '/audit');

    fireEvent.change(select, { target: { value: 'u-requester' } });
    expect(select).toHaveValue('u-requester');
    await screen.findByDisplayValue(/Rita Requester/);
    expect(
      within(nav).queryByRole('link', { name: 'Audit log' }),
    ).not.toBeInTheDocument();
  });

  it('reports an unreachable API', async () => {
    global.fetch = jest.fn(() =>
      Promise.reject(new Error('down')),
    ) as unknown as typeof fetch;
    render(<Header />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'API unavailable',
    );
  });
});
