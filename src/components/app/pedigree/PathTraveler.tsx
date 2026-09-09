"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  ViewportPortal,
  useNodesInitialized,
  useReactFlow,
  type Edge,
  type InternalNode,
} from "@xyflow/react";
import {
  PERSON_NODE_HEIGHT,
  PERSON_NODE_WIDTH,
} from "@/lib/pedigree/layout";
import styles from "./PathTraveler.module.css";

type Point = { x: number; y: number };

type PathSegment = {
  path: SVGPathElement;
  reverse: boolean;
  length: number;
};

function subscribeReducedMotion(onStoreChange: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function nodeCenter(node: InternalNode | undefined): Point | null {
  if (!node) return null;
  const width = node.measured?.width ?? PERSON_NODE_WIDTH;
  const height = node.measured?.height ?? PERSON_NODE_HEIGHT;
  return {
    x: node.internals.positionAbsolute.x + width / 2,
    y: node.internals.positionAbsolute.y + height / 2,
  };
}

function edgeSvgPath(edgeId: string): SVGPathElement | null {
  if (typeof document === "undefined") return null;
  return document.querySelector(
    `.react-flow__edge[data-id="${CSS.escape(edgeId)}"] path.react-flow__edge-path`,
  );
}

function pathEndpoints(
  path: SVGPathElement,
  length: number,
): { start: Point; end: Point } {
  const a = path.getPointAtLength(0);
  const b = path.getPointAtLength(length);
  return { start: { x: a.x, y: a.y }, end: { x: b.x, y: b.y } };
}

function coupleParentOf(
  personId: string,
  getInternalNode: (id: string) => InternalNode | undefined,
): string | undefined {
  return getInternalNode(personId)?.parentId ?? undefined;
}

/**
 * Shortest drawn-edge chain from one path person to the next.
 *
 * Uses React Flow source/target topology — not bloated `personIds` lists —
 * so spouse/drop/child edges in the same marriage are not walked as a bag.
 * Other people on the relation path are blocked as intermediate nodes so
 * BFS cannot detour through later hops.
 *
 * Orientation is decided later from geometry (SVG path ends vs cursor/goal),
 * because RF path direction does not always match the hop we are walking.
 */
function edgeIdsBetween(
  pathEdges: Edge[],
  fromId: string,
  toId: string,
  pathPeople: Set<string>,
  getInternalNode: (id: string) => InternalNode | undefined,
): string[] {
  if (fromId === toId) return [];

  const direct = pathEdges.find(
    (edge) =>
      (edge.source === fromId && edge.target === toId) ||
      (edge.source === toId && edge.target === fromId),
  );
  if (direct) return [direct.id];

  type Link = { edgeId: string; next: string };
  const adj = new Map<string, Link[]>();

  const addLink = (from: string, link: Link) => {
    if (!adj.has(from)) adj.set(from, []);
    adj.get(from)!.push(link);
  };

  for (const edge of pathEdges) {
    addLink(edge.source, { edgeId: edge.id, next: edge.target });
    addLink(edge.target, { edgeId: edge.id, next: edge.source });
  }

  // People nested in a couple box only connect through the couple node.
  for (const personId of pathPeople) {
    const coupleId = coupleParentOf(personId, getInternalNode);
    if (!coupleId) continue;
    addLink(personId, { edgeId: "", next: coupleId });
    addLink(coupleId, { edgeId: "", next: personId });
  }

  const goals = new Set<string>([toId]);
  const toCouple = coupleParentOf(toId, getInternalNode);
  if (toCouple) goals.add(toCouple);

  const isBlocked = (nodeId: string): boolean => {
    if (nodeId === fromId || goals.has(nodeId)) return false;
    return pathPeople.has(nodeId);
  };

  const queue: string[] = [fromId];
  const seen = new Set<string>([fromId]);
  const prev = new Map<string, { edgeId: string; from: string }>();

  let reached: string | null = null;
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (goals.has(cur) && cur !== fromId) {
      reached = cur;
      break;
    }
    for (const step of adj.get(cur) ?? []) {
      if (seen.has(step.next)) continue;
      if (isBlocked(step.next)) continue;
      seen.add(step.next);
      prev.set(step.next, { edgeId: step.edgeId, from: cur });
      queue.push(step.next);
    }
  }

  if (!reached || !prev.has(reached)) return [];

  const ids: string[] = [];
  let cursor = reached;
  while (cursor !== fromId) {
    const step = prev.get(cursor);
    if (!step) break;
    if (step.edgeId) ids.push(step.edgeId);
    cursor = step.from;
  }
  ids.reverse();
  return ids;
}

