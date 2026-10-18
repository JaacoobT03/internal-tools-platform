'use client';

import { useEffect, useState } from 'react';
import { ApiError, apiGet } from '../../../lib/api';
import { useCurrentUserId } from '../../../lib/session';

interface AuditEntry {
  id: string;
  actor: string;
  entity: string;
  entityId: string;
  action: string;
  before: unknown;
  after: unknown;
  timestamp: string;
}

type State =
  | { kind: 'loading' }
  | { kind: 'refused' }
  | { kind: 'unauthenticated' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; entries: AuditEntry[] };

const snapshot = (value: unknown) =>
  value === null || value === undefined ? '—' : JSON.stringify(value, null, 1);

export default function AuditLogPage() {
  const userId = useCurrentUserId();
  const [result, setResult] = useState<{
    userId: string;
    state: State;
  } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    apiGet<{ entries: AuditEntry[] }>('/audit', userId).then(
      ({ entries }) => {
        if (active) setResult({ userId, state: { kind: 'loaded', entries } });
      },
      (error: unknown) => {
        if (!active) return;
        const state: State =
          error instanceof ApiError && error.status === 403
            ? { kind: 'refused' }
            : error instanceof ApiError && error.status === 401
              ? { kind: 'unauthenticated' }
              : {
                  kind: 'error',
                  message: error instanceof Error ? error.message : 'Error',
                };
        setResult({ userId, state });
      },
    );
    return () => {
      active = false;
    };
  }, [userId]);

  const state: State =
    result && result.userId === userId ? result.state : { kind: 'loading' };

  return (
    <main className="wide">
      <h1>Audit log</h1>
      {state.kind === 'loading' && <p>Loading…</p>}
      {state.kind === 'refused' && (
        <p role="alert">
          Access refused (403). The audit log requires the{' '}
          <code>platform.audit.read</code> permission, granted to the auditor
          role only.
        </p>
      )}
      {state.kind === 'unauthenticated' && (
        <p role="alert">Unknown user (401). Pick a user in the header.</p>
      )}
      {state.kind === 'error' && (
        <p role="alert">Could not load the audit log: {state.message}</p>
      )}
      {state.kind === 'loaded' &&
        (state.entries.length === 0 ? (
          <p>No audit entries yet.</p>
        ) : (
          <table className="audit-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Before</th>
                <th>After</th>
              </tr>
            </thead>
            <tbody>
              {state.entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{new Date(entry.timestamp).toISOString()}</td>
                  <td>{entry.actor}</td>
                  <td>{entry.action}</td>
                  <td>
                    {entry.entity} <code>{entry.entityId}</code>
                  </td>
                  <td>
                    <pre>{snapshot(entry.before)}</pre>
                  </td>
                  <td>
                    <pre>{snapshot(entry.after)}</pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
    </main>
  );
}
