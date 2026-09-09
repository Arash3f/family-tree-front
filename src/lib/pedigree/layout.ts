import type { Edge, Node } from "@xyflow/react";
import type { Marriage, Person } from "@/lib/auth/types";
import { isBornByYear, isReachedByYear } from "@/lib/pedigree/dates";
import {
  buildTreeIndex,
  childrenOf,
  neighborhoodOf,
  type TreeIndex,
} from "@/lib/pedigree/index-tree";

export const PERSON_NODE_WIDTH = 220;
export const PERSON_NODE_HEIGHT = 176;
const H_GAP = 72;
const V_GAP = 280;
const COUPLE_GAP = 32;
const COUPLE_PAD_X = 14;
const COUPLE_PAD_Y = 14;
const COUPLE_DATE_BAND = 26;
const FAMILY_GAP = 120;
/** Person-to-person gap for an extra spouse beside their partner. */
const SECONDARY_SPOUSE_GAP = 56;
export const UNION_OFFSET_Y = 56;
export const UNION_BOX_GAP = 36;
export const UNION_SIZE = 12;
export const COUPLE_BOX_WIDTH =
  COUPLE_PAD_X * 2 + PERSON_NODE_WIDTH * 2 + COUPLE_GAP;
export const COUPLE_BOX_HEIGHT =
  COUPLE_PAD_Y * 2 + PERSON_NODE_HEIGHT + COUPLE_DATE_BAND;

export function coupleNodeId(marriageId: string): string {
  return `couple-${marriageId}`;
}

export type PersonNodeData = {
  person: Person;
  selected: boolean;
  highlighted: boolean;
  onPath: boolean;
  onAltPath: boolean;
  /** 0 = selected gold path; 1..N = distinct alternative path colors. */
  pathLane: number | null;
  dimmed: boolean;
  inCouple?: boolean;
  /** Set when this person has children, so their line can be folded away. */
  hasDescendants?: boolean;
  /** People currently folded away under this person, zero when unfolded. */
  collapsedCount?: number;
  onSelect?: (personId: string | null) => void;
  [key: string]: unknown;
};

export type UnionNodeData = {
  marriageId: string;
  leftId: string;
  rightId: string;
  highlighted: boolean;
  onPath: boolean;
  onAltPath: boolean;
  /** 0 = selected gold path; 1..N = distinct alternative path colors. */
  pathLane: number | null;
  dimmed: boolean;
  divorced: boolean;
  marriedAt: string | null;
  /** Extra concurrent marriages use the same chrome with an alt color. */
  tone?: "primary" | "secondary";
  /**
   * Horizontal position (0–1) for ring/date/drop. For polygamy, sits under the
   * exclusive (non-shared) spouse so dates do not stack on the shared person.
   */
  chromeAt?: number;
  [key: string]: unknown;
};

export type CoupleNodeData = UnionNodeData;

export type PedigreeEdgeData = {
  kind: "spouse" | "drop" | "parent";
  marriageId?: string;
  relationshipType?: string;
  divorced?: boolean;
  personIds: string[];
  tone?: "primary" | "secondary";
  [key: string]: unknown;
};

export type PedigreeGraph = {
  nodes: Node[];
  edges: Edge[];
};

type Unit =
  | { kind: "couple"; marriageId: string; leftId: string; rightId: string }
  | { kind: "single"; personId: string };

type Pos = { x: number; y: number };

function preferredSpouseOrder(a: Person, b: Person): [string, string] {
  if (a.gender === "male" && b.gender !== "male") return [a.id, b.id];
  if (b.gender === "male" && a.gender !== "male") return [b.id, a.id];
  return a.name.localeCompare(b.name) <= 0 ? [a.id, b.id] : [b.id, a.id];
}

function hasParentsInTree(
  person: Person,
  byId: Map<string, Person>,
): boolean {
  return person.parents.some((link) => byId.has(link.parent_id));
}

/** Spouse who joined by marriage, not by blood. Null if both already belong. */
function incomingSpouseId(
  a: Person,
  b: Person,
  byId: Map<string, Person>,
): string | null {
  const aBlood = hasParentsInTree(a, byId);
  const bBlood = hasParentsInTree(b, byId);
  if (aBlood === bBlood) {
    if (aBlood) return null;
    return preferredSpouseOrder(a, b)[1] ?? null;
  }
  return aBlood ? b.id : a.id;
}

/** People and marriages that exist at a timeline year. */
export function sliceTreeAtYear(
  persons: Person[],
  marriages: Marriage[],
  year: number,
  locale: string,
): { persons: Person[]; marriages: Marriage[] } {
  const byId = new Map(persons.map((person) => [person.id, person]));
  const hide = new Set<string>();

  for (const marriage of marriages) {
    if (isReachedByYear(marriage.married_at, year, locale)) continue;
    const a = byId.get(marriage.spouse_a_id);
    const b = byId.get(marriage.spouse_b_id);
    if (!a || !b) continue;
    const inLaw = incomingSpouseId(a, b, byId);
    if (inLaw) hide.add(inLaw);
  }

  for (const marriage of marriages) {
    if (!isReachedByYear(marriage.married_at, year, locale)) continue;
    hide.delete(marriage.spouse_a_id);
    hide.delete(marriage.spouse_b_id);
  }

  const visiblePersons = persons.filter(
    (person) =>
      isBornByYear(person.birth_date, year, locale) && !hide.has(person.id),
  );
  const visibleIds = new Set(visiblePersons.map((person) => person.id));
  const visibleMarriages = marriages.filter(
    (marriage) =>
      isReachedByYear(marriage.married_at, year, locale) &&
      visibleIds.has(marriage.spouse_a_id) &&
      visibleIds.has(marriage.spouse_b_id),
  );
  return { persons: visiblePersons, marriages: visibleMarriages };
}

/**
 * Layer ranks: blood depth from roots, then spouses share a layer, then
 * descendants are pushed down until ranks stabilize. Couples stay on one
 * band without collapsing later generations upward.
 */
function computeGenerations(
  persons: Person[],
  marriages: Marriage[],
): Map<string, number> {
  const byId = new Map(persons.map((person) => [person.id, person]));
  const generations = new Map<string, number>();

  const visit = (id: string, stack: Set<string>): number => {
    const cached = generations.get(id);
    if (cached !== undefined) return cached;
    if (stack.has(id)) return 0;
    stack.add(id);
    const person = byId.get(id);
    if (!person || person.parents.length === 0) {
      generations.set(id, 0);
      stack.delete(id);
      return 0;
    }
    let maxParent = 0;
    for (const link of person.parents) {
      if (!byId.has(link.parent_id)) continue;
      maxParent = Math.max(maxParent, visit(link.parent_id, stack));
    }
    const generation = maxParent + 1;
    generations.set(id, generation);
    stack.delete(id);
    return generation;
  };

  for (const person of persons) visit(person.id, new Set());

  for (let pass = 0; pass < persons.length + marriages.length + 2; pass++) {
    let changed = false;

    for (const marriage of marriages) {
      if (!byId.has(marriage.spouse_a_id) || !byId.has(marriage.spouse_b_id)) {
        continue;
      }
      const gen = Math.max(
        generations.get(marriage.spouse_a_id) ?? 0,
        generations.get(marriage.spouse_b_id) ?? 0,
      );
      for (const id of [marriage.spouse_a_id, marriage.spouse_b_id]) {
        if ((generations.get(id) ?? 0) !== gen) {
          generations.set(id, gen);
          changed = true;
        }
      }
    }

    for (const person of persons) {
      if (person.parents.length === 0) continue;
      let maxParent = -1;
      for (const link of person.parents) {
        if (!byId.has(link.parent_id)) continue;
        maxParent = Math.max(maxParent, generations.get(link.parent_id) ?? 0);
      }
      if (maxParent < 0) continue;
      const next = maxParent + 1;
      if ((generations.get(person.id) ?? 0) < next) {
        generations.set(person.id, next);
        changed = true;
      }
    }

    if (!changed) break;
  }

  return generations;
}

