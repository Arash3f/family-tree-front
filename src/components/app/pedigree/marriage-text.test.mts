import assert from "node:assert/strict";
import test from "node:test";

import { marriagePeriodText } from "@/components/app/pedigree/marriage-text.ts";

const years = (count: number) => `${count}y`;

test("an ongoing marriage shows the wedding date and years so far", () => {
  const text = marriagePeriodText({ married_at: "1990-06-01", divorced_at: null }, "en", years);

  assert.match(text, /^1990-06-01 · \d+y$/);
});

test("a divorce adds the end date and the span between the two", () => {
  assert.equal(
    marriagePeriodText(
      { married_at: "1990-06-01", divorced_at: "2004-06-01" },
      "en",
      years,
    ),
    "1990-06-01 → 2004-06-01 · 14y",
  );
});

test("Persian renders Jalali dates in Persian digits", () => {
  assert.equal(
    marriagePeriodText(
      { married_at: "1990-06-01", divorced_at: "2004-06-01" },
      "fa",
      years,
    ),
    "۱۳۶۹/۰۳/۱۱ → ۱۳۸۳/۰۳/۱۲ · 14y",
  );
});

test("an unparsable wedding date drops the duration instead of guessing", () => {
  assert.equal(
    marriagePeriodText({ married_at: "sometime", divorced_at: null }, "en", years),
    "sometime",
  );
});
