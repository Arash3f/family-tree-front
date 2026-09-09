import assert from "node:assert/strict";
import test from "node:test";

import {
  MIN_LEGIBLE_PT,
  PX_PER_PT,
  legibilityFloorScale,
  paperSizePt,
  planPages,
  tilePixelSize,
} from "./export-paginate.ts";

/** Widest generation of `people` cards, matching the layout constants. */
function graphSize(people: number, generations = 5) {
  const PERSON_W = 220;
  const H_GAP = 72;
  const V_GAP = 280;
  const PERSON_H = 176;
  const PAD = 56;
  return {
    graphWidth: people * (PERSON_W + H_GAP) + PAD * 2,
    graphHeight: generations * V_GAP + PERSON_H + PAD * 2,
  };
}

test("paper sizes swap edges with orientation", () => {
  const portrait = paperSizePt("a4", "portrait");
  const landscape = paperSizePt("a4", "landscape");
  assert.equal(portrait.widthPt, landscape.heightPt);
  assert.equal(portrait.heightPt, landscape.widthPt);
  assert.ok(portrait.heightPt > portrait.widthPt);
});

test("actual fit never scales below 1:1, so text keeps its size", () => {
  for (const people of [8, 20, 40, 80, 150, 300]) {
    const plan = planPages({ ...graphSize(people), fit: "actual" });
    assert.equal(plan.scale, 1, `people=${people}`);
    assert.ok(
      plan.smallestTextPt >= MIN_LEGIBLE_PT,
      `people=${people} text=${plan.smallestTextPt}`,
    );
    assert.equal(plan.belowLegible, false);
  }
});

test("page count grows with the tree instead of text shrinking", () => {
  const small = planPages({ ...graphSize(8), fit: "actual" });
  const large = planPages({ ...graphSize(150), fit: "actual" });
  assert.ok(large.pageCount > small.pageCount);
  assert.equal(small.scale, large.scale);
});

test("compact fit respects the page budget when legibility allows", () => {
  const atFullSize = planPages({ ...graphSize(40), fit: "actual" });
  const budget = atFullSize.pageCount - 2;
  const plan = planPages({ ...graphSize(40), fit: "compact", maxPages: budget });
  assert.ok(plan.pageCount <= budget, `pages=${plan.pageCount} budget=${budget}`);
  assert.ok(plan.scale < 1, "it had to shrink to meet the budget");
  assert.ok(plan.scale >= legibilityFloorScale() - 1e-9);
  assert.equal(plan.clampedByLegibility, false);
  assert.equal(plan.belowLegible, false);
});

test("compact fit keeps full size when the budget is already met", () => {
  const plan = planPages({ ...graphSize(8), fit: "compact", maxPages: 40 });
  assert.equal(plan.scale, 1);
  assert.equal(plan.clampedByLegibility, false);
});

test("an impossible budget costs pages, never readability", () => {
  const plan = planPages({ ...graphSize(40), fit: "compact", maxPages: 2 });
  assert.equal(plan.clampedByLegibility, true);
  assert.ok(plan.scale >= legibilityFloorScale() - 1e-9);
  assert.equal(plan.belowLegible, false);
  assert.ok(plan.pageCount > 2, "the budget was exceeded to stay readable");
});

test("compact fit refuses to go below the legibility floor", () => {
  const plan = planPages({ ...graphSize(300), fit: "compact", maxPages: 1 });
  assert.equal(plan.clampedByLegibility, true);
  assert.ok(plan.scale >= legibilityFloorScale() - 1e-9);
  assert.ok(
    plan.smallestTextPt >= MIN_LEGIBLE_PT - 0.01,
    `text=${plan.smallestTextPt}`,
  );
  assert.ok(plan.pageCount > 1, "it pays in pages, not in readability");
});

test("single fit is one page and reports when text became too small", () => {
  const plan = planPages({ ...graphSize(150), fit: "single" });
  assert.equal(plan.pageCount, 1);
  assert.equal(plan.columns, 1);
  assert.equal(plan.rows, 1);
  assert.equal(plan.belowLegible, true);
});

test("tiles cover the whole graph", () => {
  const size = graphSize(40);
  const plan = planPages({ ...size, fit: "actual" });
  const right = Math.max(...plan.tiles.map((t) => t.graphX + t.graphWidth));
  const bottom = Math.max(...plan.tiles.map((t) => t.graphY + t.graphHeight));
  assert.ok(right >= size.graphWidth - 1, `right=${right} of ${size.graphWidth}`);
  assert.ok(
    bottom >= size.graphHeight - 1,
    `bottom=${bottom} of ${size.graphHeight}`,
  );
});

