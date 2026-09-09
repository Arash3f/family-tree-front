import type { AuthTokens } from "./types";

export const ACCESS_TOKEN_STORAGE_KEY = "ft.access_token";
export const REFRESH_TOKEN_STORAGE_KEY = "ft.refresh_token";
export const TOKEN_TYPE_STORAGE_KEY = "ft.token_type";

const ACCESS_KEY = ACCESS_TOKEN_STORAGE_KEY;
const REFRESH_KEY = REFRESH_TOKEN_STORAGE_KEY;
const TOKEN_TYPE_KEY = TOKEN_TYPE_STORAGE_KEY;

export const TOKEN_STORAGE_KEYS = [
  ACCESS_TOKEN_STORAGE_KEY,
  REFRESH_TOKEN_STORAGE_KEY,
  TOKEN_TYPE_STORAGE_KEY,
] as const;

export function isTokenStorageEventKey(key: string | null): boolean {
  return (
    key === ACCESS_TOKEN_STORAGE_KEY ||
    key === REFRESH_TOKEN_STORAGE_KEY ||
    key === TOKEN_TYPE_STORAGE_KEY
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

  if (!access_token || !refresh_token) return null;

  return { access_token, refresh_token, token_type };
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
}

export function hasStoredTokens(): boolean {
  return getStoredTokens() !== null;
}
