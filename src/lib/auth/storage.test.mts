import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

/**
 * `storage.ts` reads `localStorage` through the global `window`, so stand a
 * minimal one up before importing it.
 */
class MemoryStorage {
  private map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }
}

const store = new MemoryStorage();
const globalAny = globalThis as unknown as Record<string, unknown>;
globalAny.window = globalAny.window ?? {};
globalAny.localStorage = store;

const {
  clearStoredTokens,
  getStoredTokens,
  isImpersonating,
  setStoredTokens,
  startImpersonation,
  stopImpersonation,
} = await import("@/lib/auth/storage.ts");

const ADMIN = {
  access_token: "admin-access",
  refresh_token: "admin-refresh",
  token_type: "bearer",
};

beforeEach(() => {
  store.clear();
});

test("a normal session needs both tokens", () => {
  store.setItem("ft.access_token", "only-access");
  assert.equal(getStoredTokens(), null);

  setStoredTokens(ADMIN);
  assert.deepEqual(getStoredTokens(), ADMIN);
  assert.equal(isImpersonating(), false);
});

test("impersonation is readable with no refresh token", () => {
  setStoredTokens(ADMIN);
  startImpersonation("impersonation-access");

  assert.equal(isImpersonating(), true);
  assert.deepEqual(getStoredTokens(), {
    access_token: "impersonation-access",
    refresh_token: "",
    token_type: "bearer",
  });
});

test("leaving impersonation restores the admin's own pair", () => {
  setStoredTokens(ADMIN);
  startImpersonation("impersonation-access");

  assert.equal(stopImpersonation(), true);
  assert.equal(isImpersonating(), false);
  assert.deepEqual(getStoredTokens(), ADMIN);
});

test("impersonating twice keeps the original admin tokens parked", () => {
  setStoredTokens(ADMIN);
  startImpersonation("first-target");
  // Switching straight into a second user must not park the first
  // impersonation token as if it were the admin's own session.
  startImpersonation("second-target");

  assert.equal(stopImpersonation(), true);
  assert.deepEqual(getStoredTokens(), ADMIN);
});

test("leaving with nothing parked clears the session", () => {
  startImpersonation("orphan-token");

  assert.equal(stopImpersonation(), false);
  assert.equal(getStoredTokens(), null);
  assert.equal(isImpersonating(), false);
});

test("clearing tokens also drops the impersonation state", () => {
  setStoredTokens(ADMIN);
  startImpersonation("impersonation-access");

  clearStoredTokens();

  assert.equal(isImpersonating(), false);
  assert.equal(getStoredTokens(), null);
  // Nothing parked survives a sign-out.
  assert.equal(stopImpersonation(), false);
});
