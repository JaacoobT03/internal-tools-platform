'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ApiError, apiGet } from '../../lib/api';
import { useCurrentUserId } from '../../lib/session';
import {
  formatDate,
  formatEur,
  type Refund,
  type RefundStatus,
  STATUS_LABELS,
} from './format';
import { useRefundsContext } from './use-refunds-context';

type State =
  | { kind: 'loading' }
  | { kind: 'loaded'; refunds: Refund[] }
  | { kind: 'error'; message: string };

export default function RefundsPage() {
  const userId = useCurrentUserId();
  const { can, nameOf } = useRefundsContext(userId);
  const [status, setStatus] = useState<RefundStatus | ''>('');
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const query = status ? `?status=${status}` : '';
    apiGet<Refund[]>(`/refunds${query}`, userId)
      .then((refunds) => !cancelled && setState({ kind: 'loaded', refunds }))
      .catch((error: unknown) => {
        if (cancelled) return;
        const message =
          error instanceof ApiError
            ? `Refused (${error.status}): ${error.message}`
            : 'Could not load refunds.';
        setState({ kind: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [userId, status]);

  return (
    <main className="wide">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <h1 style={{ flex: 1 }}>Refunds</h1>
        {can('refunds.refund.create') && (
          <Link href="/refunds/new">New refund</Link>
        )}
      </div>
      <p>
        <label>
          Status{' '}
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as RefundStatus | '')
            }
          >
            <option value="">All</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </p>
      {state.kind === 'loading' && <p>Loading…</p>}
      {state.kind === 'error' && <p role="alert">{state.message}</p>}
      {state.kind === 'loaded' && state.refunds.length === 0 && (
        <p>{status ? 'No refunds with this status.' : 'No refunds yet.'}</p>
      )}
      {state.kind === 'loaded' && state.refunds.length > 0 && (
        <table className="audit-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Amount</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Requested by</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {state.refunds.map((refund) => (
              <tr key={refund.id}>
                <td>
                  <Link href={`/refunds/${refund.id}`}>
                    {refund.customerEmail}
                  </Link>
                </td>
                <td>{formatEur(refund.amount.amountCents)}</td>
                <td>{refund.reason}</td>
                <td>{STATUS_LABELS[refund.status]}</td>
                <td>{nameOf(refund.requestedBy)}</td>
                <td>{formatDate(refund.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
