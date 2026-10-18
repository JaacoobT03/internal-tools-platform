'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '../../lib/api';
import type { Session, SessionUser } from '../../lib/session';

/** The current user's permissions and the user-id → name lookup. */
export function useRefundsContext(userId: string | null) {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    apiGet<Session>('/auth/me', userId)
      .then((session) => !cancelled && setPermissions(session.permissions))
      .catch(() => !cancelled && setPermissions([]));
    apiGet<SessionUser[]>('/auth/users')
      .then(
        (users) =>
          !cancelled &&
          setNames(Object.fromEntries(users.map((u) => [u.id, u.name]))),
      )
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return {
    can: (permission: string) => permissions.includes(permission),
    nameOf: (id: string) => names[id] ?? id,
  };
}