test("neighbouring tiles overlap so pages can be taped together", () => {
  const plan = planPages({ ...graphSize(40), fit: "actual", overlapPt: 14 });
  assert.ok(plan.columns >= 2, "needs at least two columns to compare");
  const first = plan.tiles.find((t) => t.col === 1 && t.row === 1)!;
  const second = plan.tiles.find((t) => t.col === 2 && t.row === 1)!;
  const firstRight = first.graphX + first.graphWidth;
  assert.ok(
    second.graphX < firstRight,
    `second starts at ${second.graphX}, first ends at ${firstRight}`,
  );
  const overlapPx = (firstRight - second.graphX) * plan.scale;
  assert.ok(
    Math.abs(overlapPx - 14 * PX_PER_PT) < 1,
    `overlap=${overlapPx}px expected=${14 * PX_PER_PT}px`,
  );
});

test("tiles never reach outside the graph", () => {
  const size = graphSize(23);
  const plan = planPages({ ...size, fit: "actual" });
  for (const tile of plan.tiles) {
    assert.ok(tile.graphX >= -1e-6, `graphX=${tile.graphX}`);
    assert.ok(tile.graphY >= -1e-6, `graphY=${tile.graphY}`);
    assert.ok(
      tile.graphX + tile.graphWidth <= size.graphWidth + 1e-6,
      `right=${tile.graphX + tile.graphWidth} > ${size.graphWidth}`,
    );
    assert.ok(
      tile.graphY + tile.graphHeight <= size.graphHeight + 1e-6,
      `bottom=${tile.graphY + tile.graphHeight} > ${size.graphHeight}`,
    );
  }
});

test("a small graph stays on one page without stretching", () => {
  const plan = planPages({ graphWidth: 400, graphHeight: 300, fit: "actual" });
  assert.equal(plan.pageCount, 1);
  assert.equal(plan.scale, 1);
  const tile = plan.tiles[0]!;
  assert.equal(tile.graphWidth, 400);
  assert.equal(tile.graphHeight, 300);
});

test("tile bitmaps follow the requested dpi", () => {
  const plan = planPages({ ...graphSize(20), fit: "actual", dpi: 300 });
  const tile = plan.tiles[0]!;
  const { pixelWidth, pixelHeight } = tilePixelSize(plan, tile);
  assert.equal(pixelWidth, Math.round((tile.pageWidth * 300) / 72));
  assert.equal(pixelHeight, Math.round((tile.pageHeight * 300) / 72));
  assert.ok(pixelWidth <= 16384 && pixelHeight <= 16384, "stays within canvas limits");
});

test("tile bitmaps stay within canvas limits on the largest paper and dpi", () => {
  const plan = planPages({
    ...graphSize(300),
    paper: "a1",
    orientation: "landscape",
    fit: "actual",
    dpi: 300,
  });
  for (const tile of plan.tiles) {
    const { pixelWidth, pixelHeight } = tilePixelSize(plan, tile);
    assert.ok(pixelWidth <= 16384, `pixelWidth=${pixelWidth}`);
    assert.ok(pixelHeight <= 16384, `pixelHeight=${pixelHeight}`);
    assert.ok(pixelWidth * pixelHeight <= 268_000_000, "area within limits");
  }
});

test("every paper size produces a usable plan", () => {
  for (const paper of ["a5", "a4", "a3", "a2", "a1", "letter", "tabloid"] as const) {
    for (const orientation of ["portrait", "landscape"] as const) {
      const plan = planPages({
        ...graphSize(30),
        paper,
        orientation,
        fit: "actual",
      });
      assert.ok(plan.pageCount >= 1, `${paper}/${orientation}`);
      assert.ok(plan.tiles.length === plan.pageCount);
      for (const tile of plan.tiles) {
        assert.ok(tile.pageWidth > 0 && tile.pageHeight > 0);
        assert.ok(
          tile.pageWidth <= plan.pageWidthPt - plan.marginPt * 2 + 1e-6,
          `${paper}/${orientation} tile too wide`,
        );
      }
    }
  }
});

test("legibility floor matches the documented minimum", () => {
  const floor = legibilityFloorScale();
  assert.ok(Math.abs(floor * 10 * (1 / PX_PER_PT) - MIN_LEGIBLE_PT) < 1e-9);
});