/**
 * Children of one marriage.
 *
 * Kept for callers that only ask about a single marriage. Anything looping over
 * marriages should build a `TreeIndex` and use `childrenOf`, or it pays a full
 * person scan per iteration.
 */
export function childrenOfMarriage(
  persons: Person[],
  marriage: Marriage,
): Person[] {
  return childrenOf(buildTreeIndex(persons, [marriage]), marriage.id);
}

function unitWidth(unit: Unit): number {
  if (unit.kind === "single") return PERSON_NODE_WIDTH;
  return COUPLE_BOX_WIDTH;
}

function unitLeftX(unit: Unit, positions: Map<string, Pos>): number {
  if (unit.kind === "single") return positions.get(unit.personId)?.x ?? 0;
  const left = positions.get(unit.leftId)?.x ?? 0;
  const right = positions.get(unit.rightId)?.x ?? 0;
  return Math.min(left, right) - COUPLE_PAD_X;
}

function placeUnit(
  unit: Unit,
  positions: Map<string, Pos>,
  leftX: number,
  y: number,
) {
  if (unit.kind === "single") {
    positions.set(unit.personId, { x: leftX, y });
    return;
  }
  positions.set(unit.leftId, { x: leftX + COUPLE_PAD_X, y });
  positions.set(unit.rightId, {
    x: leftX + COUPLE_PAD_X + PERSON_NODE_WIDTH + COUPLE_GAP,
    y,
  });
}

function shiftUnit(unit: Unit, positions: Map<string, Pos>, dx: number) {
  if (Math.abs(dx) < 0.5) return;
  const ids =
    unit.kind === "single" ? [unit.personId] : [unit.leftId, unit.rightId];
  for (const id of ids) {
    const pos = positions.get(id);
    if (pos) positions.set(id, { ...pos, x: pos.x + dx });
  }
}

function packUnitsLeftToRight(
  units: Unit[],
  positions: Map<string, Pos>,
  startX: number,
  y: number,
) {
  let cursor = startX;
  for (const unit of units) {
    placeUnit(unit, positions, cursor, y);
    cursor += unitWidth(unit) + H_GAP;
  }
}

function coupleMid(
  leftId: string,
  rightId: string,
  positions: Map<string, Pos>,
): number | null {
  const left = positions.get(leftId);
  const right = positions.get(rightId);
  if (!left || !right) return null;
  return (left.x + PERSON_NODE_WIDTH / 2 + right.x + PERSON_NODE_WIDTH / 2) / 2;
}

function parentPackKey(person: Person): string {
  if (person.marriage_id) return `m:${person.marriage_id}`;
  if (person.parents.length === 0) return `root:${person.id}`;
  return `p:${person.parents
    .map((link) => link.parent_id)
    .sort()
    .join("|")}`;
}

function unitMembers(unit: Unit): string[] {
  return unit.kind === "single" ? [unit.personId] : [unit.leftId, unit.rightId];
}

/** People and marriages needed to render only a relationship path.
 *  Co-parents are included so parental couples stay paired in the minimal view.
 */
export function subsetForPath(
  persons: Person[],
  marriages: Marriage[],
  pathIds: Set<string>,
  index?: TreeIndex,
): { persons: Person[]; marriages: Marriage[] } {
  if (pathIds.size === 0) return { persons: [], marriages: [] };

  const treeIndex = index ?? buildTreeIndex(persons, marriages);
  const keepIds = new Set(pathIds);
  const keepMarriages: Marriage[] = [];

  for (const marriage of marriages) {
    const aOnPath = pathIds.has(marriage.spouse_a_id);
    const bOnPath = pathIds.has(marriage.spouse_b_id);
    if (!aOnPath && !bOnPath) continue;

    const hasPathChild = childrenOf(treeIndex, marriage.id).some((child) =>
      pathIds.has(child.id),
    );

    // Keep couples when both spouses are on the path, or when a path
    // child hangs under this marriage (show both parents together).
    if ((aOnPath && bOnPath) || hasPathChild) {
      keepIds.add(marriage.spouse_a_id);
      keepIds.add(marriage.spouse_b_id);
      keepMarriages.push(marriage);
    }
  }

  return {
    persons: persons.filter((person) => keepIds.has(person.id)),
    marriages: keepMarriages,
  };
}

/** Person plus all descendants (via parent links), then spouses of that set. */
export function collectBranchIds(
  rootId: string,
  persons: Person[],
  marriages: Marriage[],
): Set<string> {
  if (!persons.some((person) => person.id === rootId)) return new Set();

  const childrenByParent = new Map<string, string[]>();
  for (const person of persons) {
    for (const link of person.parents) {
      const list = childrenByParent.get(link.parent_id) ?? [];
      list.push(person.id);
      childrenByParent.set(link.parent_id, list);
    }
  }

  const keep = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const childId of childrenByParent.get(id) ?? []) {
      if (keep.has(childId)) continue;
      keep.add(childId);
      queue.push(childId);
    }
  }

  for (const marriage of marriages) {
    const aIn = keep.has(marriage.spouse_a_id);
    const bIn = keep.has(marriage.spouse_b_id);
    if (aIn || bIn) {
      keep.add(marriage.spouse_a_id);
      keep.add(marriage.spouse_b_id);
    }
  }

  return keep;
}

/** People and marriages for a branch rooted at one person. */
export function subsetForBranch(
  persons: Person[],
  marriages: Marriage[],
  rootId: string,
): { persons: Person[]; marriages: Marriage[] } {
  const keepIds = collectBranchIds(rootId, persons, marriages);
  if (keepIds.size === 0) return { persons: [], marriages: [] };

  return {
    persons: persons.filter((person) => keepIds.has(person.id)),
    marriages: marriages.filter(
      (marriage) =>
        keepIds.has(marriage.spouse_a_id) && keepIds.has(marriage.spouse_b_id),
    ),
  };
}

/**
 * Neighborhood around a person: self, parents, spouses, children.
 *
 * Pass `index` when the caller already has one — this runs on every selection
 * change, and rebuilding the index each time defeats the point of having it.
 */
export function computeNeighborhood(
  personId: string,
  persons: Person[],
  marriages: Marriage[],
  index?: TreeIndex,
): Set<string> {
  return neighborhoodOf(index ?? buildTreeIndex(persons, marriages), personId);
}

export function nodeAbsolutePosition(
  node: Node,
  byId: Map<string, Node>,
): { x: number; y: number } {
  let x = node.position.x;
  let y = node.position.y;
  let parentId = node.parentId;
  const seen = new Set<string>();
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) break;
    x += parent.position.x;
    y += parent.position.y;
    parentId = parent.parentId;
  }
  return { x, y };
}

function nodeBoxSize(node: Node, fallbackWidth: number, fallbackHeight: number) {
  const measured = node.measured;
  const width = measured?.width ?? node.width ?? fallbackWidth;
  const height = measured?.height ?? node.height ?? fallbackHeight;
  return { width, height };
}

function unionPositionFromCoupleBox(couple: Node): { x: number; y: number } {
  const { width, height } = nodeBoxSize(couple, COUPLE_BOX_WIDTH, COUPLE_BOX_HEIGHT);
  const data = couple.data as CoupleNodeData;
  const bias =
    typeof data.chromeAt === "number" && Number.isFinite(data.chromeAt)
      ? Math.min(1, Math.max(0, data.chromeAt))
      : 0.5;
  return {
    x: couple.position.x + width * bias - UNION_SIZE / 2,
    y: couple.position.y + height + UNION_BOX_GAP,
  };
}

function unionPositionFromSpouses(
  left: Node,
  right: Node,
  byId: Map<string, Node>,
): { x: number; y: number } {
  const leftPos = nodeAbsolutePosition(left, byId);
  const rightPos = nodeAbsolutePosition(right, byId);
  const midX =
    (leftPos.x +
      PERSON_NODE_WIDTH / 2 +
      rightPos.x +
      PERSON_NODE_WIDTH / 2) /
    2;
  const y =
    Math.max(leftPos.y, rightPos.y) + PERSON_NODE_HEIGHT + UNION_OFFSET_Y;
  return { x: midX - UNION_SIZE / 2, y };
}

