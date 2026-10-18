import { render, screen } from '@testing-library/react';
import { setCurrentUserId } from '../../../lib/session';
import AuditLogPage from './page';

function mockFetch(status: number, body: unknown) {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: () => Promise.resolve(body),
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe('Audit log page', () => {
  afterEach(() => window.localStorage.clear());

  it('shows audit entries to the auditor', async () => {
    setCurrentUserId('u-auditor');
    const fetchMock = mockFetch(200, {
      entries: [
        {
          id: '1',
          actor: 'u-approver',
          entity: 'platform.ApprovalRequest',
          entityId: 'r-1',
          action: 'approval.approved',
          before: { status: 'pending' },
          after: { status: 'approved', email: 'j***@example.com' },
          timestamp: '2026-10-18T12:00:00.000Z',
        },
      ],
    });
    render(<AuditLogPage />);
    expect(await screen.findByText('approval.approved')).toBeInTheDocument();
    expect(screen.getByText('u-approver')).toBeInTheDocument();
    expect(screen.getByText(/j\*\*\*@example.com/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/audit',
      expect.objectContaining({ headers: { 'X-User-Id': 'u-auditor' } }),
    );
  });

  it.each(['u-viewer', 'u-requester', 'u-approver', 'u-requester-approver'])(
    'shows the refusal to %s (403)',
    async (userId) => {
      setCurrentUserId(userId);
      mockFetch(403, { message: 'Forbidden', statusCode: 403 });
      render(<AuditLogPage />);
      expect(await screen.findByRole('alert')).toHaveTextContent(
        /Access refused \(403\)/,
      );
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    },
  );

  it('shows an empty state', async () => {
    setCurrentUserId('u-auditor');
    mockFetch(200, { entries: [] });
    render(<AuditLogPage />);
    expect(
      await screen.findByText('No audit entries yet.'),
    ).toBeInTheDocument();
  });
});
