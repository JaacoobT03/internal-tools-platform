export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// Joins `path` onto `base`, keeping any path prefix in `base` (e.g. /api).
export function apiUrl(path: string, base: string = API_BASE_URL): string {
  const baseWithSlash = base.endsWith('/') ? base : `${base}/`;
  return new URL(path.replace(/^\/+/, ''), baseWithSlash).toString();
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiRequest<T>(
  path: string,
  userId: string | null | undefined,
  init: { method: 'GET' | 'POST'; body?: unknown },
): Promise<T> {
  const headers: Record<string, string> = userId ? { 'X-User-Id': userId } : {};
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(apiUrl(path), {
    method: init.method,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: 'no-store',
  });
  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = (await response.json()) as { message?: unknown };
      if (typeof body.message === 'string') message = body.message;
    } catch {
      // Non-JSON error body: keep the status text.
    }
    throw new ApiError(response.status, message);
  }
  // No-content success (204/205, or an empty body): resolve with undefined.
  if (response.status === 204 || response.status === 205) {
    return undefined as T;
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/**
 * GET `path` from the platform API as `userId`. The X-User-Id header is the
 * mock-auth contract (ADR 0001); real SSO replaces it without touching apps.
 */
export function apiGet<T>(path: string, userId?: string | null): Promise<T> {
  return apiRequest<T>(path, userId, { method: 'GET' });
}

/**
 * POST `body` (JSON, optional) to `path` as `userId`. See `apiGet`. Resolves
 * with `undefined` when the response has no body.
 */
export function apiPost<T>(
  path: string,
  body?: unknown,
  userId?: string | null,
): Promise<T> {
  return apiRequest<T>(path, userId, { method: 'POST', body });
}
