/**
 * Adjacency indexes for a family tree.
 *
 * The layout and highlight code used to answer questions like "who are this
 * marriage's children?" by scanning every person, once per marriage. That is
 * O(persons x marriages), and it ran again on every graph rebuild. Building
 * these maps once costs a single linear pass and turns those questions into
 * lookups.
 *
 * Pure data in, pure data out — no DOM, no React.
 */

import type { Marriage, Person } from "@/lib/auth/types";

export type TreeIndex = {
  personById: Map<string, Person>;
  marriageById: Map<string, Marriage>;
  /** Children of each marriage, birth-date then name ordered. */
  childrenByMarriageId: Map<string, Person[]>;
  /** Marriages a person is a spouse in. */
  marriagesBySpouseId: Map<string, Marriage[]>;
  /** Children of each person, across all their marriages and parent links. */
  childrenByParentId: Map<string, Person[]>;
};

/**
 * Birth date first, then name. Dates are ISO-like strings, so a plain
 * comparison already orders them; `localeCompare` handles the name tiebreak.
 */
function byBirthThenName(a: Person, b: Person): number {
  const aDate = a.birth_date ?? "";
  const bDate = b.birth_date ?? "";
  if (aDate !== bDate) return aDate.localeCompare(bDate);
  return a.name.localeCompare(b.name);
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

export function buildTreeIndex(
  persons: Person[],
  marriages: Marriage[],
): TreeIndex {
  const personById = new Map(persons.map((person) => [person.id, person]));
  const marriageById = new Map(
    marriages.map((marriage) => [marriage.id, marriage]),
  );

  const marriagesBySpouseId = new Map<string, Marriage[]>();
  for (const marriage of marriages) {
    push(marriagesBySpouseId, marriage.spouse_a_id, marriage);
    push(marriagesBySpouseId, marriage.spouse_b_id, marriage);
  }

  /**
   * A child belongs to a marriage either by explicit `marriage_id`, or by
   * naming both spouses as parents. The second form needs a lookup keyed on the
   * *pair* of parents, so build that key per person and match marriages to it.
   */
  const marriageIdBySpousePair = new Map<string, string>();
  for (const marriage of marriages) {
    const pair = [marriage.spouse_a_id, marriage.spouse_b_id].sort().join("|");
    // First marriage wins, matching the old `.filter` which took the earliest.
    if (!marriageIdBySpousePair.has(pair)) {
      marriageIdBySpousePair.set(pair, marriage.id);
    }
  }

  const childrenByMarriageId = new Map<string, Person[]>();
  const childrenByParentId = new Map<string, Person[]>();

  for (const person of persons) {
    const parentIds = person.parents.map((link) => link.parent_id);
    for (const parentId of parentIds) {
      push(childrenByParentId, parentId, person);
    }

    if (person.marriage_id && marriageById.has(person.marriage_id)) {
      push(childrenByMarriageId, person.marriage_id, person);
      continue;
    }

    // Try every unordered pair of this person's parents against the marriages.
    // Parent counts are tiny (two in practice), so this stays effectively O(1).
    let matched: string | undefined;
    for (let i = 0; i < parentIds.length && !matched; i += 1) {
      for (let j = i + 1; j < parentIds.length && !matched; j += 1) {
        const pair = [parentIds[i]!, parentIds[j]!].sort().join("|");
        matched = marriageIdBySpousePair.get(pair);
      }
    }
    if (matched) push(childrenByMarriageId, matched, person);
  }

  for (const list of childrenByMarriageId.values()) list.sort(byBirthThenName);
  for (const list of childrenByParentId.values()) list.sort(byBirthThenName);

  return {
    personById,
    marriageById,
    childrenByMarriageId,
    marriagesBySpouseId,
    childrenByParentId,
  };
}

const NO_CHILDREN: readonly Person[] = [];

export function childrenOf(index: TreeIndex, marriageId: string): Person[] {
  return index.childrenByMarriageId.get(marriageId) ?? (NO_CHILDREN as Person[]);
}

export function marriagesOf(index: TreeIndex, personId: string): Marriage[] {
  return index.marriagesBySpouseId.get(personId) ?? [];
}

/**
 * Self, parents, spouses and children — the ring highlighted when a person is
 * selected. Now proportional to that person's degree instead of the tree size.
 */
export function neighborhoodOf(index: TreeIndex, personId: string): Set<string> {
  const focus = new Set<string>([personId]);
  const person = index.personById.get(personId);
  if (!person) return focus;

  for (const link of person.parents) focus.add(link.parent_id);

  for (const marriage of marriagesOf(index, personId)) {
    focus.add(marriage.spouse_a_id);
    focus.add(marriage.spouse_b_id);
    for (const child of childrenOf(index, marriage.id)) focus.add(child.id);
  }

  for (const child of index.childrenByParentId.get(personId) ?? []) {
    focus.add(child.id);
  }

  return focus;
}