/** Pick travel direction so we enter near `from` and leave near `toward`. */
function segmentReverse(
  start: Point,
  end: Point,
  from: Point,
  toward: Point,
): boolean {
  const forward = dist(from, start) + dist(end, toward);
  const backward = dist(from, end) + dist(start, toward);
  return backward < forward;
}

function buildSegments(
  pathOrder: string[],
  pathEdges: Edge[],
  getInternalNode: (id: string) => InternalNode | undefined,
): PathSegment[] {
  const pathPeople = new Set(pathOrder);
  const origin = nodeCenter(getInternalNode(pathOrder[0]));
  const segments: PathSegment[] = [];
  const used = new Set<string>();
  let cursor: Point | null = origin;

  for (let i = 0; i < pathOrder.length - 1; i += 1) {
    const fromId = pathOrder[i];
    const toId = pathOrder[i + 1];
    const fromCenter = nodeCenter(getInternalNode(fromId));
    const hopGoal = nodeCenter(getInternalNode(toId));
    const hopIds = edgeIdsBetween(
      pathEdges,
      fromId,
      toId,
      pathPeople,
      getInternalNode,
    );

    for (const edgeId of hopIds) {
      if (used.has(edgeId)) continue;
      const path = edgeSvgPath(edgeId);
      if (!path) continue;
      const length = path.getTotalLength();
      if (length <= 0) continue;

      const { start, end } = pathEndpoints(path, length);
      const from = cursor ?? fromCenter ?? start;
      const toward = hopGoal ?? end;
      const reverse = segmentReverse(start, end, from, toward);

      cursor = reverse ? start : end;
      segments.push({ path, reverse, length });
      used.add(edgeId);
    }

    // Snap cursor to the hop's person so the next hop starts cleanly.
    if (hopGoal) cursor = hopGoal;
  }

  return segments;
}

function pointOnSegments(
  segments: PathSegment[],
  t: number,
  origin: Point | null,
): Point | null {
  if (segments.length === 0) return origin;
  if (t <= 0 && origin) return origin;
  const total = segments.reduce((sum, seg) => sum + seg.length, 0);
  if (total <= 0) return origin;
  let remain = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    const last = i === segments.length - 1;
    if (remain <= seg.length || last) {
      const along = Math.max(0, Math.min(seg.length, remain));
      const len = seg.reverse ? seg.length - along : along;
      const p = seg.path.getPointAtLength(len);
      return { x: p.x, y: p.y };
    }
    remain -= seg.length;
  }
  return origin;
}

/**
 * Gold marker that rides the selected path's drawn edges from origin
 * to destination (person order), then pauses and loops.
 */
export function PathTraveler({ pathOrder }: { pathOrder: string[] }) {
  const { getEdges, getInternalNode } = useReactFlow();
  const ready = useNodesInitialized();
  const [progress, setProgress] = useState(0);
  const [tick, setTick] = useState(0);
  const pathKey = pathOrder.join("\0");
  const reduceMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    () => false,
  );

  useEffect(() => {
    if (pathOrder.length < 2 || reduceMotion) return;
    let raf = 0;
    const hopMs = 1300;
    const travelMs = Math.max(2600, (pathOrder.length - 1) * hopMs);
    const pauseMs = 1100;
    const cycle = travelMs + pauseMs;
    const start = performance.now();
    const frame = (now: number) => {
      const elapsed = (now - start) % cycle;
      setProgress(elapsed >= travelMs ? 1 : elapsed / travelMs);
      setTick((value) => value + 1);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [pathKey, pathOrder.length, reduceMotion]);

  if (!ready || pathOrder.length < 2) return null;

  const pathEdges = getEdges().filter((edge) =>
    Boolean(edge.className?.includes("pedigree-path-edge")),
  );
  const origin = nodeCenter(getInternalNode(pathOrder[0]));
  const segments = buildSegments(pathOrder, pathEdges, getInternalNode);
  void tick;
  const pos = pointOnSegments(
    segments,
    reduceMotion ? 1 : progress,
    origin,
  );
  if (!pos) return null;

  return (
    <ViewportPortal>
      <div
        className={styles.traveler}
        style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
        aria-hidden
      />
    </ViewportPortal>
  );
}