/**
 * Frame around two spouses using spatial bounds (not leftId/rightId order —
 * an extra spouse may sit to the left of a "leftId" partner).
 * When `exclusivePos` is set, ring/date sit under that non-shared spouse.
 */
function secondaryCoupleGeometry(
  aPos: Pos,
  bPos: Pos,
  exclusivePos?: Pos | null,
): { position: Pos; width: number; height: number; chromeAt: number } {
  const leftEdge = Math.min(aPos.x, bPos.x);
  const rightEdge = Math.max(aPos.x, bPos.x);
  const minX = leftEdge - COUPLE_PAD_X;
  const maxX = rightEdge + PERSON_NODE_WIDTH + COUPLE_PAD_X;
  const width = Math.max(maxX - minX, PERSON_NODE_WIDTH + COUPLE_PAD_X * 2);
  const anchorX = exclusivePos
    ? exclusivePos.x + PERSON_NODE_WIDTH / 2
    : leftEdge + PERSON_NODE_WIDTH + (rightEdge - leftEdge - PERSON_NODE_WIDTH) / 2;
  const chromeAt = Math.min(0.88, Math.max(0.12, (anchorX - minX) / width));
  return {
    position: {
      x: minX,
      y: Math.min(aPos.y, bPos.y) - COUPLE_PAD_Y,
    },
    width,
    height: COUPLE_BOX_HEIGHT,
    chromeAt,
  };
}

function chromeAtUnderPerson(
  frameX: number,
  frameWidth: number,
  personPos: Pos,
): number {
  const anchorX = personPos.x + PERSON_NODE_WIDTH / 2;
  return Math.min(0.88, Math.max(0.12, (anchorX - frameX) / frameWidth));
}

function syncSecondaryCoupleNode(
  node: Node,
  data: CoupleNodeData,
  byId: Map<string, Node>,
): Node {
  const left = byId.get(data.leftId);
  const right = byId.get(data.rightId);
  if (!left || !right) return node;
  const leftPos = nodeAbsolutePosition(left, byId);
  const rightPos = nodeAbsolutePosition(right, byId);
  // Shared spouse is nested in the primary couple; exclusive spouse is free.
  const exclusivePos =
    left.parentId && !right.parentId
      ? rightPos
      : right.parentId && !left.parentId
        ? leftPos
        : null;
  const next = secondaryCoupleGeometry(leftPos, rightPos, exclusivePos);
  const prevStyle = node.style ?? {};
  if (
    node.position.x === next.position.x &&
    node.position.y === next.position.y &&
    node.width === next.width &&
    node.height === next.height &&
    prevStyle.width === next.width &&
    prevStyle.height === next.height &&
    data.chromeAt === next.chromeAt
  ) {
    return node;
  }
  return {
    ...node,
    position: next.position,
    width: next.width,
    height: next.height,
    style: { ...prevStyle, width: next.width, height: next.height },
    data: { ...data, chromeAt: next.chromeAt },
  };
}

function computeUnionPosition(
  data: UnionNodeData,
  byId: Map<string, Node>,
): { x: number; y: number } | null {
  const couple = byId.get(coupleNodeId(data.marriageId));
  if (couple && !couple.hidden) return unionPositionFromCoupleBox(couple);
  const left = byId.get(data.leftId);
  const right = byId.get(data.rightId);
  if (!left || !right) return null;
  return unionPositionFromSpouses(left, right, byId);
}

export function syncUnionPositions(nodes: Node[]): Node[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  let changed = false;
  const next = nodes.map((node) => {
    if (node.type === "couple") {
      const data = node.data as CoupleNodeData;
      if (data.tone !== "secondary") return node;
      const synced = syncSecondaryCoupleNode(node, data, byId);
      if (synced !== node) changed = true;
      return synced;
    }
    if (node.type !== "union") return node;
    const data = node.data as UnionNodeData;
    const pos = computeUnionPosition(data, byId);
    if (!pos) return node;
    if (node.position.x === pos.x && node.position.y === pos.y) return node;
    changed = true;
    return { ...node, position: pos };
  });
  return changed ? next : nodes;
}

/** During drag, only move unions that touch the dragged people. */
export function syncUnionPositionsForPeople(
  nodes: Node[],
  personIds: readonly string[],
): Node[] {
  if (personIds.length === 0) return nodes;
  const ids = new Set(personIds);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  let changed = false;
  const next = nodes.map((node) => {
    if (node.type === "couple") {
      const data = node.data as CoupleNodeData;
      if (data.tone !== "secondary") return node;
      if (!ids.has(data.leftId) && !ids.has(data.rightId)) return node;
      const synced = syncSecondaryCoupleNode(node, data, byId);
      if (synced !== node) {
        changed = true;
        byId.set(synced.id, synced);
      }
      return synced;
    }
    if (node.type !== "union") return node;
    const data = node.data as UnionNodeData;
    if (!ids.has(data.leftId) && !ids.has(data.rightId)) return node;
    const pos = computeUnionPosition(data, byId);
    if (!pos) return node;
    if (node.position.x === pos.x && node.position.y === pos.y) return node;
    changed = true;
    return { ...node, position: pos };
  });
  return changed ? next : nodes;
}

export function syncUnionPositionsForPerson(
  nodes: Node[],
  personId: string,
): Node[] {
  return syncUnionPositionsForPeople(nodes, [personId]);
}

/** People linked through any couple chrome (primary or secondary marriages). */
export function marriageClusterPersonIds(
  nodes: Node[],
  seedPersonIds: readonly string[],
): string[] {
  const set = new Set(seedPersonIds.filter(Boolean));
  if (set.size === 0) return [];
  let grew = true;
  while (grew) {
    grew = false;
    for (const node of nodes) {
      if (node.type !== "couple") continue;
      const data = node.data as CoupleNodeData;
      if (!set.has(data.leftId) && !set.has(data.rightId)) continue;
      if (!set.has(data.leftId)) {
        set.add(data.leftId);
        grew = true;
      }
      if (!set.has(data.rightId)) {
        set.add(data.rightId);
        grew = true;
      }
    }
  }
  return [...set];
}

/**
 * Nodes that must translate with a marriage cluster drag, excluding the node
 * React Flow is already moving (and its nested children).
 */
export function marriageClusterFollowerStarts(
  nodes: Node[],
  clusterPersonIds: readonly string[],
  dragged: Node,
): Map<string, Pos> {
  const people = new Set(clusterPersonIds);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const autoMoved = new Set<string>([dragged.id]);
  for (const node of nodes) {
    if (node.parentId === dragged.id) autoMoved.add(node.id);
  }

  const followers = new Map<string, Pos>();
  for (const node of nodes) {
    if (autoMoved.has(node.id)) continue;

    if (node.type === "person") {
      if (!people.has(node.id)) continue;
      // Nested under a couple that will also follow — keep relative coords.
      if (node.parentId) {
        const parent = byId.get(node.parentId);
        if (parent && !autoMoved.has(parent.id)) continue;
      }
      followers.set(node.id, { ...node.position });
      continue;
    }

    if (node.type === "couple") {
      const data = node.data as CoupleNodeData;
      if (!people.has(data.leftId) && !people.has(data.rightId)) continue;
      // Secondary frames are rebuilt from spouse positions while dragging.
      if (data.tone === "secondary") continue;
      followers.set(node.id, { ...node.position });
    }
  }
  return followers;
}

function collectPathMarriages(
  nodes: Node[],
  edges: Edge[],
  ids: Set<string>,
): Set<string> {
  const marriages = new Set<string>();
  if (ids.size === 0) return marriages;
  for (const edge of edges) {
    const data = (edge.data ?? {}) as PedigreeEdgeData;
    if (!data.marriageId) continue;
    const touchIds = data.personIds ?? [];
    if (touchIds.filter((id) => ids.has(id)).length >= 2) {
      marriages.add(data.marriageId);
    }
  }
  for (const node of nodes) {
    if (node.type !== "couple" && node.type !== "union") continue;
    const data = node.data as UnionNodeData;
    if (ids.has(data.leftId) && ids.has(data.rightId)) {
      marriages.add(data.marriageId);
    }
  }
  return marriages;
}

