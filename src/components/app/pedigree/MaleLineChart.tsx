"use client";

import type { MaleLineGraphic } from "@/lib/pedigree/male-line-layout";
import { MALE_LINE_FONT_SIZE } from "@/lib/pedigree/male-line-layout";
import styles from "./MaleLineChart.module.css";

type Props = {
  graphic: MaleLineGraphic;
  /** Ink on paper; kept as props so capture uses the same colours. */
  ink?: string;
  rail?: string;
  paper?: string;
  rtl?: boolean;
};

/**
 * Male-line chart: name rectangles + thin connector polylines.
 */
export function MaleLineChart({
  graphic,
  ink = "#1c1917",
  rail = "#a8a29e",
  paper = "#f7f4ef",
  rtl = true,
}: Props) {
  return (
    <svg
      className={styles.svg}
      width={graphic.width}
      height={graphic.height}
      viewBox={`0 0 ${graphic.width} ${graphic.height}`}
      role="img"
      style={{ background: paper }}
    >
      {graphic.edges.map((edge, index) => (
        <polyline
          key={`e-${index}`}
          points={edge.points}
          fill="none"
          stroke={rail}
          strokeWidth={1}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      {graphic.boxes.map((box) => (
        <g key={box.id}>
          <rect
            x={box.x}
            y={box.y}
            width={box.w}
            height={box.h}
            fill={paper}
            stroke={ink}
            strokeWidth={1}
            rx={1.5}
          />
          <text
            x={box.x + box.w / 2}
            y={box.y + box.h / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            direction={rtl ? "rtl" : "ltr"}
            fill={ink}
            style={{
              fontSize: MALE_LINE_FONT_SIZE,
              fontWeight: 600,
              fontFamily: "var(--font-body), Vazirmatn, sans-serif",
            }}
          >
            {box.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
