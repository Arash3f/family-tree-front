/**
 * Turns a `PedigreeGraphic` into pixels.
 *
 * Rendering always happens tile by tile: each tile gets its own small SVG whose
 * `viewBox` frames just that region and whose intrinsic size equals the target
 * bitmap. Measured against cropping one full-scale SVG, this produces
 * byte-identical output roughly forty times faster and keeps peak memory
 * proportional to a tile rather than to the whole tree.
 *
 * Text is painted onto the canvas after the SVG so it can use the document's
 * webfonts, which an `<img>`-loaded SVG cannot reach.
 */

import {
  buildPdf,
  deflateBytes,
  type PdfImage,
  type PdfPage,
} from "@/lib/pedigree/export-pdf";
import {
  planPages,
  tilePixelSize,
  type FitMode,
  type Orientation,
  type PagePlan,
  type PaperId,
} from "@/lib/pedigree/export-paginate";
import type { PedigreeGraphic, TextRun } from "@/lib/pedigree/export-graphic";

/** Chromium tolerates far more, but staying modest keeps memory predictable. */
const PNG_MAX_SIDE = 16384;
const PNG_MAX_PIXELS = 120_000_000;
/** Preferred oversampling for screen-resolution PNGs. */
const PNG_TARGET_SCALE = 2;
/** Tile edge used when composing a single PNG, in output pixels. */
const PNG_TILE_SIDE = 2048;

export type RenderProgress = (completed: number, total: number) => void;

type Region = { x: number; y: number; width: number; height: number };

export type PngRender = {
  dataUrl: string;
  pixelWidth: number;
  pixelHeight: number;
  /** Graph pixels per output pixel. Below 1 means the tree was shrunk. */
  scale: number;
  /** True when `scale` fell under 1 and fine print may suffer. */
  downscaled: boolean;
};

export type PdfRender = {
  blob: Blob;
  plan: PagePlan;
};

function canvasFontFamily(locale: string): string {
  const root = getComputedStyle(document.documentElement);
  const read = (name: string) => root.getPropertyValue(name).trim();
  const families =
    locale === "fa"
      ? [read("--font-vazirmatn"), "Tahoma", "Segoe UI", "sans-serif"]
      : [
          read("--font-fraunces"),
          read("--font-source-sans"),
          "Georgia",
          "Segoe UI",
          "sans-serif",
        ];
  return families.filter(Boolean).join(", ");
}

/**
 * Shorten `text` until it fits `maxWidth`, ending with an ellipsis.
 *
 * The alternative — passing `maxWidth` to `fillText` — condenses glyphs instead
 * of dropping them, which visibly distorts long Persian names.
 */
export function fitText(
  measure: (value: string) => number,
  text: string,
  maxWidth: number,
): string {
  if (maxWidth <= 0) return "";
  if (measure(text) <= maxWidth) return text;

  const ellipsis = "…";
  if (measure(ellipsis) > maxWidth) return "";
  // Split on code points so surrogate pairs are never cut in half.
  const chars = Array.from(text);
  let low = 0;
  let high = chars.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (measure(chars.slice(0, mid).join("") + ellipsis) <= maxWidth) low = mid;
    else high = mid - 1;
  }
  return low > 0 ? `${chars.slice(0, low).join("")}${ellipsis}` : ellipsis;
}

/** Widest text run, used to decide how far outside a tile to look for text. */
function textGutter(texts: TextRun[]): number {
  let widest = 0;
  for (const run of texts) {
    const estimate = run.maxWidth ?? run.text.length * run.size;
    if (estimate > widest) widest = estimate;
  }
  return widest + 16;
}

function paintTexts(
  ctx: CanvasRenderingContext2D,
  texts: TextRun[],
  locale: string,
  region: Region,
  gutter: number,
) {
  const family = canvasFontFamily(locale);
  const top = region.y - gutter;
  const bottom = region.y + region.height + gutter;
  const left = region.x - gutter;
  const right = region.x + region.width + gutter;

  for (const run of texts) {
    // Skip anything that cannot land inside this tile.
    if (run.y < top || run.y > bottom) continue;
    if (run.x < left || run.x > right) continue;

    ctx.save();
    ctx.globalAlpha = run.opacity ?? 1;
    ctx.direction = run.rtl ? "rtl" : "ltr";
    ctx.textAlign = run.align;
    ctx.textBaseline = "alphabetic";
    ctx.font = `${run.weight} ${run.size}px ${family}`;
    ctx.fillStyle = run.fill;
    const label =
      run.maxWidth != null
        ? fitText((value) => ctx.measureText(value).width, run.text, run.maxWidth)
        : run.text;
    if (label) ctx.fillText(label, run.x, run.y);
    ctx.restore();
  }
}