function expandPathIds(
  nodes: Node[],
  ids: Set<string>,
  marriages: Set<string>,
): Set<string> {
  const expanded = new Set(ids);
  if (marriages.size === 0) return expanded;
  for (const node of nodes) {
    if (node.type !== "union" && node.type !== "couple") continue;
    const data = node.data as UnionNodeData;
    if (!marriages.has(data.marriageId)) continue;
    expanded.add(data.leftId);
    expanded.add(data.rightId);
  }
  return expanded;
}

export function stylePedigreeGraph(input: {
  nodes: Node[];
  edges: Edge[];
  selectedId: string | null;
  focusIds: Set<string>;
  pathIds?: Set<string>;
  /** Ordered active path (origin → destination) for travel animation. */
  pathOrder?: string[];
  altPathIds?: Set<string>;
  /** Person id → color lane (0 selected gold, 1 alternative blue). */
  pathLaneById?: Map<string, number>;
  visiblePersonIds?: Set<string>;
}): { nodes: Node[]; edges: Edge[] } {
  const { selectedId, focusIds, visiblePersonIds } = input;
  const pathIds = input.pathIds ?? new Set<string>();
  const pathOrder = input.pathOrder ?? [];
  const altPathIds = input.altPathIds ?? new Set<string>();
  const pathLaneById = input.pathLaneById ?? new Map<string, number>();
  const hasFocus = focusIds.size > 0;
  const relationMode = pathIds.size > 0 || altPathIds.size > 0;
  const pathIndex = new Map(pathOrder.map((id, index) => [id, index]));
  const pathHopCount = Math.max(1, pathOrder.length);

  const hopForPeople = (ids: string[]): number => {
    let best = Number.POSITIVE_INFINITY;
    for (const id of ids) {
      const index = pathIndex.get(id);
      if (index === undefined) continue;
      if (index < best) best = index;
    }
    return Number.isFinite(best) ? best : 0;
  };

  const laneForIds = (ids: string[]): number | null => {
    let best: number | null = null;
    for (const id of ids) {
      const lane = pathLaneById.get(id);
      if (lane === undefined) continue;
      if (best === null || lane < best) best = lane;
    }
    return best;
  };

  const pathMarriages = collectPathMarriages(input.nodes, input.edges, pathIds);
  const altMarriages = new Set(
    [...collectPathMarriages(input.nodes, input.edges, altPathIds)].filter(
      (id) => !pathMarriages.has(id),
    ),
  );
  const displayPathIds = expandPathIds(input.nodes, pathIds, pathMarriages);
  const displayAltIds = expandPathIds(input.nodes, altPathIds, altMarriages);

  const marriageLane = (marriageId: string, leftId: string, rightId: string) => {
    if (pathMarriages.has(marriageId)) return 0;
    if (!altMarriages.has(marriageId)) return null;
    return laneForIds([leftId, rightId]) ?? 1;
  };

  const styleMarriageUnit = (node: Node, data: UnionNodeData): Node => {
    const onPath = relationMode && pathMarriages.has(data.marriageId);
    const onAltPath =
      relationMode && !onPath && altMarriages.has(data.marriageId);
    const pathLane = relationMode
      ? marriageLane(data.marriageId, data.leftId, data.rightId)
      : null;
    const related = relationMode
      ? onPath || onAltPath
      : Boolean(
          selectedId &&
            (data.leftId === selectedId ||
              data.rightId === selectedId ||
              focusIds.has(data.leftId) ||
              focusIds.has(data.rightId)),
        );
    const unitActive = relationMode
      ? related
      : Boolean(selectedId) &&
        (data.leftId === selectedId ||
          data.rightId === selectedId ||
          (focusIds.has(data.leftId) &&
            focusIds.has(data.rightId) &&
            focusIds.has(selectedId!)));
    const highlighted = !relationMode && unitActive && hasFocus;
    const dimmed = hasFocus && !unitActive;
    if (
      data.highlighted === highlighted &&
      data.onPath === onPath &&
      data.onAltPath === onAltPath &&
      data.pathLane === pathLane &&
      data.dimmed === dimmed
    ) {
      return node;
    }
    return {
      ...node,
      data: {
        ...data,
        highlighted,
        onPath,
        onAltPath,
        pathLane,
        dimmed,
      },
    };
  };

  const nodes = input.nodes.map((node) => {
    if (node.type === "union" || node.type === "couple") {
      return styleMarriageUnit(node, node.data as UnionNodeData);
    }

    if (node.type !== "person") return node;
    const data = node.data as PersonNodeData;
    const id = node.id;
    const onPath = relationMode && displayPathIds.has(id);
    const onAltPath = relationMode && !onPath && displayAltIds.has(id);
    const pathLane = relationMode
      ? onPath
        ? 0
        : onAltPath
          ? 1
          : null
      : null;
    const highlighted = !relationMode && focusIds.has(id) && hasFocus;
    const selected = selectedId === id;
    const dimmed = hasFocus && !(onPath || onAltPath || highlighted);
    const pathHop = onPath ? (pathIndex.get(id) ?? 0) : undefined;
    const inCouple = Boolean(node.className?.includes("in-couple-member"));
    const className = [
      inCouple ? "in-couple-member" : "",
      onPath ? "pedigree-path-person" : "",
      onAltPath ? "pedigree-alt-path-person" : "",
    ]
      .filter(Boolean)
      .join(" ") || undefined;
    const nextStyle = {
      ...node.style,
      ...(pathHop !== undefined
        ? {
            ["--path-hop" as string]: String(pathHop),
            ["--path-hop-count" as string]: String(pathHopCount),
          }
        : {
            ["--path-hop" as string]: undefined,
            ["--path-hop-count" as string]: undefined,
          }),
    };
    if (
      data.selected === selected &&
      data.highlighted === highlighted &&
      data.onPath === onPath &&
      data.onAltPath === onAltPath &&
      data.pathLane === pathLane &&
      data.dimmed === dimmed &&
      node.className === className &&
      node.style?.["--path-hop" as keyof typeof node.style] ===
        nextStyle["--path-hop" as keyof typeof nextStyle]
    ) {
      return node;
    }
    return {
      ...node,
      className,
      style: nextStyle,
      data: {
        ...data,
        selected,
        highlighted,
        onPath,
        onAltPath,
        pathLane,
        dimmed,
      },
    };
  });

  const edges = input.edges.map((edge) => {
    const data = (edge.data ?? {}) as PedigreeEdgeData;
    const touchIds = data.personIds ?? [];
    const marriageOnPath = Boolean(
      data.marriageId && pathMarriages.has(data.marriageId),
    );
    const marriageOnAlt = Boolean(
      data.marriageId && altMarriages.has(data.marriageId),
    );

    const structuralOnPath =
      relationMode &&
      touchIds.filter((id) => pathIds.has(id)).length >= 2;
    const structuralOnAlt =
      relationMode &&
      !structuralOnPath &&
      touchIds.filter((id) => altPathIds.has(id)).length >= 2;
    const onPath =
      structuralOnPath ||
      (marriageOnPath && (data.kind === "spouse" || data.kind === "drop"));
    const onAltPath =
      !onPath &&
      (structuralOnAlt ||
        (marriageOnAlt && (data.kind === "spouse" || data.kind === "drop")));
    const pathLane = onPath
      ? 0
      : onAltPath
        ? 1
        : null;
    const related = relationMode
      ? onPath || onAltPath
      : Boolean(selectedId && touchIds.includes(selectedId));

    const active = !hasFocus || related;
    const divorced = Boolean(data.divorced);
    const isSpouse = data.kind === "spouse";
    const secondary = data.tone === "secondary";

    const baseStroke = divorced
      ? "#8a9a9d"
      : isSpouse
        ? secondary
          ? "var(--pedigree-spouse-alt)"
          : "var(--accent)"
        : secondary
          ? "var(--pedigree-spouse-alt)"
          : "#6f8184";

    const stroke = onPath
      ? "var(--pedigree-path)"
      : onAltPath
        ? "var(--pedigree-path-alt)"
        : related && hasFocus
          ? secondary
            ? "var(--pedigree-spouse-alt-strong)"
            : "var(--accent-strong)"
          : active
            ? baseStroke
            : "color-mix(in srgb, var(--border) 80%, transparent)";
    const strokeWidth = onPath
      ? isSpouse
        ? 4.2
        : 3.6
      : onAltPath
        ? isSpouse
          ? 3.4
          : 2.8
        : related && hasFocus
          ? isSpouse
            ? 3.4
            : 3
          : active
            ? isSpouse
              ? 2.1
              : 1.7
            : 1.1;
    const opacity = !hasFocus || related ? 1 : 0.12;
    const strokeDasharray = onPath
      ? "1.5 9"
      : onAltPath
        ? "1.5 9"
        : divorced
          ? "6 5"
          : data.relationshipType && data.relationshipType !== "biological"
            ? "5 4"
            : undefined;
    const pathHop = onPath ? hopForPeople(touchIds) : undefined;
    const className = onPath
      ? "pedigree-path-edge"
      : onAltPath
        ? "pedigree-alt-path-edge"
        : undefined;
    const pathAnimated = false;
    const zIndex = onPath ? 12 : onAltPath || (related && hasFocus) ? 10 : 1;
    const prev = edge.style ?? {};
    const nextStyle = {
      ...edge.style,
      stroke,
      strokeWidth,
      opacity,
      strokeDasharray,
      ...(pathHop !== undefined
        ? {
            ["--path-hop" as string]: String(pathHop),
            ["--path-hop-count" as string]: String(pathHopCount),
          }
        : {
            ["--path-hop" as string]: undefined,
            ["--path-hop-count" as string]: undefined,
          }),
    };

    if (
      edge.className === className &&
      edge.animated === pathAnimated &&
      edge.zIndex === zIndex &&
      prev.stroke === stroke &&
      prev.strokeWidth === strokeWidth &&
      prev.opacity === opacity &&
      prev.strokeDasharray === strokeDasharray &&
      prev["--path-hop" as keyof typeof prev] === nextStyle["--path-hop" as keyof typeof nextStyle] &&
      prev["--path-hop-count" as keyof typeof prev] ===
        nextStyle["--path-hop-count" as keyof typeof nextStyle]
    ) {
      return edge;
    }

    return {
      ...edge,
      className,
      animated: pathAnimated,
      style: nextStyle,
      zIndex,
    };
  });

  return applyPedigreeVisibility(nodes, edges, visiblePersonIds);
}

