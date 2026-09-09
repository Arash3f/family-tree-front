/** Milliseconds before access-token expiry when we proactively refresh. */
export const PROACTIVE_REFRESH_LEEWAY_MS = 60_000;

export function decodeJwtExp(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** True when the token is expired or within `leewayMs` of expiring. */
export function isAccessTokenExpired(
  accessToken: string,
  leewayMs = 0,
): boolean {
  const exp = decodeJwtExp(accessToken);
  if (exp === null) return true;
  return Date.now() + leewayMs >= exp;
}

/** Delay until the next proactive refresh, or `null` when unknown. */
export function msUntilProactiveRefresh(accessToken: string): number | null {
  const exp = decodeJwtExp(accessToken);
  if (exp === null) return null;
  return Math.max(0, exp - PROACTIVE_REFRESH_LEEWAY_MS - Date.now());
}
