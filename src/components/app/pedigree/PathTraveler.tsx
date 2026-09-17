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
  /** Drawn edge geometry when the SVG path is mounted. */
  path?: SVGPathElement;
  /** Straight fallback when the edge SVG is culled or not ready yet. */
  from?: Point;
  to?: Point;
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

function edgeEndpointCenters(
  edge: Edge,
  getInternalNode: (id: string) => InternalNode | undefined,
): { start: Point; end: Point } | null {
  const source = nodeCenter(getInternalNode(edge.source));
  const target = nodeCenter(getInternalNode(edge.target));
  if (!source || !target) return null;
  return { start: source, end: target };
}

function buildSegments(
  pathOrder: string[],
  pathEdges: Edge[],
  getInternalNode: (id: string) => InternalNode | undefined,
): PathSegment[] {
  const pathPeople = new Set(pathOrder);
  const origin = nodeCenter(getInternalNode(pathOrder[0]));
  const segments: PathSegment[] = [];
  const edgeById = new Map(pathEdges.map((edge) => [edge.id, edge]));
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

    let hopAdded = false;
    for (const edgeId of hopIds) {
      const path = edgeSvgPath(edgeId);
      if (path) {
        const length = path.getTotalLength();
        if (length <= 0) continue;
        const { start, end } = pathEndpoints(path, length);
        const from = cursor ?? fromCenter ?? start;
        const toward = hopGoal ?? end;
        const reverse = segmentReverse(start, end, from, toward);
        cursor = reverse ? start : end;
        segments.push({ path, reverse, length });
        hopAdded = true;
        continue;
      }

      // Edge SVG may be culled off-screen — still walk a straight chord so the
      // orb keeps moving (via-child hops reuse the same child/drop edges).
      const edge = edgeById.get(edgeId);
      if (!edge) continue;
      const ends = edgeEndpointCenters(edge, getInternalNode);
      if (!ends) continue;
      const length = dist(ends.start, ends.end);
      if (length <= 0) continue;
      const from = cursor ?? fromCenter ?? ends.start;
      const toward = hopGoal ?? ends.end;
      const reverse = segmentReverse(ends.start, ends.end, from, toward);
      cursor = reverse ? ends.start : ends.end;
      segments.push({
        from: ends.start,
        to: ends.end,
        reverse,
        length,
      });
      hopAdded = true;
    }

    // No topology edges (e.g. couple virtual hop only) — chord person→person.
    if (!hopAdded && fromCenter && hopGoal) {
      const length = dist(fromCenter, hopGoal);
      if (length > 0) {
        segments.push({
          from: fromCenter,
          to: hopGoal,
          reverse: false,
          length,
        });
      }
    }

    // Snap cursor to the hop's person so the next hop starts cleanly.
    if (hopGoal) cursor = hopGoal;
  }

  return segments;
}

function pointAlongSegment(seg: PathSegment, along: number): Point | null {
  // `along` is distance in the walk direction (0 = enter, length = leave).
  if (seg.path) {
    const len = seg.reverse ? seg.length - along : along;
    const p = seg.path.getPointAtLength(len);
    return { x: p.x, y: p.y };
  }
  if (!seg.from || !seg.to || seg.length <= 0) return null;
  const t = Math.max(0, Math.min(1, along / seg.length));
  const start = seg.reverse ? seg.to : seg.from;
  const end = seg.reverse ? seg.from : seg.to;
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  };
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
      return pointAlongSegment(seg, along) ?? origin;
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
