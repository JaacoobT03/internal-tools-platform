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

interface AuditPage {
  entries: AuditEntry[];
  nextCursor: string | null;
}

type State =
  | { kind: 'loading' }
  | { kind: 'refused' }
  | { kind: 'unauthenticated' }
  | { kind: 'error'; message: string }
  | {
      kind: 'loaded';
      entries: AuditEntry[];
      nextCursor: string | null;
      loadingMore?: boolean;
      moreError?: string;
    };

const snapshot = (value: unknown) =>
  value === null || value === undefined ? '—' : JSON.stringify(value, null, 1);

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Error';

export default function AuditLogPage() {
  const userId = useCurrentUserId();
  const [result, setResult] = useState<{
    userId: string;
    state: State;
  } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    apiGet<AuditPage>('/audit', userId).then(
      ({ entries, nextCursor }) => {
        if (active)
          setResult({ userId, state: { kind: 'loaded', entries, nextCursor } });
      },
      (error: unknown) => {
        if (!active) return;
        const state: State =
          error instanceof ApiError && error.status === 403
            ? { kind: 'refused' }
            : error instanceof ApiError && error.status === 401
              ? { kind: 'unauthenticated' }
              : { kind: 'error', message: errorMessage(error) };
        setResult({ userId, state });
      },
    );
    return () => {
      active = false;
    };
  }, [userId]);

  const state: State =
    result && result.userId === userId ? result.state : { kind: 'loading' };

  const updateLoaded = (
    forUser: string,
    update: (loaded: Extract<State, { kind: 'loaded' }>) => State,
  ) =>
    setResult((current) =>
      current?.userId === forUser && current.state.kind === 'loaded'
        ? { userId: forUser, state: update(current.state) }
        : current,
    );

  const loadOlder = (cursor: string) => {
    if (!userId) return;
    const forUser = userId;
    updateLoaded(forUser, (loaded) => ({
      ...loaded,
      loadingMore: true,
      moreError: undefined,
    }));
    apiGet<AuditPage>(
      `/audit?cursor=${encodeURIComponent(cursor)}`,
      forUser,
    ).then(
      (page) =>
        updateLoaded(forUser, (loaded) => ({
          kind: 'loaded',
          entries: [...loaded.entries, ...page.entries],
          nextCursor: page.nextCursor,
        })),
      (error: unknown) =>
        updateLoaded(forUser, (loaded) => ({
          ...loaded,
          loadingMore: false,
          moreError: errorMessage(error),
        })),
    );
  };

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
          <>
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
            {state.moreError && (
              <p role="alert">
                Could not load older entries: {state.moreError}
              </p>
            )}
            {state.nextCursor && (
              <button
                type="button"
                disabled={state.loadingMore}
                onClick={() => loadOlder(state.nextCursor as string)}
              >
                {state.loadingMore ? 'Loading…' : 'Load older entries'}
              </button>
            )}
          </>
        ))}
    </main>
  );
}