function loadSvg(markup: string): Promise<{ image: HTMLImageElement; url: string }> {
  const url = URL.createObjectURL(
    new Blob([markup], { type: "image/svg+xml;charset=utf-8" }),
  );
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ image, url });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("svg-load"));
    };
    image.src = url;
  });
}

function tileSvg(
  body: string,
  region: Region,
  pixelWidth: number,
  pixelHeight: number,
): string {
  // Intrinsic size equals the bitmap, so the SVG rasterises at final resolution.
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${pixelWidth}" height="${pixelHeight}" ` +
    `viewBox="${region.x} ${region.y} ${region.width} ${region.height}">${body}</svg>`
  );
}

/** Draw one region of the graphic onto `ctx` at `destX`/`destY`. */
async function drawRegion(
  ctx: CanvasRenderingContext2D,
  graphic: PedigreeGraphic,
  region: Region,
  destX: number,
  destY: number,
  pixelWidth: number,
  pixelHeight: number,
  locale: string,
  gutter: number,
) {
  const { image, url } = await loadSvg(
    tileSvg(graphic.body, region, pixelWidth, pixelHeight),
  );
  try {
    ctx.drawImage(image, destX, destY, pixelWidth, pixelHeight);
  } finally {
    URL.revokeObjectURL(url);
  }

  const k = pixelWidth / region.width;
  ctx.save();
  ctx.setTransform(k, 0, 0, k, destX - region.x * k, destY - region.y * k);
  // Keep text inside the tile even when a glyph would spill past the edge.
  ctx.beginPath();
  ctx.rect(region.x, region.y, region.width, region.height);
  ctx.clip();
  paintTexts(ctx, graphic.texts, locale, region, gutter);
  ctx.restore();
}

function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.dir = "ltr";
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-context");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return { canvas, ctx };
}

/** Free the backing store immediately rather than waiting for collection. */
function releaseCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
}

async function waitForFonts() {
  try {
    await document.fonts.ready;
  } catch {
    // Font loading is best-effort; a fallback face still renders.
  }
}

/** Largest whole-graph scale that respects the single-image pixel budget. */
export function pngScaleFor(
  width: number,
  height: number,
  targetScale = PNG_TARGET_SCALE,
): number {
  return Math.min(
    targetScale,
    PNG_MAX_SIDE / Math.max(width, height, 1),
    Math.sqrt(PNG_MAX_PIXELS / Math.max(width * height, 1)),
  );
}

/**
 * Compose the whole graphic into one PNG.
 *
 * `maxEdge` lets callers ask for a cheap screen-sized render; leaving it out
 * produces the highest quality the pixel budget allows.
 */
export async function renderPedigreePng(opts: {
  graphic: PedigreeGraphic;
  background: string;
  locale: string;
  maxEdge?: number;
  targetScale?: number;
  onProgress?: RenderProgress;
}): Promise<PngRender> {
  const { graphic } = opts;
  await waitForFonts();

  let scale = pngScaleFor(graphic.width, graphic.height, opts.targetScale);
  if (opts.maxEdge) {
    scale = Math.min(
      scale,
      opts.maxEdge / Math.max(graphic.width, graphic.height, 1),
    );
  }
  if (!Number.isFinite(scale) || scale <= 0) scale = 1;

  const pixelWidth = Math.max(1, Math.round(graphic.width * scale));
  const pixelHeight = Math.max(1, Math.round(graphic.height * scale));

  const { canvas, ctx } = createCanvas(pixelWidth, pixelHeight);
  try {
    ctx.fillStyle = opts.background;
    ctx.fillRect(0, 0, pixelWidth, pixelHeight);

    // Tiles are laid out on an integer pixel grid so neighbours line up exactly.
    const cols = Math.ceil(pixelWidth / PNG_TILE_SIDE);
    const rows = Math.ceil(pixelHeight / PNG_TILE_SIDE);
    const total = cols * rows;
    const gutter = textGutter(graphic.texts);
    let done = 0;

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const destX = col * PNG_TILE_SIDE;
        const destY = row * PNG_TILE_SIDE;
        const tileW = Math.min(PNG_TILE_SIDE, pixelWidth - destX);
        const tileH = Math.min(PNG_TILE_SIDE, pixelHeight - destY);
        await drawRegion(
          ctx,
          graphic,
          {
            x: destX / scale,
            y: destY / scale,
            width: tileW / scale,
            height: tileH / scale,
          },
          destX,
          destY,
          tileW,
          tileH,
          opts.locale,
          gutter,
        );
        done += 1;
        opts.onProgress?.(done, total);
      }
    }

    const dataUrl = canvas.toDataURL("image/png");
    if (!dataUrl.startsWith("data:image/png") || dataUrl.length < 2000) {
      throw new Error("export-png");
    }
    return {
      dataUrl,
      pixelWidth,
      pixelHeight,
      scale,
      downscaled: scale < 1,
    };
  } finally {
    releaseCanvas(canvas);
  }
}

