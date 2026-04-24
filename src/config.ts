/**
 * App-wide configuration — driven by Vite env vars (prefix VITE_).
 *
 * Set in .env / .env.local / docker-compose environment:
 *   VITE_PRIVACY_MODE=true          → anonymise private-person donor names
 *   VITE_KOFI_URL=https://ko-fi.com/yourpage  → Ko-Fi donation page URL
 */
export const config = {
  privacyMode: import.meta.env.VITE_PRIVACY_MODE === 'true',
  kofiUrl: (import.meta.env.VITE_KOFI_URL as string | undefined) ?? 'https://ko-fi.com/elmontag',
} as const;
