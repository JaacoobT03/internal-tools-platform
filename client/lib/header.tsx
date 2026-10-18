'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiGet } from './api';
import { visibleEntries } from './registry';
import {
  setCurrentUserId,
  useCurrentUserId,
  type Session,
  type SessionUser,
} from './session';

/** Page header: registry-driven navigation plus the mock-login user switcher. */
export function Header() {
  const userId = useCurrentUserId();
  const [users, setUsers] = useState<SessionUser[] | null>(null);
  const [usersFailed, setUsersFailed] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let active = true;
    apiGet<SessionUser[]>('/auth/users').then(
      (list) => {
        if (active) setUsers(list);
      },
      () => {
        if (active) setUsersFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    apiGet<Session>('/auth/me', userId).then(
      (current) => {
        if (active) setSession(current);
      },
      () => {
        if (active) setSession(null);
      },
    );
    return () => {
      active = false;
    };
  }, [userId]);

  const permissions =
    session && session.user.id === userId ? session.permissions : [];

  return (
    <header className="platform-header">
      <Link href="/" className="platform-header__home">
        Internal Tools Platform
      </Link>
      <nav aria-label="Main">
        {visibleEntries(permissions).map((entry) => (
          <Link key={entry.path} href={entry.path}>
            {entry.name}
          </Link>
        ))}
      </nav>
      <label className="platform-header__user">
        Acting as{' '}
        {usersFailed ? (
          <span role="alert">API unavailable</span>
        ) : (
          <select
            aria-label="Acting as"
            value={users && userId ? userId : ''}
            onChange={(event) => setCurrentUserId(event.target.value)}
            disabled={!users}
          >
            {!users && <option value="">Loading…</option>}
            {users?.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} ({user.roles.join(', ')})
              </option>
            ))}
          </select>
        )}
        <small> mock login, dev only</small>
      </label>
    </header>
  );
}
