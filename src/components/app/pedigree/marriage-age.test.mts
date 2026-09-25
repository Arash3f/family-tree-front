import assert from "node:assert/strict";
import test from "node:test";

import {
  isUnderageAtMarriage,
  underageSpouseLabels,
} from "./marriage-age.ts";

test("underage when birth+wedding imply age under 18", () => {
  assert.equal(isUnderageAtMarriage("2010-06-15", "2023-01-01"), true);
  assert.equal(isUnderageAtMarriage("2000-01-01", "2023-01-01"), false);
});

test("missing birth date is not treated as underage", () => {
  assert.equal(isUnderageAtMarriage(null, "2023-01-01"), false);
  assert.equal(isUnderageAtMarriage(undefined, "2023-01-01"), false);
});

test("underageSpouseLabels returns only underage display names", () => {
  assert.deepEqual(
    underageSpouseLabels(
      [
        { label: "Ali", birth_date: "2010-01-01" },
        { label: "Sara", birth_date: "1997-01-01" },
      ],
      "2023-01-01",
    ),
    ["Ali"],
  );
});
