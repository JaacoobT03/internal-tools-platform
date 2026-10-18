export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export function apiUrl(path: string, base: string = API_BASE_URL): string {
  return new URL(path, base).toString();
}
