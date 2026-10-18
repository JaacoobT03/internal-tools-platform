import { fireEvent, render, screen } from '@testing-library/react';
import { setCurrentUserId } from '../../../lib/session';
import NewRefundPage from './page';
import { mockApi, refund } from '../test-utils';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

function fill(values: Record<string, string>) {
  for (const [label, value] of Object.entries(values)) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
}

describe('New refund form', () => {
  afterEach(() => {
    window.localStorage.clear();
    push.mockReset();
  });

  it('posts integer cents in EUR and opens the created refund', async () => {
    setCurrentUserId('u-requester');
    let sent: unknown;
    mockApi({
      'POST /refunds': (init) => {
        sent = JSON.parse(String(init?.body));
        return { status: 201, body: refund({ id: 'new-id' }) };
      },
    });
    render(<NewRefundPage />);
    fill({
      'Original payment reference': 'pay_1001',
      'Customer email': 'jane.doe@example.com',
      'Card last 4 digits': '4242',
      'Amount (EUR)': '500.01',
      Reason: 'Item arrived damaged',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create refund' }));
    await screen.findByText('Creating…');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sent).toEqual({
      paymentReference: 'pay_1001',
      customerEmail: 'jane.doe@example.com',
      cardLast4: '4242',
      amount: { amountCents: 50001, currency: 'EUR' },
      reason: 'Item arrived damaged',
    });
    expect(push).toHaveBeenCalledWith('/refunds/new-id');
    expect(screen.getByRole('button', { name: 'Create refund' })).toBeEnabled();
    expect(screen.getByLabelText('Amount (EUR)')).toHaveValue('');
  });

  it('refuses an invalid amount before sending', () => {
    setCurrentUserId('u-requester');
    const fetchMock = mockApi({});
    render(<NewRefundPage />);
    fill({
      'Original payment reference': 'pay_1001',
      'Customer email': 'jane.doe@example.com',
      'Card last 4 digits': '4242',
      'Amount (EUR)': '12.345',
      Reason: 'x',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create refund' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Amount');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the server refusal (e.g. 403 for a viewer)', async () => {
    setCurrentUserId('u-viewer');
    mockApi({
      'POST /refunds': {
        status: 403,
        body: { message: 'Missing permission refunds.refund.create' },
      },
    });
    render(<NewRefundPage />);
    fill({
      'Original payment reference': 'pay_1001',
      'Customer email': 'jane.doe@example.com',
      'Card last 4 digits': '4242',
      'Amount (EUR)': '10',
      Reason: 'x',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create refund' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Missing permission refunds.refund.create',
    );
  });
});