/** Fast path for timeline scrub — only toggles hidden flags. */
export function applyPedigreeVisibility(
  nodes: Node[],
  edges: Edge[],
  visiblePersonIds?: Set<string>,
): { nodes: Node[]; edges: Edge[] } {
  if (!visiblePersonIds) return { nodes, edges };

  const hiddenNodeIds = new Set<string>();
  for (const node of nodes) {
    if (node.type === "person" && !visiblePersonIds.has(node.id)) {
      hiddenNodeIds.add(node.id);
    } else if (node.type === "union") {
      const data = node.data as UnionNodeData;
      if (
        !visiblePersonIds.has(data.leftId) ||
        !visiblePersonIds.has(data.rightId)
      ) {
        hiddenNodeIds.add(node.id);
      }
    } else if (node.type === "couple") {
      const data = node.data as CoupleNodeData;
      const missing =
        data.tone === "secondary"
          ? !visiblePersonIds.has(data.leftId) ||
            !visiblePersonIds.has(data.rightId)
          : !visiblePersonIds.has(data.leftId) &&
            !visiblePersonIds.has(data.rightId);
      if (missing) {
        hiddenNodeIds.add(node.id);
      }
    }
  }

  let nodesChanged = false;
  const nextNodes = nodes.map((node) => {
    const hidden = hiddenNodeIds.has(node.id);
    if (Boolean(node.hidden) === hidden) return node;
    nodesChanged = true;
    return { ...node, hidden };
  });

  let edgesChanged = false;
  const nextEdges = edges.map((edge) => {
    const hidden =
      hiddenNodeIds.has(edge.source) || hiddenNodeIds.has(edge.target);
    if (Boolean(edge.hidden) === hidden) return edge;
    edgesChanged = true;
    return { ...edge, hidden };
  });

  if (!nodesChanged && !edgesChanged) return { nodes, edges };
  return {
    nodes: nodesChanged ? nextNodes : nodes,
    edges: edgesChanged ? nextEdges : edges,
  };
}

