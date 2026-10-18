'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { ApiError, apiGet, apiPost } from '../../../lib/api';
import { useCurrentUserId } from '../../../lib/session';
import { formatDate, formatEur, type Refund, STATUS_LABELS } from '../format';
import { useRefundsContext } from '../use-refunds-context';

const refusal = (error: unknown) =>
  error instanceof ApiError
    ? `Refused (${error.status}): ${error.message}`
    : 'Something went wrong.';

export default function RefundDetailPage() {
  return (
    <Suspense
      fallback={
        <main>
          <p>Loading…</p>
        </main>
      }
    >
      <RefundDetail />
    </Suspense>
  );
}

function RefundDetail() {
  const { id } = useParams<{ id: string }>();
  const userId = useCurrentUserId();
  const { can, nameOf } = useRefundsContext(userId);
  const [refund, setRefund] = useState<Refund | null>(null);
  const [revealed, setRevealed] = useState<{
    userId: string | null;
    email: string;
  } | null>(null);
  const [revealedFor, setRevealedFor] = useState(userId);
  if (revealedFor !== userId) {
    setRevealedFor(userId);
    setRevealed(null);
  }
  const email = revealed?.userId === userId ? revealed.email : null;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    apiGet<Refund>(`/refunds/${id}`, userId)
      .then((loaded) => {
        if (cancelled) return;
        setError(null);
        setRefund(loaded);
      })
      .catch((err: unknown) => !cancelled && setError(refusal(err)));
    return () => {
      cancelled = true;
    };
  }, [id, userId]);

  function act(path: string, onDone: (body: unknown) => void) {
    setBusy(true);
    setError(null);
    apiPost<unknown>(`/refunds/${id}/${path}`, undefined, userId)
      .then(onDone)
      .catch((err: unknown) => setError(refusal(err)))
      .finally(() => setBusy(false));
  }

  const decide = (decision: 'approve' | 'reject') =>
    act(decision, (body) => setRefund(body as Refund));
  const reveal = () =>
    act('reveal-email', (body) =>
      setRevealed({
        userId,
        email: (body as { customerEmail: string }).customerEmail,
      }),
    );

  return (
    <main>
      <p>
        <Link href="/refunds">← Refunds</Link>
      </p>
      <h1>Refund</h1>
      {!refund && !error && <p>Loading…</p>}
      {error && <p role="alert">{error}</p>}
      {refund && (
        <>
          <table className="audit-table">
            <tbody>
              <tr>
                <th>Status</th>
                <td>{STATUS_LABELS[refund.status]}</td>
              </tr>
              <tr>
                <th>Amount</th>
                <td>{formatEur(refund.amount.amountCents)}</td>
              </tr>
              <tr>
                <th>Customer</th>
                <td>{email ?? refund.customerEmail}</td>
              </tr>
              <tr>
                <th>Card</th>
                <td>{refund.cardLast4}</td>
              </tr>
              <tr>
                <th>Payment reference</th>
                <td>{refund.paymentReference}</td>
              </tr>
              <tr>
                <th>Reason</th>
                <td>{refund.reason}</td>
              </tr>
              <tr>
                <th>Requested by</th>
                <td>{nameOf(refund.requestedBy)}</td>
              </tr>
              <tr>
                <th>Date</th>
                <td>{formatDate(refund.createdAt)}</td>
              </tr>
              {refund.payoutId && (
                <tr>
                  <th>Payout</th>
                  <td>{refund.payoutId}</td>
                </tr>
              )}
            </tbody>
          </table>
          <p style={{ display: 'flex', gap: '0.5rem' }}>
            {refund.status === 'pending_approval' &&
              can('refunds.refund.decide') && (
                <>
                  <button disabled={busy} onClick={() => decide('approve')}>
                    Approve
                  </button>
                  <button disabled={busy} onClick={() => decide('reject')}>
                    Reject
                  </button>
                </>
              )}
            {email === null && can('refunds.customer-email.reveal') && (
              <button disabled={busy} onClick={reveal}>
                Reveal email
              </button>
            )}
          </p>
        </>
      )}
    </main>
  );
}
