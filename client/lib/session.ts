'use client';

import { useSyncExternalStore } from 'react';

// Mock login (ADR 0001): the selected seed user is kept in localStorage and
// sent as X-User-Id. Real SSO replaces this module, not app code.
const STORAGE_KEY = 'platform.userId';
const CHANGE_EVENT = 'platform:user-changed';

/** Least-privileged seed user, used until another user is selected. */
export const DEFAULT_USER_ID = 'u-viewer';

export interface SessionUser {
  id: string;
  name: string;
  roles: string[];
}

export interface Session {
  user: SessionUser;
  permissions: string[];
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function getCurrentUserId(): string {
  return window.localStorage.getItem(STORAGE_KEY) ?? DEFAULT_USER_ID;
}

export function setCurrentUserId(userId: string): void {
  window.localStorage.setItem(STORAGE_KEY, userId);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** The selected user id; null during server rendering. */
export function useCurrentUserId(): string | null {
  return useSyncExternalStore(subscribe, getCurrentUserId, () => null);
}
