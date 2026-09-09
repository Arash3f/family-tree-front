import assert from "node:assert/strict";
import test from "node:test";

import { fitText, pngScaleFor } from "./export-raster.ts";

/** Stand-in for canvas measurement: every character is one unit wide. */
const monospace = (value: string) => Array.from(value).length;

test("text that already fits is returned untouched", () => {
  assert.equal(fitText(monospace, "Arash", 10), "Arash");
  assert.equal(fitText(monospace, "Arash", 5), "Arash");
});

test("overlong text is truncated with an ellipsis, never condensed", () => {
  const result = fitText(monospace, "Abdollahzadeh", 6);
  assert.equal(result, "Abdol…");
  assert.ok(monospace(result) <= 6, "result respects the budget");
  assert.ok(result.endsWith("…"), "truncation is visible to the reader");
});

test("truncation keeps as many characters as the budget allows", () => {
  for (let budget = 2; budget <= 12; budget += 1) {
    const result = fitText(monospace, "abcdefghijkl", budget);
    assert.ok(monospace(result) <= budget, `budget=${budget} got "${result}"`);
    // One more character would have overflowed, so nothing is wasted.
    assert.ok(
      monospace(result) >= budget - 1,
      `budget=${budget} wasted space with "${result}"`,
    );
  }
});

test("an impossible budget yields an ellipsis or nothing, never a squeeze", () => {
  assert.equal(fitText(monospace, "abcdef", 1), "…");
  assert.equal(fitText(monospace, "abcdef", 0), "");
  assert.equal(fitText(monospace, "abcdef", -5), "");
});

test("surrogate pairs are never cut in half", () => {
  // Each emoji is two UTF-16 units but one code point.
  const text = "👩‍🔬🌳🌲🌴🌵";
  for (let budget = 1; budget <= 12; budget += 1) {
    const result = fitText(monospace, text, budget);
    assert.ok(
      !/[\uD800-\uDBFF]$/.test(result.replace(/…$/, "")),
      `budget=${budget} ended on a lone high surrogate: ${JSON.stringify(result)}`,
    );
  }
});

test("Persian text truncates without dropping the ellipsis", () => {
  const name = "محمدحسین عبدالله‌زاده طباطبایی";
  const result = fitText(monospace, name, 10);
  assert.ok(result.endsWith("…"));
  assert.ok(monospace(result) <= 10);
  assert.ok(name.startsWith(result.slice(0, -1)), "keeps the leading characters");
});

test("measurement is only asked about candidates, using real widths", () => {
  // A proportional font: "i" is narrow, "M" is wide.
  const widths: Record<string, number> = { i: 1, M: 5, "…": 2 };
  const measure = (value: string) =>
    Array.from(value).reduce((sum, char) => sum + (widths[char] ?? 3), 0);
  assert.equal(fitText(measure, "iiii", 4), "iiii");
  assert.equal(fitText(measure, "MMMM", 20), "MMMM");
  const clipped = fitText(measure, "MMMM", 12);
  assert.ok(measure(clipped) <= 12, `got "${clipped}" at ${measure(clipped)}`);
  assert.equal(clipped, "MM…");
});

test("png scale prefers oversampling for graphs that fit comfortably", () => {
  assert.equal(pngScaleFor(2000, 1500), 2);
  assert.equal(pngScaleFor(400, 300), 2);
});

test("png scale backs off instead of exceeding canvas limits", () => {
  const wide = pngScaleFor(40000, 1700);
  assert.ok(wide < 1, `wide graphs cannot reach 1:1, got ${wide}`);
  assert.ok(40000 * wide <= 16384 + 1, "respects the maximum side");

  const big = pngScaleFor(9000, 9000);
  assert.ok(9000 * big * (9000 * big) <= 120_000_000 + 1, "respects the pixel budget");
  assert.ok(big > 0);
});

test("png scale never returns a non-finite or negative value", () => {
  for (const [w, h] of [
    [1, 1],
    [0, 0],
    [1, 100000],
    [100000, 100000],
  ]) {
    const scale = pngScaleFor(w!, h!);
    assert.ok(Number.isFinite(scale), `w=${w} h=${h} scale=${scale}`);
    assert.ok(scale > 0, `w=${w} h=${h} scale=${scale}`);
  }
});
