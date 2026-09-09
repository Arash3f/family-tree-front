/**
 * Folding branches away from the canvas.
 *
 * Two shapes of the same idea:
 *  - collapsed: the person stays, everything below them goes;
 *  - hidden: the person goes too.
 *
 * The people that disappear are removed from the graph input rather than
 * flagged on the rendered nodes, so the layout closes the gap they leave and an
 * exported image shows the trimmed tree instead of a hole.
 *
 * Pure data in, pure data out — no DOM, no React.
 */

import type { Marriage, Person } from "@/lib/auth/types";

export type BranchCollapseState = {
  /** Roots whose descendants are folded away; the root itself still renders. */
  collapsed: Set<string>;
  /** Roots that are folded away together with their descendants. */
  hidden: Set<string>;
};

export type BranchCollapseResult = {
  /** Everyone kept off the canvas, from every fold combined. */
  hiddenPersonIds: Set<string>;
  /** People each root takes with it — the count shown on its card. */
  countByRoot: Map<string, number>;
};

const NO_HIDDEN: BranchCollapseResult = {
  hiddenPersonIds: new Set(),
  countByRoot: new Map(),
};

export function emptyBranchCollapseState(): BranchCollapseState {
  return { collapsed: new Set(), hidden: new Set() };
}

function childIdsByParent(persons: Person[]): Map<string, string[]> {
  const children = new Map<string, string[]>();
  for (const person of persons) {
    for (const link of person.parents) {
      const list = children.get(link.parent_id);
      if (list) list.push(person.id);
      else children.set(link.parent_id, [person.id]);
    }
  }
  return children;
}

function spouseIdsByPerson(marriages: Marriage[]): Map<string, string[]> {
  const spouses = new Map<string, string[]>();
  for (const marriage of marriages) {
    const a = spouses.get(marriage.spouse_a_id);
    if (a) a.push(marriage.spouse_b_id);
    else spouses.set(marriage.spouse_a_id, [marriage.spouse_b_id]);
    const b = spouses.get(marriage.spouse_b_id);
    if (b) b.push(marriage.spouse_a_id);
    else spouses.set(marriage.spouse_b_id, [marriage.spouse_a_id]);
  }
  return spouses;
}

/** Descendants of a person, the root excluded. Cycle-safe. */
export function descendantIdsOf(
  rootId: string,
  childrenByParentId: Map<string, string[]>,
): Set<string> {
  const found = new Set<string>();
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const childId of childrenByParentId.get(id) ?? []) {
      if (childId === rootId || found.has(childId)) continue;
      found.add(childId);
      queue.push(childId);
    }
  }
  return found;
}

/**
 * Everyone one fold removes: the descendants, plus the spouses who married
 * into them. A spouse only goes when the tree holds no parents for them and
 * every marriage they have lands inside the fold — otherwise they belong to a
 * line that is still on screen and would lose their own place.
 */
function branchScope(
  rootId: string,
  includeRoot: boolean,
  childrenByParentId: Map<string, string[]>,
  spousesByPersonId: Map<string, string[]>,
  rootedIds: Set<string>,
): Set<string> {
  const scope = descendantIdsOf(rootId, childrenByParentId);
  if (includeRoot) scope.add(rootId);

  const marriedIn: string[] = [];
  for (const id of scope) {
    for (const spouseId of spousesByPersonId.get(id) ?? []) {
      if (scope.has(spouseId) || rootedIds.has(spouseId)) continue;
      const theirSpouses = spousesByPersonId.get(spouseId) ?? [];
      if (theirSpouses.every((otherId) => scope.has(otherId))) {
        marriedIn.push(spouseId);
      }
    }
  }
  for (const id of marriedIn) scope.add(id);
  if (!includeRoot) scope.delete(rootId);
  return scope;
}

/**
 * Resolve the folds against the current tree. Roots that no longer exist —
 * deleted since the fold was stored — are ignored rather than reported.
 */
export function resolveBranchCollapse(
  persons: Person[],
  marriages: Marriage[],
  state: BranchCollapseState,
): BranchCollapseResult {
  if (state.collapsed.size === 0 && state.hidden.size === 0) return NO_HIDDEN;

  const known = new Set(persons.map((person) => person.id));
  const childrenByParentId = childIdsByParent(persons);
  const spousesByPersonId = spouseIdsByPerson(marriages);
  /** Anyone with a parent on the canvas keeps their place in their own line. */
  const rootedIds = new Set(
    persons
      .filter((person) => person.parents.some((link) => known.has(link.parent_id)))
      .map((person) => person.id),
  );

  const hiddenPersonIds = new Set<string>();
  const countByRoot = new Map<string, number>();

  const fold = (rootId: string, includeRoot: boolean) => {
    if (!known.has(rootId)) return;
    const scope = branchScope(
      rootId,
      includeRoot,
      childrenByParentId,
      spousesByPersonId,
      rootedIds,
    );
    countByRoot.set(rootId, scope.size);
    for (const id of scope) hiddenPersonIds.add(id);
  };

  for (const rootId of state.hidden) fold(rootId, true);
  for (const rootId of state.collapsed) {
    if (state.hidden.has(rootId)) continue;
    fold(rootId, false);
  }

  return { hiddenPersonIds, countByRoot };
}

/** The graph input with the folded people — and their marriages — dropped. */
export function subsetWithoutHidden(
  persons: Person[],
  marriages: Marriage[],
  hiddenPersonIds: Set<string>,
): { persons: Person[]; marriages: Marriage[] } {
  if (hiddenPersonIds.size === 0) return { persons, marriages };
  return {
    persons: persons.filter((person) => !hiddenPersonIds.has(person.id)),
    marriages: marriages.filter(
      (marriage) =>
        !hiddenPersonIds.has(marriage.spouse_a_id) &&
        !hiddenPersonIds.has(marriage.spouse_b_id),
    ),
  };
}