export function buildPedigreeGraph(input: {
  persons: Person[];
  marriages: Marriage[];
  /** Reuse a caller's index; one is built on demand when omitted. */
  index?: TreeIndex;
  /**
   * Path-only views: order siblings along relation paths and tighten spacing
   * so the corridor reads left→right / top→bottom without empty generation gaps.
   */
  pathLayout?: {
    orders: string[][];
    compact?: boolean;
  };
}): PedigreeGraph {
  const { persons, marriages } = input;
  if (persons.length === 0) return { nodes: [], edges: [] };

  const treeIndex = input.index ?? buildTreeIndex(persons, marriages);
  const byId = treeIndex.personById;
  const marriagesById = treeIndex.marriageById;
  const rawGenerations = computeGenerations(persons, marriages);

  // Collapse skipped generations so a clipped path does not leave empty bands.
  const generations = (() => {
    if (!input.pathLayout?.compact) return rawGenerations;
    const used = [
      ...new Set(
        persons.map((person) => rawGenerations.get(person.id) ?? 0),
      ),
    ].sort((a, b) => a - b);
    if (used.length <= 1) return rawGenerations;
    const remap = new Map(used.map((gen, index) => [gen, index]));
    const dense = new Map<string, number>();
    for (const person of persons) {
      dense.set(person.id, remap.get(rawGenerations.get(person.id) ?? 0) ?? 0);
    }
    return dense;
  })();

  const pathRank = new Map<string, number>();
  for (const [orderIndex, order] of (input.pathLayout?.orders ?? []).entries()) {
    order.forEach((id, index) => {
      // Earlier orders (active path first) dominate left→right placement.
      const rank = orderIndex * 1_000 + index;
      const prev = pathRank.get(id);
      if (prev === undefined || rank < prev) pathRank.set(id, rank);
    });
  }

  const hGap = input.pathLayout?.compact ? 56 : H_GAP;
  const vGap = input.pathLayout?.compact ? 200 : V_GAP;
  const familyGap = input.pathLayout?.compact ? 72 : FAMILY_GAP;
  const paired = new Set<string>();

  const allUnits: Unit[] = [];
  const unitOfPerson = new Map<string, Unit>();

  const sortedMarriages = [...marriages].sort((a, b) =>
    (a.married_at ?? "").localeCompare(b.married_at ?? ""),
  );

  for (const marriage of sortedMarriages) {
    const a = byId.get(marriage.spouse_a_id);
    const b = byId.get(marriage.spouse_b_id);
    if (!a || !b) continue;
    if (paired.has(a.id) || paired.has(b.id)) continue;
    paired.add(a.id);
    paired.add(b.id);
    let [leftId, rightId] = preferredSpouseOrder(a, b);
    // Path corridor: earlier person on the path sits on the left.
    if (pathRank.size > 0) {
      const rankA = pathRank.get(a.id);
      const rankB = pathRank.get(b.id);
      if (
        rankA !== undefined &&
        rankB !== undefined &&
        rankA !== rankB
      ) {
        [leftId, rightId] = rankA < rankB ? [a.id, b.id] : [b.id, a.id];
      }
    }
    const unit: Unit = {
      kind: "couple",
      marriageId: marriage.id,
      leftId,
      rightId,
    };
    allUnits.push(unit);
    unitOfPerson.set(leftId, unit);
    unitOfPerson.set(rightId, unit);
  }

  for (const person of persons) {
    if (paired.has(person.id)) continue;
    const unit: Unit = { kind: "single", personId: person.id };
    allUnits.push(unit);
    unitOfPerson.set(person.id, unit);
  }

  const unitGen = (unit: Unit) =>
    Math.max(...unitMembers(unit).map((id) => generations.get(id) ?? 0));

  const earliestBirth = (unit: Unit): string => {
    let best = "\uffff";
    for (const id of unitMembers(unit)) {
      const date = byId.get(id)?.birth_date ?? "";
      if (date && date < best) best = date;
    }
    return best;
  };

  const unitLabel = (unit: Unit): string =>
    unitMembers(unit)
      .map((id) => byId.get(id)?.name ?? "")
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))[0] ?? "";

  const unitPathRank = (unit: Unit): number => {
    let best = Number.POSITIVE_INFINITY;
    for (const id of unitMembers(unit)) {
      const rank = pathRank.get(id);
      if (rank !== undefined && rank < best) best = rank;
    }
    return best;
  };

  /**
   * Siblings group by shared parents first, then read oldest to youngest.
   *
   * `earliestBirth` and `unitLabel` walk a unit's members on every comparison,
   * so cache them: a sort does O(n log n) comparisons but only needs O(n) keys.
   */
  const sortKeyCache = new Map<Unit, [string, string, string]>();
  const sortKeyOf = (unit: Unit): [string, string, string] => {
    let key = sortKeyCache.get(unit);
    if (!key) {
      const first = byId.get(unitMembers(unit)[0]!)!;
      key = [parentPackKey(first), earliestBirth(unit), unitLabel(unit)];
      sortKeyCache.set(unit, key);
    }
    return key;
  };

  const compareUnits = (ua: Unit, ub: Unit): number => {
    // Path views: keep the relation corridor left→right by path index.
    if (pathRank.size > 0) {
      const rankA = unitPathRank(ua);
      const rankB = unitPathRank(ub);
      const onPathA = Number.isFinite(rankA);
      const onPathB = Number.isFinite(rankB);
      if (onPathA && onPathB && rankA !== rankB) return rankA - rankB;
      if (onPathA !== onPathB) return onPathA ? -1 : 1;
    }
    const [packA, dateA, labelA] = sortKeyOf(ua);
    const [packB, dateB, labelB] = sortKeyOf(ub);
    const groupedA = packA.startsWith("m:") || packA.startsWith("p:");
    const groupedB = packB.startsWith("m:") || packB.startsWith("p:");
    if (groupedA && groupedB && packA !== packB) {
      return packA.localeCompare(packB);
    }
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return labelA.localeCompare(labelB, undefined, { sensitivity: "base" });
  };

  const sortUnitsInPlace = (units: Unit[]) => units.sort(compareUnits);
  const sortUnits = (units: Unit[]) => sortUnitsInPlace([...units]);

  const bloodChildrenOf = (unit: Unit): Person[] =>
    unit.kind === "couple"
      ? childrenOf(treeIndex, unit.marriageId)
      : (treeIndex.childrenByParentId.get(unit.personId) ?? []);

  // Hang each unit under at most one older parent unit (first claimant wins).
  const parentOfUnit = new Map<Unit, Unit>();
  for (const unit of sortUnits(allUnits)) {
    for (const kid of bloodChildrenOf(unit)) {
      const childUnit = unitOfPerson.get(kid.id);
      if (!childUnit || parentOfUnit.has(childUnit)) continue;
      if (unitGen(childUnit) <= unitGen(unit)) continue;
      parentOfUnit.set(childUnit, unit);
    }
  }

  // Invert `parentOfUnit` once instead of rescanning every unit per parent.
  const childUnitsByParent = new Map<Unit, Unit[]>();
  for (const [child, parent] of parentOfUnit) {
    const siblings = childUnitsByParent.get(parent);
    if (siblings) siblings.push(child);
    else childUnitsByParent.set(parent, [child]);
  }
  for (const siblings of childUnitsByParent.values()) sortUnitsInPlace(siblings);

  const childUnitsUnder = (unit: Unit): Unit[] =>
    childUnitsByParent.get(unit) ?? [];

  /** Extra spouses sit beside their partner instead of becoming extra roots. */
  const satellitesOf = new Map<Unit, { unit: Unit; partnerId: string }[]>();
  const hostOfSatellite = new Map<Unit, Unit>();

  const addSatellite = (host: Unit, satellite: Unit, partnerId: string) => {
    if (host === satellite) return;
    if (parentOfUnit.has(satellite) || hostOfSatellite.has(satellite)) return;
    if (parentOfUnit.get(host) === satellite) return;
    let ancestor: Unit | undefined = host;
    const seen = new Set<Unit>();
    while (ancestor) {
      if (ancestor === satellite) return;
      if (seen.has(ancestor)) break;
      seen.add(ancestor);
      ancestor = parentOfUnit.get(ancestor) ?? hostOfSatellite.get(ancestor);
    }
    const list = satellitesOf.get(host) ?? [];
    list.push({ unit: satellite, partnerId });
    satellitesOf.set(host, list);
    hostOfSatellite.set(satellite, host);
  };

  for (const marriage of sortedMarriages) {
    const ua = unitOfPerson.get(marriage.spouse_a_id);
    const ub = unitOfPerson.get(marriage.spouse_b_id);
    if (!ua || !ub || ua === ub) continue;
    const aAttached = parentOfUnit.has(ua) || hostOfSatellite.has(ua);
    const bAttached = parentOfUnit.has(ub) || hostOfSatellite.has(ub);
    if (!aAttached && bAttached) {
      addSatellite(ub, ua, marriage.spouse_b_id);
    } else if (!bAttached && aAttached) {
      addSatellite(ua, ub, marriage.spouse_a_id);
    } else if (!aAttached && !bAttached) {
      const host = unitGen(ua) >= unitGen(ub) ? ua : ub;
      const satellite = host === ua ? ub : ua;
      const partnerId =
        host === ua ? marriage.spouse_a_id : marriage.spouse_b_id;
      addSatellite(host, satellite, partnerId);
    }
  }

  const positions = new Map<string, Pos>();
  const placedUnits = new Set<Unit>();
  const genY = (gen: number) => gen * (PERSON_NODE_HEIGHT + vGap);

  const clusterRoot = (unit: Unit): Unit => hostOfSatellite.get(unit) ?? unit;

  const shiftSubtree = (unit: Unit, dx: number) => {
    if (Math.abs(dx) < 0.5) return;
    const stack = [clusterRoot(unit)];
    const seen = new Set<Unit>();
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (seen.has(current)) continue;
      seen.add(current);
      shiftUnit(current, positions, dx);
      for (const child of childUnitsUnder(current)) stack.push(child);
      for (const satellite of satellitesOf.get(current) ?? []) {
        stack.push(satellite.unit);
      }
    }
  };

  /** One unit and its blood descendants, parent centered on the child block. */
  const placeColumn = (unit: Unit, leftX: number): number => {
    placedUnits.add(unit);
    const y = genY(unitGen(unit));
    const children = childUnitsUnder(unit);

    if (children.length === 0) {
      placeUnit(unit, positions, leftX, y);
      return unitWidth(unit);
    }

    let cursor = leftX;
    for (let i = 0; i < children.length; i++) {
      const width = placeFamily(children[i]!, cursor);
      cursor += width + (i < children.length - 1 ? familyGap : 0);
    }

    const childrenWidth = cursor - leftX;
    const own = unitWidth(unit);
    const blockWidth = Math.max(own, childrenWidth);
    placeUnit(unit, positions, leftX + (blockWidth - own) / 2, y);

    if (childrenWidth < blockWidth) {
      const groupDx = (blockWidth - childrenWidth) / 2;
      for (const child of children) shiftSubtree(child, groupDx);
    }

    return blockWidth;
  };

  /**
   * Children first, then parent centered — extra spouses stay on the same band,
   * with wide clearance so both marriage dates stay readable.
   */
  const placeFamily = (unit: Unit, leftX: number): number => {
    const raw = (satellitesOf.get(unit) ?? []).filter(
      (item) => !placedUnits.has(item.unit),
    );
    if (raw.length === 0) return placeColumn(unit, leftX);

    const leftPartnerId = unit.kind === "couple" ? unit.leftId : null;
    const leftSats = leftPartnerId
      ? sortUnits(
          raw
            .filter((item) => item.partnerId === leftPartnerId)
            .map((item) => item.unit),
        )
      : [];
    const rightSats = sortUnits(
      raw
        .filter((item) => !leftPartnerId || item.partnerId !== leftPartnerId)
        .map((item) => item.unit),
    );

    // Couple hosts include side padding; keep person-to-person gap steady.
    const satToPartnerGap =
      unit.kind === "couple"
        ? SECONDARY_SPOUSE_GAP - COUPLE_PAD_X
        : SECONDARY_SPOUSE_GAP;

    let cursor = leftX;
    const leftOrdered = [...leftSats].reverse();
    for (let i = 0; i < leftOrdered.length; i++) {
      const width = placeColumn(leftOrdered[i]!, cursor);
      const gap =
        i === leftOrdered.length - 1 ? satToPartnerGap : hGap;
      cursor += width + gap;
    }

    const hostWidth = placeColumn(unit, cursor);
    cursor += hostWidth;

    for (let i = 0; i < rightSats.length; i++) {
      cursor += i === 0 ? satToPartnerGap : hGap;
      const width = placeColumn(rightSats[i]!, cursor);
      cursor += width;
    }

    return cursor - leftX;
  };

  const roots = sortUnits(
    allUnits.filter(
      (unit) => !parentOfUnit.has(unit) && !hostOfSatellite.has(unit),
    ),
  );

  let forestLeft = 0;
  for (let i = 0; i < roots.length; i++) {
    const width = placeFamily(roots[i]!, forestLeft);
    forestLeft += width + (i < roots.length - 1 ? familyGap : 0);
  }

  const forestWidth = forestLeft;
  const forestShift = -forestWidth / 2;
  for (const root of roots) shiftSubtree(root, forestShift);

  // Odd leftover units (cycles / broken links): park by layer to the right.
  const leftovers = sortUnits(allUnits.filter((unit) => !placedUnits.has(unit)));
  if (leftovers.length > 0) {
    const byGen = new Map<number, Unit[]>();
    for (const unit of leftovers) {
      const gen = unitGen(unit);
      if (!byGen.has(gen)) byGen.set(gen, []);
      byGen.get(gen)!.push(unit);
    }
    let cursor = forestWidth / 2 + familyGap;
    for (const gen of [...byGen.keys()].sort((a, b) => a - b)) {
      const units = byGen.get(gen)!;
      packUnitsLeftToRight(units, positions, cursor, genY(gen));
      for (const unit of units) placedUnits.add(unit);
      cursor +=
        units.reduce((sum, unit) => sum + unitWidth(unit), 0) +
        Math.max(0, units.length - 1) * hGap +
        familyGap;
    }
  }

  const resolveOverlaps = () => {
    const byGen = new Map<number, Unit[]>();
    for (const unit of allUnits) {
      const gen = unitGen(unit);
      if (!byGen.has(gen)) byGen.set(gen, []);
      byGen.get(gen)!.push(unit);
    }
    for (const gen of [...byGen.keys()].sort((a, b) => a - b)) {
      const units = [...byGen.get(gen)!].sort(
        (a, b) => unitLeftX(a, positions) - unitLeftX(b, positions),
      );
      for (let i = 1; i < units.length; i++) {
        const prev = units[i - 1]!;
        const curr = units[i]!;
        const minLeft = unitLeftX(prev, positions) + unitWidth(prev) + hGap;
        const currLeft = unitLeftX(curr, positions);
        if (currLeft < minLeft) shiftSubtree(curr, minLeft - currLeft);
      }
    }
  };

  /** Sit each parent on the midpoint of its children after spacing shifts. */
  const recenterOnChildren = () => {
    const units = [...allUnits].sort((a, b) => unitGen(b) - unitGen(a));
    for (const unit of units) {
      const children = childUnitsUnder(unit);
      if (children.length === 0) continue;
      const left = Math.min(
        ...children.map((child) => unitLeftX(child, positions)),
      );
      const right = Math.max(
        ...children.map(
          (child) => unitLeftX(child, positions) + unitWidth(child),
        ),
      );
      const childMid = (left + right) / 2;
      const ownMid = unitLeftX(unit, positions) + unitWidth(unit) / 2;
      shiftUnit(unit, positions, childMid - ownMid);
    }
  };

  resolveOverlaps();
  recenterOnChildren();
  resolveOverlaps();
  recenterOnChildren();

  const coupleParentByPerson = new Map<string, string>();
  const coupleBoxById = new Map<
    string,
    { pos: Pos; width: number; height: number; chromeAt?: number }
  >();
  const boxedMarriageIds = new Set<string>();
  const secondaryMarriageIds = new Set<string>();

  const marriageCountByPerson = new Map<string, number>();
  for (const marriage of marriages) {
    marriageCountByPerson.set(
      marriage.spouse_a_id,
      (marriageCountByPerson.get(marriage.spouse_a_id) ?? 0) + 1,
    );
    marriageCountByPerson.set(
      marriage.spouse_b_id,
      (marriageCountByPerson.get(marriage.spouse_b_id) ?? 0) + 1,
    );
  }

  const coupleNodes: Node[] = [];
  for (const unit of allUnits) {
    if (unit.kind !== "couple") continue;
    const leftPos = positions.get(unit.leftId);
    const rightPos = positions.get(unit.rightId);
    if (!leftPos || !rightPos) continue;
    const marriage = marriagesById.get(unit.marriageId);
    if (!marriage) continue;
    const id = coupleNodeId(unit.marriageId);
    const pos = {
      x: Math.min(leftPos.x, rightPos.x) - COUPLE_PAD_X,
      y: leftPos.y - COUPLE_PAD_Y,
    };
    const leftMulti = (marriageCountByPerson.get(unit.leftId) ?? 0) > 1;
    const rightMulti = (marriageCountByPerson.get(unit.rightId) ?? 0) > 1;
    const chromeAt =
      leftMulti && !rightMulti
        ? chromeAtUnderPerson(pos.x, COUPLE_BOX_WIDTH, rightPos)
        : rightMulti && !leftMulti
          ? chromeAtUnderPerson(pos.x, COUPLE_BOX_WIDTH, leftPos)
          : undefined;
    boxedMarriageIds.add(unit.marriageId);
    coupleParentByPerson.set(unit.leftId, id);
    coupleParentByPerson.set(unit.rightId, id);
    coupleBoxById.set(id, {
      pos,
      width: COUPLE_BOX_WIDTH,
      height: COUPLE_BOX_HEIGHT,
      chromeAt,
    });
    coupleNodes.push({
      id,
      type: "couple",
      position: pos,
      width: COUPLE_BOX_WIDTH,
      height: COUPLE_BOX_HEIGHT,
      style: { width: COUPLE_BOX_WIDTH, height: COUPLE_BOX_HEIGHT },
      data: {
        marriageId: unit.marriageId,
        leftId: unit.leftId,
        rightId: unit.rightId,
        highlighted: false,
        onPath: false,
        onAltPath: false,
        pathLane: null,
        dimmed: false,
        divorced: Boolean(marriage.divorced_at),
        marriedAt: marriage.married_at,
        tone: "primary",
        chromeAt,
      } satisfies CoupleNodeData,
      draggable: true,
      selectable: false,
      connectable: false,
      // Above secondary marriage chrome so the primary ring/date stay visible.
      zIndex: 1,
    });
  }

  const personNodes: Node[] = persons.map((person) => {
    const abs = positions.get(person.id) ?? { x: 0, y: 0 };
    const parentId = coupleParentByPerson.get(person.id);
    const parentBox = parentId ? coupleBoxById.get(parentId) : undefined;
    const inCouple = Boolean(parentId);
    return {
      id: person.id,
      type: "person",
      className: inCouple ? "in-couple-member" : undefined,
      position: parentBox
        ? { x: abs.x - parentBox.pos.x, y: abs.y - parentBox.pos.y }
        : abs,
      width: PERSON_NODE_WIDTH,
      height: PERSON_NODE_HEIGHT,
      data: {
        person,
        selected: false,
        highlighted: false,
        onPath: false,
        onAltPath: false,
        pathLane: null,
        dimmed: false,
        inCouple,
      } satisfies PersonNodeData,
      ...(parentId
        ? { parentId, extent: "parent" as const }
        : {}),
      draggable: !inCouple,
      selectable: true,
      zIndex: 2,
    };
  });

  // Extra marriages keep couple chrome without nesting the shared spouse twice.
  for (const marriage of marriages) {
    if (boxedMarriageIds.has(marriage.id)) continue;
    const a = byId.get(marriage.spouse_a_id);
    const b = byId.get(marriage.spouse_b_id);
    if (!a || !b) continue;
    const [leftId, rightId] = preferredSpouseOrder(a, b);
    const leftPos = positions.get(leftId);
    const rightPos = positions.get(rightId);
    if (!leftPos || !rightPos) continue;

    const id = coupleNodeId(marriage.id);
    const exclusivePos =
      !coupleParentByPerson.has(leftId)
        ? leftPos
        : !coupleParentByPerson.has(rightId)
          ? rightPos
          : null;
    const box = secondaryCoupleGeometry(leftPos, rightPos, exclusivePos);
    boxedMarriageIds.add(marriage.id);
    secondaryMarriageIds.add(marriage.id);
    coupleBoxById.set(id, {
      pos: box.position,
      width: box.width,
      height: box.height,
      chromeAt: box.chromeAt,
    });
    coupleNodes.push({
      id,
      type: "couple",
      position: box.position,
      width: box.width,
      height: box.height,
      style: { width: box.width, height: box.height },
      data: {
        marriageId: marriage.id,
        leftId,
        rightId,
        highlighted: false,
        onPath: false,
        onAltPath: false,
        pathLane: null,
        dimmed: false,
        divorced: Boolean(marriage.divorced_at),
        marriedAt: marriage.married_at,
        tone: "secondary",
        chromeAt: box.chromeAt,
      } satisfies CoupleNodeData,
      draggable: false,
      selectable: false,
      connectable: false,
      zIndex: 0,
    });
  }

  const nodes: Node[] = [...coupleNodes, ...personNodes];

  const edges: Edge[] = [];
  const linkedAsFamilyChild = new Set<string>();

  for (const marriage of marriages) {
    const a = byId.get(marriage.spouse_a_id);
    const b = byId.get(marriage.spouse_b_id);
    if (!a || !b) continue;

    const [leftId, rightId] = preferredSpouseOrder(a, b);
    const leftPos = positions.get(leftId);
    const rightPos = positions.get(rightId);
    if (!leftPos || !rightPos) continue;

    const divorced = Boolean(marriage.divorced_at);
    const kids = childrenOf(treeIndex, marriage.id);
    const spouseIds = [marriage.spouse_a_id, marriage.spouse_b_id];
    const kidIds = kids.map((child) => child.id);
    const familyTouchIds = [...spouseIds, ...kidIds];
    const boxed = boxedMarriageIds.has(marriage.id);
    const secondary = secondaryMarriageIds.has(marriage.id);
    const tone = secondary ? "secondary" : "primary";
    const boxedCoupleId = coupleNodeId(marriage.id);

    if (!boxed) {
      edges.push({
        id: `spouse-${marriage.id}`,
        source: leftId,
        target: rightId,
        sourceHandle: "spouse-out",
        targetHandle: "spouse-in",
        type: "straight",
        data: {
          kind: "spouse",
          marriageId: marriage.id,
          divorced,
          personIds: familyTouchIds,
          tone,
        } satisfies PedigreeEdgeData,
        interactionWidth: 28,
      });
    }

    if (kids.length === 0) continue;

    const unionId = `union-${marriage.id}`;
    const box = boxed ? coupleBoxById.get(boxedCoupleId) : undefined;
    const chromeAt =
      typeof box?.chromeAt === "number" && Number.isFinite(box.chromeAt)
        ? Math.min(1, Math.max(0, box.chromeAt))
        : 0.5;
    const unionPos = box
      ? {
          x: box.pos.x + box.width * chromeAt - UNION_SIZE / 2,
          y: box.pos.y + box.height + UNION_BOX_GAP,
        }
      : {
          x: coupleMid(leftId, rightId, positions)! - UNION_SIZE / 2,
          y: leftPos.y + PERSON_NODE_HEIGHT + UNION_OFFSET_Y,
        };

    nodes.push({
      id: unionId,
      type: "union",
      position: unionPos,
      width: UNION_SIZE,
      height: UNION_SIZE,
      data: {
        marriageId: marriage.id,
        leftId,
        rightId,
        highlighted: false,
        onPath: false,
        onAltPath: false,
        pathLane: null,
        dimmed: false,
        divorced,
        marriedAt: marriage.married_at,
        tone,
      } satisfies UnionNodeData,
      draggable: false,
      selectable: false,
      connectable: false,
      zIndex: 3,
    });

    if (boxed) {
      edges.push({
        id: `drop-${marriage.id}`,
        source: boxedCoupleId,
        target: unionId,
        sourceHandle: "out",
        targetHandle: "in",
        type: "straight",
        data: {
          kind: "drop",
          marriageId: marriage.id,
          divorced,
          personIds: familyTouchIds,
          tone,
        } satisfies PedigreeEdgeData,
        interactionWidth: 16,
      });
    } else {
      for (const spouseId of [leftId, rightId]) {
        edges.push({
          id: `drop-${marriage.id}-${spouseId}`,
          source: spouseId,
          target: unionId,
          sourceHandle: "child",
          targetHandle: "in",
          type: "straight",
          data: {
            kind: "drop",
            marriageId: marriage.id,
            divorced,
            personIds: familyTouchIds,
            tone,
          } satisfies PedigreeEdgeData,
          interactionWidth: 16,
        });
      }
    }

    for (const child of kids) {
      if (!positions.has(child.id)) continue;
      linkedAsFamilyChild.add(child.id);
      const childPerson = byId.get(child.id)!;
      const linkTypes = childPerson.parents
        .filter(
          (link) =>
            link.parent_id === marriage.spouse_a_id ||
            link.parent_id === marriage.spouse_b_id,
        )
        .map((link) => link.relationship_type);
      const relationshipType =
        linkTypes.find((type) => type !== "biological") ??
        linkTypes[0] ??
        "biological";

      edges.push({
        id: `child-${marriage.id}-${child.id}`,
        source: unionId,
        target: child.id,
        sourceHandle: "out",
        targetHandle: "parent",
        type: "smoothstep",
        data: {
          kind: "parent",
          marriageId: marriage.id,
          relationshipType,
          personIds: [...spouseIds, child.id],
          tone,
        } satisfies PedigreeEdgeData,
        interactionWidth: 20,
      });
    }
  }

  for (const person of persons) {
    if (linkedAsFamilyChild.has(person.id)) continue;
    for (const link of person.parents) {
      if (!byId.has(link.parent_id)) continue;
      edges.push({
        id: `parent-${link.parent_id}-${person.id}-${link.relationship_type}`,
        source: link.parent_id,
        target: person.id,
        sourceHandle: "child",
        targetHandle: "parent",
        type: "smoothstep",
        data: {
          kind: "parent",
          relationshipType: link.relationship_type,
          personIds: [link.parent_id, person.id],
        } satisfies PedigreeEdgeData,
        interactionWidth: 18,
      });
    }
  }

  return { nodes, edges };
}

export function personDisplayName(person: Person): string {
  const family = person.family_name?.trim();
  if (!family) return person.name;
  return `${person.name} ${family}`;
}

export function resolvePersonParents(
  person: Person,
  byId: Map<string, Person>,
): { father: Person | null; mother: Person | null } {
  let father: Person | null = null;
  let mother: Person | null = null;
  const leftover: Person[] = [];
  for (const link of person.parents) {
    const parent = byId.get(link.parent_id);
    if (!parent) continue;
    if (parent.gender === "male" && !father) father = parent;
    else if (parent.gender === "female" && !mother) mother = parent;
    else leftover.push(parent);
  }
  if (!father && leftover.length > 0) father = leftover.shift() ?? null;
  if (!mother && leftover.length > 0) mother = leftover.shift() ?? null;
  return { father, mother };
}