async function canvasToJpeg(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", quality);
  });
  if (!blob) throw new Error("pdf-jpeg");
  return new Uint8Array(await blob.arrayBuffer());
}

/** Raw RGB for `/FlateDecode`, dropping the alpha channel the PDF cannot use. */
async function canvasToFlateRgb(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): Promise<Uint8Array> {
  const { data } = ctx.getImageData(0, 0, width, height);
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0, o = 0; i < data.length; i += 4, o += 3) {
    rgb[o] = data[i]!;
    rgb[o + 1] = data[i + 1]!;
    rgb[o + 2] = data[i + 2]!;
  }
  return deflateBytes(rgb);
}

export type PdfQuality = "lossless" | "compact";

/**
 * Render the graphic across as many pages as the plan calls for.
 *
 * `lossless` keeps hairlines and small text free of ringing, which matters far
 * more here than file size; `compact` falls back to JPEG for sharing.
 */
export async function renderPedigreePdf(opts: {
  graphic: PedigreeGraphic;
  background: string;
  locale: string;
  title?: string;
  paper?: PaperId;
  orientation?: Orientation;
  fit?: FitMode;
  maxPages?: number;
  dpi?: number;
  quality?: PdfQuality;
  onProgress?: RenderProgress;
}): Promise<PdfRender> {
  const { graphic } = opts;
  await waitForFonts();

  const plan = planPages({
    graphWidth: graphic.width,
    graphHeight: graphic.height,
    paper: opts.paper,
    orientation: opts.orientation,
    fit: opts.fit,
    maxPages: opts.maxPages,
    dpi: opts.dpi,
  });

  const quality = opts.quality ?? "lossless";
  const gutter = textGutter(graphic.texts);
  const pages: PdfPage[] = [];

  for (const tile of plan.tiles) {
    const { pixelWidth, pixelHeight } = tilePixelSize(plan, tile);
    const { canvas, ctx } = createCanvas(pixelWidth, pixelHeight);
    try {
      ctx.fillStyle = opts.background;
      ctx.fillRect(0, 0, pixelWidth, pixelHeight);
      await drawRegion(
        ctx,
        graphic,
        {
          x: tile.graphX,
          y: tile.graphY,
          width: tile.graphWidth,
          height: tile.graphHeight,
        },
        0,
        0,
        pixelWidth,
        pixelHeight,
        opts.locale,
        gutter,
      );

      const image: PdfImage =
        quality === "lossless"
          ? {
              bytes: await canvasToFlateRgb(ctx, pixelWidth, pixelHeight),
              pixelWidth,
              pixelHeight,
              filter: "FlateDecode",
            }
          : {
              bytes: await canvasToJpeg(canvas, 0.94),
              pixelWidth,
              pixelHeight,
              filter: "DCTDecode",
            };

      pages.push({
        widthPt: plan.pageWidthPt,
        heightPt: plan.pageHeightPt,
        image,
        xPt: tile.pageX,
        yPt: tile.pageY,
        drawWidthPt: tile.pageWidth,
        drawHeightPt: tile.pageHeight,
      });
    } finally {
      releaseCanvas(canvas);
    }
    opts.onProgress?.(pages.length, plan.tiles.length);
  }

  return { blob: buildPdf(pages, { title: opts.title }), plan };
}
