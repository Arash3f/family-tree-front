import type { CSSProperties } from "react";
import { ImageResponse } from "next/og";

/** Shared brand mark used by apple-icon / opengraph / generated PNGs. */
export function brandMarkTree(opts?: {
  box?: number;
  trunkTop?: number;
}): React.ReactElement {
  const box = opts?.box ?? 118;
  const scale = box / 118;
  const s = (n: number) => Math.round(n * scale);
  const node = (left: number, top: number, diameter: number): CSSProperties => ({
    position: "absolute",
    left: s(left),
    top: s(top),
    width: s(diameter),
    height: s(diameter),
    borderRadius: s(diameter),
    background: "#ffffff",
  });

  return (
    <div
      style={{
        position: "relative",
        width: box,
        height: box,
        display: "flex",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: s(57),
          top: s(opts?.trunkTop ?? 28),
          width: s(4),
          height: s(28),
          background: "#ffffff",
          borderRadius: 2,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: s(34),
          top: s(52),
          width: s(28),
          height: s(4),
          background: "#ffffff",
          borderRadius: 2,
          transform: "rotate(38deg)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: s(56),
          top: s(52),
          width: s(28),
          height: s(4),
          background: "#ffffff",
          borderRadius: 2,
          transform: "rotate(-38deg)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: s(20),
          top: s(76),
          width: s(20),
          height: s(3.5),
          background: "#ffffff",
          borderRadius: 2,
          transform: "rotate(42deg)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: s(34),
          top: s(76),
          width: s(18),
          height: s(3.5),
          background: "#ffffff",
          borderRadius: 2,
          transform: "rotate(-28deg)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: s(80),
          top: s(76),
          width: s(20),
          height: s(3.5),
          background: "#ffffff",
          borderRadius: 2,
          transform: "rotate(-42deg)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: s(66),
          top: s(76),
          width: s(18),
          height: s(3.5),
          background: "#ffffff",
          borderRadius: 2,
          transform: "rotate(28deg)",
        }}
      />
      <div style={node(50, 20, 18)} />
      <div style={node(52, 50, 14)} />
      <div style={node(28, 72, 13)} />
      <div style={node(77, 72, 13)} />
      <div style={node(14, 94, 10)} />
      <div style={node(38, 94, 10)} />
      <div style={node(70, 94, 10)} />
      <div style={node(94, 94, 10)} />
    </div>
  );
}

export function brandIconResponse(size: number, radius = Math.round(size * 0.22)) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0d6e67",
          borderRadius: radius,
        }}
      >
        {brandMarkTree({ box: Math.round(size * 0.66) })}
      </div>
    ),
    { width: size, height: size },
  );
}

/** Load a Google Font file suitable for `ImageResponse` (TTF/OTF, not woff2). */
export async function loadGoogleFont(
  family: string,
  text: string,
  weight = 700,
): Promise<ArrayBuffer> {
  const cssUrl =
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}` +
    `:wght@${weight}&text=${encodeURIComponent(text)}`;
  const css = await fetch(cssUrl, {
    headers: {
      // Old Safari UA so Google returns truetype/opentype instead of woff2.
      "User-Agent":
        "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1",
    },
  }).then((res) => res.text());

  const match = /src: url\(([^)]+)\) format\('(opentype|truetype)'\)/.exec(css);
  if (!match?.[1]) {
    throw new Error(`Could not resolve Google Font file for ${family}`);
  }
  return fetch(match[1]).then((res) => res.arrayBuffer());
}

export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

/** Landing Open Graph / Twitter share image (1200×630). */
export async function brandOpenGraphResponse(opts: {
  brand: string;
  headline: string;
  locale: string;
  dir: "ltr" | "rtl";
}) {
  const sample = `${opts.brand} ${opts.headline}`;
  const fontFamily = opts.locale === "fa" ? "Vazirmatn" : "Source Sans 3";
  const fontData = await loadGoogleFont(fontFamily, sample, 700);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #062f2c 0%, #0d6e67 55%, #14968c 100%)",
          color: "#ffffff",
          direction: opts.dir,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 28,
            maxWidth: 720,
            flex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 36,
              fontWeight: 700,
              letterSpacing: opts.dir === "ltr" ? "0.04em" : 0,
              opacity: 0.9,
              fontFamily,
            }}
          >
            {opts.brand}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 64,
              fontWeight: 700,
              lineHeight: 1.15,
              fontFamily,
            }}
          >
            {opts.headline}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            width: 220,
            height: 220,
            borderRadius: 48,
            background: "rgba(255,255,255,0.12)",
            alignItems: "center",
            justifyContent: "center",
            marginInlineStart: 40,
          }}
        >
          {brandMarkTree({ box: 150, trunkTop: 24 })}
        </div>
      </div>
    ),
    {
      ...OG_IMAGE_SIZE,
      fonts: [{ name: fontFamily, data: fontData, style: "normal", weight: 700 }],
    },
  );
}
