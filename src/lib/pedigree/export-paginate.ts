/**
 * Page geometry for pedigree exports.
 *
 * The pedigree graph is laid out in CSS pixels. Printing it means answering two
 * questions: how much to scale the graph, and how to cut it into paper-sized
 * pieces. Scaling is bounded from below by legibility — the smallest text in a
 * person card must survive the trip to paper — so large trees grow in page
 * count rather than shrinking into an unreadable strip.
 *
 * Everything here is pure arithmetic so it can be tested without a DOM.
 */

/** Smallest font size used by a person card, in graph CSS pixels. */
export const SMALLEST_CARD_TEXT_PX = 10;

/** Below this printed size body text stops being comfortably readable. */
export const MIN_LEGIBLE_PT = 6;

/** CSS reference pixels per PostScript point (96dpi / 72dpi). */
export const PX_PER_PT = 96 / 72;

export type PaperId = "a5" | "a4" | "a3" | "a2" | "a1" | "letter" | "tabloid";

export type Orientation = "portrait" | "landscape";

/**
 * How to reconcile graph size with page count.
 * - `actual`: print at 1:1, use as many pages as needed.
 * - `compact`: shrink toward `maxPages`, never past the legibility floor.
 * - `single`: force one page, even if text ends up small.
 */
export type FitMode = "actual" | "compact" | "single";

/** Short edge x long edge, in points. */
const PAPER_PT: Record<PaperId, readonly [number, number]> = {
  a5: [419.53, 595.28],
  a4: [595.28, 841.89],
  a3: [841.89, 1190.55],
  a2: [1190.55, 1683.78],
  a1: [1683.78, 2383.94],
  letter: [612, 792],
  tabloid: [792, 1224],
};

export const PAPER_IDS: PaperId[] = [
  "a5",
  "a4",
  "a3",
  "a2",
  "a1",
  "letter",
  "tabloid",
];

export type PageTile = {
  index: number;
  /** 1-based grid position, used for assembly labels. */
  col: number;
  row: number;
  /** Region of the graph this page shows, in graph CSS pixels. */
  graphX: number;
  graphY: number;
  graphWidth: number;
  graphHeight: number;
  /** Where that region lands on the page, in points from the top-left corner. */
  pageX: number;
  pageY: number;
  pageWidth: number;
  pageHeight: number;
};

export type PagePlan = {
  paper: PaperId;
  orientation: Orientation;
  fit: FitMode;
  /** Graph CSS pixels per printed CSS pixel. 1 means true size. */
  scale: number;
  columns: number;
  rows: number;
  pageCount: number;
  pageWidthPt: number;
  pageHeightPt: number;
  marginPt: number;
  /** Duplicated strip shared by neighbouring pages, to allow taping. */
  overlapPt: number;
  dpi: number;
  /** Printed size of the smallest card text. */
  smallestTextPt: number;
  /** True when `smallestTextPt` fell below `MIN_LEGIBLE_PT`. */
  belowLegible: boolean;
  /** Set when `fit` could not be honoured without going below the floor. */
  clampedByLegibility: boolean;
  tiles: PageTile[];
};

export type PagePlanInput = {
  /** Graph size in CSS pixels. */
  graphWidth: number;
  graphHeight: number;
  paper?: PaperId;
  orientation?: Orientation;
  fit?: FitMode;
  /** White border kept on every page, in points. */
  marginPt?: number;
  overlapPt?: number;
  /** Page budget for `compact`. */
  maxPages?: number;
  dpi?: number;
};

export function paperSizePt(
  paper: PaperId,
  orientation: Orientation,
): { widthPt: number; heightPt: number } {
  const [short, long] = PAPER_PT[paper];
  return orientation === "landscape"
    ? { widthPt: long, heightPt: short }
    : { widthPt: short, heightPt: long };
}

function printedTextPt(scale: number): number {
  return SMALLEST_CARD_TEXT_PX * scale * (1 / PX_PER_PT);
}

/** Smallest scale that still keeps card text at `MIN_LEGIBLE_PT`. */
export function legibilityFloorScale(): number {
  return (MIN_LEGIBLE_PT * PX_PER_PT) / SMALLEST_CARD_TEXT_PX;
}

/**
 * Pages needed to cover `span` when each page shows `perPage` and neighbours
 * share an `overlap` strip. Overlap means each page after the first only
 * advances by `perPage - overlap`.
 */
function countPages(span: number, perPage: number, overlap: number): number {
  if (span <= perPage) return 1;
  const advance = perPage - overlap;
  if (advance <= 0) return Number.POSITIVE_INFINITY;
  return Math.ceil((span - overlap) / advance);
}

function gridFor(
  graphWidth: number,
  graphHeight: number,
  scale: number,
  contentWidthPx: number,
  contentHeightPx: number,
  overlapPx: number,
): { columns: number; rows: number } {
  const scaledW = graphWidth * scale;
  const scaledH = graphHeight * scale;
  return {
    columns: countPages(scaledW, contentWidthPx, overlapPx),
    rows: countPages(scaledH, contentHeightPx, overlapPx),
  };
}

