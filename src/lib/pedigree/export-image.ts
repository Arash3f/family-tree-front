/**
 * Screenshot helpers for DOM-based exports.
 *
 * The pedigree graph is not captured this way — it is rebuilt as vector graphics
 * in `export-graphic.ts` so it can be printed at any size. This module only
 * covers the person poster, which is a single page of ordinary DOM and is
 * faithfully reproduced by rasterising the element as-is.
 *
 * `html-to-image` is a sizeable dependency, so everything here is reached
 * through a dynamic import from the poster component rather than the tree view.
 */

import { toPng } from "html-to-image";

import { buildPdf, deflateBytes } from "@/lib/pedigree/export-pdf";
import { downloadBlob } from "@/lib/pedigree/download";

/** Keeps element captures inside a comfortable canvas budget. */
const PNG_MAX_PIXELS = 28_000_000;
const PNG_MAX_SIDE = 8192;
const MIN_EDGE = 480;

/** Wait until every image inside `root` has pixels, so captures are not blank. */
export async function waitForElementImages(root: HTMLElement) {
  const images = [...root.querySelectorAll("img")];
  await Promise.all(
    images.map((image) => {
      if (image.complete) {
        return image.decode?.().catch(() => undefined) ?? Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      });
    }),
  );
}

export async function captureElementPng(
  element: HTMLElement,
  backgroundColor: string,
): Promise<string> {
  const width = Math.max(MIN_EDGE, Math.ceil(element.scrollWidth));
  const height = Math.max(MIN_EDGE, Math.ceil(element.scrollHeight));
  const fits = (ratio: number) =>
    width * ratio * (height * ratio) <= PNG_MAX_PIXELS &&
    Math.max(width, height) * ratio <= PNG_MAX_SIDE;
  // Prefer the sharpest ratio the budget allows; 3x is retina-crisp on paper.
  const pixelRatio = fits(3) ? 3 : fits(2) ? 2 : 1;

  return toPng(element, {
    backgroundColor,
    cacheBust: true,
    pixelRatio,
    width,
    height,
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("pdf-image"));
    image.src = src;
  });
}

/**
 * Wrap a single PNG in a one-page PDF sized to the image.
 *
 * Used for the person poster, which is already page-shaped. The graph takes the
 * paginated route in `export-raster.ts` instead.
 */
async function pngDataUrlToPdfBlob(
  dataUrl: string,
  backgroundColor = "#ffffff",
  title?: string,
): Promise<Blob> {
  const image = await loadImage(dataUrl);
  const width = Math.max(1, image.naturalWidth || image.width);
  const height = Math.max(1, image.naturalHeight || image.height);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("pdf-canvas");
  try {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0);

    const { data } = ctx.getImageData(0, 0, width, height);
    const rgb = new Uint8Array(width * height * 3);
    for (let i = 0, o = 0; i < data.length; i += 4, o += 3) {
      rgb[o] = data[i]!;
      rgb[o + 1] = data[i + 1]!;
      rgb[o + 2] = data[i + 2]!;
    }

    // CSS pixels are 96dpi; PDF points are 72dpi.
    const widthPt = (width * 72) / 96;
    const heightPt = (height * 72) / 96;
    return buildPdf(
      [
        {
          widthPt,
          heightPt,
          image: {
            bytes: await deflateBytes(rgb),
            pixelWidth: width,
            pixelHeight: height,
            filter: "FlateDecode",
          },
          xPt: 0,
          yPt: 0,
          drawWidthPt: widthPt,
          drawHeightPt: heightPt,
        },
      ],
      { title },
    );
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

export async function downloadPdfFromPng(
  dataUrl: string,
  filename: string,
  backgroundColor = "#ffffff",
) {
  const blob = await pngDataUrlToPdfBlob(dataUrl, backgroundColor, filename);
  downloadBlob(blob, filename, "pdf");
}
