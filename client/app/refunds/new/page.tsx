'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { ApiError, apiPost } from '../../../lib/api';
import { useCurrentUserId } from '../../../lib/session';
import { parseEurToCents, type Refund } from '../format';

const FIELDS = [
  { name: 'paymentReference', label: 'Original payment reference' },
  { name: 'customerEmail', label: 'Customer email', type: 'email' },
  {
    name: 'cardLast4',
    label: 'Card last 4 digits',
    inputMode: 'numeric',
    maxLength: 4,
  },
  { name: 'amount', label: 'Amount (EUR)', inputMode: 'decimal' },
  { name: 'reason', label: 'Reason' },
] as const;

export default function NewRefundPage() {
  const router = useRouter();
  const userId = useCurrentUserId();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const value = (name: string) => String(form.get(name) ?? '').trim();
    const amountCents = parseEurToCents(value('amount'));
    if (amountCents === null) {
      setError('Amount must be a positive EUR amount with at most 2 decimals.');
      return;
    }
    setError(null);
    setSubmitting(true);
    apiPost<Refund>(
      '/refunds',
      {
        paymentReference: value('paymentReference'),
        customerEmail: value('customerEmail'),
        cardLast4: value('cardLast4'),
        amount: { amountCents, currency: 'EUR' },
        reason: value('reason'),
      },
      userId,
    )
      .then((refund) => {
        // Next.js may keep this page mounted for back/forward navigation.
        formElement.reset();
        setSubmitting(false);
        router.push(`/refunds/${refund.id}`);
      })
      .catch((err: unknown) => {
        setSubmitting(false);
        setError(
          err instanceof ApiError
            ? `Refused (${err.status}): ${err.message}`
            : 'Could not create the refund.',
        );
      });
  }

  return (
    <main>
      <p>
        <Link href="/refunds">← Refunds</Link>
      </p>
      <h1>New refund</h1>
      <form
        onSubmit={onSubmit}
        style={{ display: 'grid', gap: '0.75rem', maxWidth: '24rem' }}
      >
        {FIELDS.map((field) => (
          <label key={field.name} style={{ display: 'grid', gap: '0.25rem' }}>
            {field.label}
            <input
              name={field.name}
              type={'type' in field ? field.type : 'text'}
              inputMode={'inputMode' in field ? field.inputMode : undefined}
              maxLength={'maxLength' in field ? field.maxLength : undefined}
              required
            />
          </label>
        ))}
        <p style={{ margin: 0, color: '#555', fontSize: '0.875rem' }}>
          Refunds above EUR 500.00 need a second person to approve them.
        </p>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create refund'}
        </button>
      </form>
    </main>
  );
}
