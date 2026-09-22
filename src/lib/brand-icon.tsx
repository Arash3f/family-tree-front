import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import opentype from "opentype.js";

/** Brand assets shipped in `public/brand` (copied into the Docker runner as-is). */
const BRAND_DIR = path.join(process.cwd(), "public", "brand");

/**
 * Fonts are bundled, not fetched: the server cannot count on reaching Google
 * Fonts. Vazirmatn is the full face (the Arabic web subset has no Latin
 * punctuation, so a headline's trailing "." would vanish).
 */
const FRAUNCES_FILE = "fonts/fraunces-700.woff";
const VAZIRMATN_FILE = "fonts/vazirmatn-800.ttf";

export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

const TEXT_COLOR = "#e8f2f4";
const BRAND_COLOR = "#5eead4";
const BRAND_SIZE = 38;
const HEADLINE_SIZE = 70;
const HEADLINE_LINE_HEIGHT = 1.12;
const TEXT_MAX_WIDTH = 700;

const ZWNJ = "\u200c";
/** Neutral punctuation that must sit at the visual end (left) of an RTL word. */
const TRAILING_PUNCTUATION = /^(.*?)([.!?:;…]+)$/u;

type OgFont = { name: string; data: Buffer; style: "normal"; weight: 700 };

let vazirmatn: Promise<opentype.Font> | undefined;

function loadVazirmatn(): Promise<opentype.Font> {
  vazirmatn ??= readFile(path.join(BRAND_DIR, VAZIRMATN_FILE)).then((buf) =>
    opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)),
  );
  return vazirmatn;
}

/** Runs inside one RTL word: ZWNJ-separated parts, then trailing punctuation on its own. */
function rtlRuns(word: string): string[] {
  return word.split(ZWNJ).flatMap((part) => {
    const match = TRAILING_PUNCTUATION.exec(part);
    return match?.[1] ? [match[1], match[2]] : [part];
  });
}

/**
 * Lays Persian text out as outlined SVG paths, right-aligned and wrapped to
 * `maxWidth`, and returns it as an image Satori can place.
 *
 * Satori (behind `ImageResponse`) shapes Arabic-script letters but has no bidi:
 * it orders runs left-to-right, mis-measures joined words, and drops glyphs its
 * fonts lack. opentype.js shapes each run correctly, so only the run order is
 * done here: runs are placed from the right edge leftwards, in logical order.
 *
 * @param text - Persian text; words split on spaces, joins broken by ZWNJ
 * @param font - parsed font covering every character of `text`
 * @param size - font size in px
 * @param opts - `maxWidth` wraps greedily; `lineHeight` is a multiple of `size`
 *
 * @returns `src` (SVG data URI) plus its pixel `width` and `height`
 */
function rtlTextImage(
  text: string,
  font: opentype.Font,
  size: number,
  opts: { maxWidth: number; lineHeight: number; color: string },
): { src: string; width: number; height: number } {
  const advance = (run: string) => font.getAdvanceWidth(run, size);
  const space = advance(" ");
  const words = text.split(" ").map((word) => {
    const runs = rtlRuns(word);
    return { runs, width: runs.reduce((sum, run) => sum + advance(run), 0) };
  });

  const lines: { words: typeof words; width: number }[] = [];
  for (const word of words) {
    const line = lines.at(-1);
    if (line && line.width + space + word.width <= opts.maxWidth) {
      line.words.push(word);
      line.width += space + word.width;
    } else {
      lines.push({ words: [word], width: word.width });
    }
  }

  const scale = size / font.unitsPerEm;
  const width = Math.ceil(Math.max(...lines.map((line) => line.width)));
  const height = Math.ceil(
    (lines.length - 1) * opts.lineHeight * size + (font.ascender - font.descender) * scale,
  );

  let d = "";
  lines.forEach((line, i) => {
    const baseline = font.ascender * scale + i * opts.lineHeight * size;
    let x = width;
    for (const word of line.words) {
      for (const run of word.runs) {
        x -= advance(run);
        d += font.getPath(run, x, baseline, size).toPathData(2);
      }
      x -= space;
    }
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><path fill="${opts.color}" d="${d}"/></svg>`;
  return { src: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`, width, height };
}

/** Brand line + headline: Satori text for LTR, pre-shaped images for RTL. */
async function ogText(opts: { brand: string; headline: string; rtl: boolean }): Promise<{
  brand: React.ReactNode;
  headline: React.ReactNode;
  fonts: OgFont[];
}> {
  if (!opts.rtl) {
    const fraunces = await readFile(path.join(BRAND_DIR, FRAUNCES_FILE));
    return {
      brand: opts.brand,
      headline: opts.headline,
      fonts: [{ name: "Fraunces", data: fraunces, style: "normal", weight: 700 }],
    };
  }

  const font = await loadVazirmatn();
  const layout = { maxWidth: TEXT_MAX_WIDTH, lineHeight: HEADLINE_LINE_HEIGHT };
  const brand = rtlTextImage(opts.brand, font, BRAND_SIZE, { ...layout, color: BRAND_COLOR });
  const headline = rtlTextImage(opts.headline, font, HEADLINE_SIZE, {
    ...layout,
    color: TEXT_COLOR,
  });
  /* eslint-disable @next/next/no-img-element -- rendered by Satori, not the browser */
  return {
    brand: <img src={brand.src} width={brand.width} height={brand.height} alt="" />,
    headline: <img src={headline.src} width={headline.width} height={headline.height} alt="" />,
    fonts: [],
  };
  /* eslint-enable @next/next/no-img-element */
}

/** Landing Open Graph / Twitter share image (1200×630). */
export async function brandOpenGraphResponse(opts: {
  brand: string;
  headline: string;
  dir: "ltr" | "rtl";
}) {
  const rtl = opts.dir === "rtl";
  const [mark, text] = await Promise.all([
    readFile(path.join(BRAND_DIR, "mark-tile-512.png"), "base64"),
    ogText({ brand: opts.brand, headline: opts.headline, rtl }),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          // Satori ignores `direction`, so RTL mirrors the row explicitly.
          flexDirection: rtl ? "row-reverse" : "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 48,
          padding: "72px 88px",
          backgroundColor: "#070d11",
          // the glow sits behind the mark, which RTL mirrors to the left
          backgroundImage: `radial-gradient(circle at ${rtl ? 22 : 78}% 30%, rgba(45,212,191,0.30) 0%, rgba(7,13,17,0) 55%), linear-gradient(135deg, #070d11 0%, #0a1c1e 55%, #0b3532 100%)`,
          color: TEXT_COLOR,
          fontFamily: "Fraunces",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: rtl ? "flex-end" : "flex-start",
            gap: 26,
            maxWidth: TEXT_MAX_WIDTH,
            flex: 1,
          }}
        >
          <div style={{ display: "flex", fontSize: BRAND_SIZE, color: BRAND_COLOR }}>
            {text.brand}
          </div>
          <div
            style={{ display: "flex", fontSize: HEADLINE_SIZE, lineHeight: HEADLINE_LINE_HEIGHT }}
          >
            {text.headline}
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- rendered by Satori, not the browser */}
        <img src={`data:image/png;base64,${mark}`} width={260} height={260} alt="" />
      </div>
    ),
    { ...OG_IMAGE_SIZE, fonts: text.fonts },
  );
}
