import { fireEvent, render, screen, within } from '@testing-library/react';
import { setCurrentUserId } from '../../lib/session';
import RefundsPage from './page';
import { mockApi, refund, session, users } from './test-utils';

const READ = 'refunds.refund.read';

describe('Refunds list', () => {
  afterEach(() => window.localStorage.clear());

  it('lists refunds masked, with requester names, and filters by status', async () => {
    setCurrentUserId('u-viewer');
    const fetchMock = mockApi({
      'GET /auth/users': { body: users },
      'GET /auth/me': { body: session('u-viewer', [READ]) },
      'GET /refunds': {
        body: [
          refund(),
          refund({
            id: 'r2',
            status: 'paid',
            amount: { amountCents: 1999, currency: 'EUR' },
          }),
        ],
      },
      'GET /refunds?status=paid': {
        body: [refund({ id: 'r2', status: 'paid' })],
      },
    });
    render(<RefundsPage />);
    const rows = await screen.findAllByRole('row');
    expect(rows).toHaveLength(3);
    const first = within(rows[1]);
    expect(first.getByText('j***@example.com')).toBeInTheDocument();
    expect(first.getByText('EUR 750.00')).toBeInTheDocument();
    expect(first.getByText('Pending approval')).toBeInTheDocument();
    expect(first.getByText('Rita Requester')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'New refund' })).toBeNull();

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'paid' },
    });
    expect(await screen.findAllByRole('row')).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/refunds?status=paid',
      expect.anything(),
    );
  });

  it('offers "New refund" to users with the create permission', async () => {
    setCurrentUserId('u-requester');
    mockApi({
      'GET /auth/users': { body: users },
      'GET /auth/me': {
        body: session('u-requester', [READ, 'refunds.refund.create']),
      },
      'GET /refunds': { body: [] },
    });
    render(<RefundsPage />);
    expect(await screen.findByText('No refunds yet.')).toBeInTheDocument();
    expect(
      await screen.findByRole('link', { name: 'New refund' }),
    ).toHaveAttribute('href', '/refunds/new');
  });

  it('shows the refusal for a user without access', async () => {
    setCurrentUserId('u-nobody');
    mockApi({
      'GET /auth/users': { body: users },
      'GET /auth/me': { status: 401, body: { message: 'Unknown user' } },
      'GET /refunds': { status: 403, body: { message: 'Forbidden' } },
    });
    render(<RefundsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('403');
  });
});
