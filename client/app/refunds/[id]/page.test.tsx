import { act, fireEvent, render, screen } from '@testing-library/react';
import { setCurrentUserId } from '../../../lib/session';
import RefundDetailPage from './page';
import { mockApi, refund, session, users } from '../test-utils';

const ID = '11111111-1111-4111-8111-111111111111';
jest.mock('next/navigation', () => ({ useParams: () => ({ id: ID }) }));

const APPROVER = [
  'refunds.refund.read',
  'refunds.refund.decide',
  'refunds.customer-email.reveal',
];

describe('Refund detail', () => {
  afterEach(() => window.localStorage.clear());

  it('lets an approver approve a pending refund', async () => {
    setCurrentUserId('u-approver');
    mockApi({
      'GET /auth/users': { body: users },
      'GET /auth/me': { body: session('u-approver', APPROVER) },
      [`GET /refunds/${ID}`]: { body: refund() },
      [`POST /refunds/${ID}/approve`]: {
        body: refund({ status: 'paid', payoutId: 'mock_re_1' }),
      },
    });
    render(<RefundDetailPage />);
    expect(await screen.findByText('Pending approval')).toBeInTheDocument();
    expect(screen.getByText('j***@example.com')).toBeInTheDocument();
    expect(screen.getByText('**** 4242')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    expect(await screen.findByText('Paid')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
  });

  it('reveals the email for an approver', async () => {
    setCurrentUserId('u-approver');
    mockApi({
      'GET /auth/users': { body: users },
      'GET /auth/me': { body: session('u-approver', APPROVER) },
      [`GET /refunds/${ID}`]: { body: refund({ status: 'paid' }) },
      [`POST /refunds/${ID}/reveal-email`]: {
        body: { customerEmail: 'jane.doe@example.com' },
      },
    });
    render(<RefundDetailPage />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Reveal email' }),
    );
    expect(await screen.findByText('jane.doe@example.com')).toBeInTheDocument();
  });

  it('clears a revealed email when the user changes', async () => {
    setCurrentUserId('u-approver');
    mockApi({
      'GET /auth/users': { body: users },
      'GET /auth/me': { body: session('u-approver', APPROVER) },
      [`GET /refunds/${ID}`]: { body: refund({ status: 'paid' }) },
      [`POST /refunds/${ID}/reveal-email`]: {
        body: { customerEmail: 'jane.doe@example.com' },
      },
    });
    render(<RefundDetailPage />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Reveal email' }),
    );
    expect(await screen.findByText('jane.doe@example.com')).toBeInTheDocument();

    act(() => setCurrentUserId('u-viewer'));
    act(() => setCurrentUserId('u-approver'));
    expect(screen.queryByText('jane.doe@example.com')).toBeNull();
    expect(
      await screen.findByRole('button', { name: 'Reveal email' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('jane.doe@example.com')).toBeNull();
  });

  it('shows the 403 when the requester tries to approve their own refund', async () => {
    setCurrentUserId('u-approver');
    mockApi({
      'GET /auth/users': { body: users },
      'GET /auth/me': { body: session('u-approver', APPROVER) },
      [`GET /refunds/${ID}`]: { body: refund() },
      [`POST /refunds/${ID}/approve`]: {
        status: 403,
        body: { message: 'You cannot decide your own request' },
      },
    });
    render(<RefundDetailPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You cannot decide your own request',
    );
    expect(screen.getByText('Pending approval')).toBeInTheDocument();
  });

  it('shows a viewer the masked refund without any actions', async () => {
    setCurrentUserId('u-viewer');
    mockApi({
      'GET /auth/users': { body: users },
      'GET /auth/me': { body: session('u-viewer', ['refunds.refund.read']) },
      [`GET /refunds/${ID}`]: { body: refund() },
    });
    render(<RefundDetailPage />);
    expect(await screen.findByText('j***@example.com')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
