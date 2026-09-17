import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  absoluteLocaleUrl,
  getSiteUrl,
  languageAlternates,
  localePath,
} from "@/lib/site-url.ts";

describe("site-url", () => {
  it("builds locale paths and absolute URLs from getSiteUrl", () => {
    const origin = getSiteUrl();
    assert.equal(localePath("en"), "/en");
    assert.equal(localePath("fa", "/login"), "/fa/login");
    assert.equal(absoluteLocaleUrl("en"), `${origin}/en`);
    assert.equal(absoluteLocaleUrl("fa", "/register"), `${origin}/fa/register`);
  });

  it("exposes absolute hreflang alternates", () => {
    const origin = getSiteUrl();
    assert.deepEqual(languageAlternates(), {
      en: `${origin}/en`,
      fa: `${origin}/fa`,
      "x-default": `${origin}/en`,
    });
  });
});
