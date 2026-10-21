import type { AuthTokens } from "./types";

export const ACCESS_TOKEN_STORAGE_KEY = "ft.access_token";
export const REFRESH_TOKEN_STORAGE_KEY = "ft.refresh_token";
export const TOKEN_TYPE_STORAGE_KEY = "ft.token_type";
/** Set while an admin is signed in as someone else. */
export const IMPERSONATION_STORAGE_KEY = "ft.impersonating";
/** The admin's own tokens, parked so exiting restores their session. */
export const IMPERSONATION_BACKUP_STORAGE_KEY = "ft.impersonation_backup";

const ACCESS_KEY = ACCESS_TOKEN_STORAGE_KEY;
const REFRESH_KEY = REFRESH_TOKEN_STORAGE_KEY;
const TOKEN_TYPE_KEY = TOKEN_TYPE_STORAGE_KEY;

export const TOKEN_STORAGE_KEYS = [
  ACCESS_TOKEN_STORAGE_KEY,
  REFRESH_TOKEN_STORAGE_KEY,
  TOKEN_TYPE_STORAGE_KEY,
  IMPERSONATION_STORAGE_KEY,
] as const;

export function isTokenStorageEventKey(key: string | null): boolean {
  return (
    key === ACCESS_TOKEN_STORAGE_KEY ||
    key === REFRESH_TOKEN_STORAGE_KEY ||
    key === TOKEN_TYPE_STORAGE_KEY ||
    key === IMPERSONATION_STORAGE_KEY
  );
}

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

export function getStoredTokens(): AuthTokens | null {
  if (!canUseStorage()) return null;

  const access_token = localStorage.getItem(ACCESS_KEY);
  const refresh_token = localStorage.getItem(REFRESH_KEY);
  const token_type = localStorage.getItem(TOKEN_TYPE_KEY) || "bearer";

  if (!access_token) return null;
  // An impersonation token comes alone — there is no refresh token to pair it
  // with, and demanding one here would read the session as signed out.
  if (!refresh_token) {
    return isImpersonating()
      ? { access_token, refresh_token: "", token_type }
      : null;
  }

  return { access_token, refresh_token, token_type };
}

/** True while the stored access token is an admin impersonation token. */
export function isImpersonating(): boolean {
  if (!canUseStorage()) return false;
  return localStorage.getItem(IMPERSONATION_STORAGE_KEY) === "1";
}

/**
 * Swap the admin's own tokens for an impersonation token.
 *
 * The admin's pair is parked under the backup key so `stopImpersonation` can
 * put them back; the impersonation token itself is stored alone, since it has
 * no refresh counterpart.
 *
 * @param accessToken - The impersonation access token from the API.
 */
export function startImpersonation(accessToken: string): void {
  if (!canUseStorage()) return;

  const own = getStoredTokens();
  if (own && !isImpersonating()) {
    localStorage.setItem(
      IMPERSONATION_BACKUP_STORAGE_KEY,
      JSON.stringify(own),
    );
  }

  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.setItem(TOKEN_TYPE_KEY, "bearer");
  localStorage.setItem(IMPERSONATION_STORAGE_KEY, "1");
}

/**
 * Leave impersonation and restore the admin's parked session.
 *
 * @returns True when the admin's tokens were put back, false when there was
 *   nothing to restore (the caller should then treat it as a sign-out).
 */
export function stopImpersonation(): boolean {
  if (!canUseStorage()) return false;

  const raw = localStorage.getItem(IMPERSONATION_BACKUP_STORAGE_KEY);
  localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
  localStorage.removeItem(IMPERSONATION_BACKUP_STORAGE_KEY);

  if (!raw) {
    clearStoredTokens();
    return false;
  }

  try {
    const own = JSON.parse(raw) as AuthTokens;
    if (!own?.access_token || !own?.refresh_token) {
      clearStoredTokens();
      return false;
    }
    setStoredTokens(own);
    return true;
  } catch {
    clearStoredTokens();
    return false;
  }
}

export function setStoredTokens(tokens: AuthTokens): void {
  if (!canUseStorage()) return;

  localStorage.setItem(ACCESS_KEY, tokens.access_token);
  localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
  localStorage.setItem(TOKEN_TYPE_KEY, tokens.token_type || "bearer");
}

export function clearStoredTokens(): void {
  if (!canUseStorage()) return;

  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(TOKEN_TYPE_KEY);
  localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
  localStorage.removeItem(IMPERSONATION_BACKUP_STORAGE_KEY);
}

export function hasStoredTokens(): boolean {
  return getStoredTokens() !== null;
}
