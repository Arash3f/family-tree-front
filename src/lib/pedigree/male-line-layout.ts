/**
 * Compact top-down layout for a male-line name chart.
 *
 * Each person sits in a tight name rectangle. Parents connect to children with
 * a thin stem, a shared horizontal rail, and short drops.
 */

import type { MaleLineNode } from "@/lib/pedigree/male-line";

export type MaleLineBox = {
  id: string;
  label: string;
  /** Top-left of the label box. */
  x: number;
  y: number;
  w: number;
  h: number;
};

export type MaleLineEdge = {
  /** Polyline points as "x,y x,y …" for an SVG `<polyline>`. */
  points: string;
};

export type MaleLineGraphic = {
  boxes: MaleLineBox[];
  edges: MaleLineEdge[];
  width: number;
  height: number;
};

const FONT_SIZE = 12.5;
const BOX_PAD_X = 7;
const BOX_PAD_Y = 4;
const LABEL_H = FONT_SIZE + BOX_PAD_Y * 2;
/** Horizontal gap between sibling subtrees. */
const H_GAP = 18;
/** Vertical space from label bottom to next generation's label top. */
const V_GAP = 30;
const PAD = 18;

/** Approximate Vazirmatn advance at FONT_SIZE — dense but rarely clipped. */
function labelWidth(label: string): number {
  let units = 0;
  for (const ch of label) {
    const code = ch.codePointAt(0) ?? 0;
    // Arabic / Persian block tends to run slightly wider than Latin digits.
    if (code >= 0x0600 && code <= 0x06ff) units += 0.72;
    else if (code <= 0x7f) units += 0.58;
    else units += 0.66;
  }
  return Math.max(FONT_SIZE * 1.2, units * FONT_SIZE) + BOX_PAD_X * 2;
}

type Sized = {
  node: MaleLineNode;
  w: number;
  h: number;
  labelW: number;
  children: Sized[];
};

function measure(node: MaleLineNode): Sized {
  const labelW = labelWidth(node.label);
  const children = node.children.map(measure);
  if (children.length === 0) {
    return { node, w: labelW, h: LABEL_H, labelW, children };
  }
  const kidsW =
    children.reduce((sum, child) => sum + child.w, 0) +
    H_GAP * (children.length - 1);
  return {
    node,
    w: Math.max(labelW, kidsW),
    h: LABEL_H + V_GAP + Math.max(...children.map((child) => child.h)),
    labelW,
    children,
  };
}

type Placed = {
  id: string;
  label: string;
  cx: number;
  y: number;
  w: number;
  h: number;
  children: Placed[];
};

function place(sized: Sized, left: number, top: number): Placed {
  const cx = left + sized.w / 2;
  const self: Placed = {
    id: sized.node.id,
    label: sized.node.label,
    cx,
    y: top,
    w: sized.labelW,
    h: LABEL_H,
    children: [],
  };

  if (sized.children.length === 0) return self;

  const kidsW =
    sized.children.reduce((sum, child) => sum + child.w, 0) +
    H_GAP * (sized.children.length - 1);
  let x = left + (sized.w - kidsW) / 2;
  const childTop = top + LABEL_H + V_GAP;
  for (const child of sized.children) {
    self.children.push(place(child, x, childTop));
    x += child.w + H_GAP;
  }
  return self;
}

function collect(
  placed: Placed,
  boxes: MaleLineBox[],
  edges: MaleLineEdge[],
): void {
  boxes.push({
    id: placed.id,
    label: placed.label,
    x: placed.cx - placed.w / 2,
    y: placed.y,
    w: placed.w,
    h: placed.h,
  });

  if (placed.children.length === 0) return;

  const parentBottom = placed.y + placed.h;
  const railY = parentBottom + V_GAP / 2;
  const first = placed.children[0]!;
  const last = placed.children[placed.children.length - 1]!;

  // Stem from parent to the rail.
  edges.push({
    points: `${placed.cx},${parentBottom} ${placed.cx},${railY}`,
  });

  if (placed.children.length === 1) {
    edges.push({
      points: `${first.cx},${railY} ${first.cx},${first.y}`,
    });
  } else {
    edges.push({
      points: `${first.cx},${railY} ${last.cx},${railY}`,
    });
    for (const child of placed.children) {
      edges.push({
        points: `${child.cx},${railY} ${child.cx},${child.y}`,
      });
    }
  }

  for (const child of placed.children) collect(child, boxes, edges);
}

export function layoutMaleLine(root: MaleLineNode): MaleLineGraphic {
  const sized = measure(root);
  const placed = place(sized, PAD, PAD);
  const boxes: MaleLineBox[] = [];
  const edges: MaleLineEdge[] = [];
  collect(placed, boxes, edges);

  let maxX = PAD;
  let maxY = PAD;
  for (const box of boxes) {
    maxX = Math.max(maxX, box.x + box.w);
    maxY = Math.max(maxY, box.y + box.h);
  }

  return {
    boxes,
    edges,
    width: Math.ceil(maxX + PAD),
    height: Math.ceil(maxY + PAD),
  };
}

export const MALE_LINE_FONT_SIZE = FONT_SIZE;
