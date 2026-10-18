export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// Joins `path` onto `base`, keeping any path prefix in `base` (e.g. /api).
export function apiUrl(path: string, base: string = API_BASE_URL): string {
  const baseWithSlash = base.endsWith('/') ? base : `${base}/`;
  return new URL(path.replace(/^\/+/, ''), baseWithSlash).toString();
}
