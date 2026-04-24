/**
 * App-wide configuration — driven by Vite env vars (prefix VITE_).
 *
 * Set in .env / .env.local / docker-compose build args:
 *   VITE_PRIVACY_MODE=false         → show donor names (default: true = names hidden)
 *   VITE_KOFI_URL=https://ko-fi.com/yourpage  → Ko-Fi donation page URL
 */
export const config = {
  /** Privacy mode is ON by default. Set VITE_PRIVACY_MODE=false to disable. */
  privacyMode: import.meta.env.VITE_PRIVACY_MODE !== 'false',
  kofiUrl: (import.meta.env.VITE_KOFI_URL as string | undefined) ?? 'https://ko-fi.com/elmontag',
} as const;
