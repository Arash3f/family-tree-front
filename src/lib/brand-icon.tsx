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