export function planPages(input: PagePlanInput): PagePlan {
  const paper = input.paper ?? "a3";
  const orientation = input.orientation ?? "landscape";
  const fit = input.fit ?? "actual";
  const marginPt = Math.max(0, input.marginPt ?? 24);
  const overlapPt = Math.max(0, input.overlapPt ?? 14);
  const maxPages = Math.max(1, input.maxPages ?? 12);
  // 150dpi renders 7.5pt text at ~16 device pixels: sharp on paper, while 200dpi
  // more than doubles both render time and file size for no visible gain.
  const dpi = Math.max(72, input.dpi ?? 150);

  const graphWidth = Math.max(1, input.graphWidth);
  const graphHeight = Math.max(1, input.graphHeight);

  const { widthPt, heightPt } = paperSizePt(paper, orientation);
  const contentWidthPt = Math.max(1, widthPt - marginPt * 2);
  const contentHeightPt = Math.max(1, heightPt - marginPt * 2);
  const contentWidthPx = contentWidthPt * PX_PER_PT;
  const contentHeightPx = contentHeightPt * PX_PER_PT;
  const overlapPx = Math.min(
    overlapPt * PX_PER_PT,
    contentWidthPx / 2,
    contentHeightPx / 2,
  );

  const floor = legibilityFloorScale();
  const singlePageScale = Math.min(
    contentWidthPx / graphWidth,
    contentHeightPx / graphHeight,
  );

  // Legibility is a hard lower bound for every mode except `single`, which the
  // caller asked for explicitly and which reports `belowLegible` instead.
  const lowerBound = Math.min(floor, 1);

  let scale = 1;
  let clampedByLegibility = false;

  if (fit === "single") {
    scale = singlePageScale;
  } else if (fit === "compact") {
    const fits = (candidate: number) => {
      const grid = gridFor(
        graphWidth,
        graphHeight,
        candidate,
        contentWidthPx,
        contentHeightPx,
        overlapPx,
      );
      return grid.columns * grid.rows <= maxPages;
    };
    if (fits(1)) {
      scale = 1;
    } else if (fits(lowerBound)) {
      // Largest scale that still meets the page budget.
      let lo = lowerBound;
      let hi = 1;
      for (let i = 0; i < 40; i += 1) {
        const mid = (lo + hi) / 2;
        if (fits(mid)) lo = mid;
        else hi = mid;
      }
      scale = lo;
    } else {
      // The budget cannot be met while staying readable — spend pages instead.
      scale = lowerBound;
      clampedByLegibility = true;
    }
  }

  scale = Math.min(scale, 1);
  if (!Number.isFinite(scale) || scale <= 0) scale = Math.min(singlePageScale, 1);

  const { columns, rows } = gridFor(
    graphWidth,
    graphHeight,
    scale,
    contentWidthPx,
    contentHeightPx,
    overlapPx,
  );

  const advanceX = Math.max(1, contentWidthPx - overlapPx);
  const advanceY = Math.max(1, contentHeightPx - overlapPx);
  const scaledW = graphWidth * scale;
  const scaledH = graphHeight * scale;

  const tiles: PageTile[] = [];
  let index = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      // Region shown by this page, in printed CSS pixels.
      const spanX = Math.min(contentWidthPx, scaledW);
      const spanY = Math.min(contentHeightPx, scaledH);
      // Clamp the last page back inside the graph so it is not mostly blank.
      const offsetX =
        columns === 1 ? 0 : Math.min(col * advanceX, Math.max(0, scaledW - spanX));
      const offsetY =
        rows === 1 ? 0 : Math.min(row * advanceY, Math.max(0, scaledH - spanY));

      tiles.push({
        index,
        col: col + 1,
        row: row + 1,
        graphX: offsetX / scale,
        graphY: offsetY / scale,
        graphWidth: spanX / scale,
        graphHeight: spanY / scale,
        pageX: marginPt,
        pageY: marginPt,
        pageWidth: spanX / PX_PER_PT,
        pageHeight: spanY / PX_PER_PT,
      });
      index += 1;
    }
  }

  const smallestTextPt = printedTextPt(scale);

  return {
    paper,
    orientation,
    fit,
    scale,
    columns,
    rows,
    pageCount: tiles.length,
    pageWidthPt: widthPt,
    pageHeightPt: heightPt,
    marginPt,
    overlapPt,
    dpi,
    smallestTextPt,
    belowLegible: smallestTextPt < MIN_LEGIBLE_PT - 0.01,
    clampedByLegibility,
    tiles,
  };
}

/** Pixel size of a tile's bitmap at the plan's DPI. */
export function tilePixelSize(
  plan: PagePlan,
  tile: PageTile,
): { pixelWidth: number; pixelHeight: number } {
  const perPt = plan.dpi / 72;
  return {
    pixelWidth: Math.max(1, Math.round(tile.pageWidth * perPt)),
    pixelHeight: Math.max(1, Math.round(tile.pageHeight * perPt)),
  };
}
