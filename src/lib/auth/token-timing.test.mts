import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decodeJwtExp,
  isAccessTokenExpired,
  msUntilProactiveRefresh,
  PROACTIVE_REFRESH_LEEWAY_MS,
} from "./token-timing.ts";

function makeJwt(expSeconds: number): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
    "base64url",
  );
  const payload = Buffer.from(JSON.stringify({ exp: expSeconds })).toString(
    "base64url",
  );
  return `${header}.${payload}.sig`;
}

describe("token-timing", () => {
  it("decodes JWT exp", () => {
    const exp = Math.floor(Date.now() / 1000) + 300;
    assert.equal(decodeJwtExp(makeJwt(exp)), exp * 1000);
  });

  it("detects expired access tokens with leeway", () => {
    const past = Math.floor(Date.now() / 1000) - 10;
    assert.equal(isAccessTokenExpired(makeJwt(past)), true);

    const soon = Math.floor((Date.now() + 20_000) / 1000);
    assert.equal(isAccessTokenExpired(makeJwt(soon), 30_000), true);

    const later = Math.floor((Date.now() + 120_000) / 1000);
    assert.equal(isAccessTokenExpired(makeJwt(later), 30_000), false);
  });

  it("schedules proactive refresh before expiry", () => {
    const expMs = Date.now() + 120_000;
    const token = makeJwt(Math.floor(expMs / 1000));
    const delay = msUntilProactiveRefresh(token);
    assert.ok(delay !== null);
    assert.ok(delay <= 120_000 - PROACTIVE_REFRESH_LEEWAY_MS + 50);
    assert.ok(delay >= 0);
  });
});
