/**
 * Patrilineal (male-line) descendant tree.
 *
 * From a chosen root, only male children are kept, and only those males are
 * traversed further. Daughters never enter the tree, so sons-in-law and any
 * descendants through daughters are excluded automatically.
 */

import type { Person } from "@/lib/auth/types";
import { parseIsoDate } from "@/lib/pedigree/dates";
import { personDisplayName } from "@/lib/pedigree/layout";

export type MaleLineNode = {
  id: string;
  label: string;
  children: MaleLineNode[];
};

function sortSons(a: Person, b: Person): number {
  const aBirth = parseIsoDate(a.birth_date);
  const bBirth = parseIsoDate(b.birth_date);
  if (aBirth && bBirth) {
    if (aBirth.year !== bBirth.year) return aBirth.year - bBirth.year;
    if (aBirth.month !== bBirth.month) return aBirth.month - bBirth.month;
    if (aBirth.day !== bBirth.day) return aBirth.day - bBirth.day;
  } else if (aBirth) return -1;
  else if (bBirth) return 1;
  return a.name.localeCompare(b.name);
}

function sonsByFatherId(persons: Person[]): Map<string, Person[]> {
  const map = new Map<string, Person[]>();
  for (const person of persons) {
    if (person.gender !== "male") continue;
    for (const link of person.parents) {
      const list = map.get(link.parent_id) ?? [];
      list.push(person);
      map.set(link.parent_id, list);
    }
  }
  for (const list of map.values()) list.sort(sortSons);
  return map;
}

function countNodes(node: MaleLineNode): number {
  let total = 1;
  for (const child of node.children) total += countNodes(child);
  return total;
}

/**
 * Build the male-line tree rooted at `rootId`.
 * Returns null when the root person is missing from `persons`.
 */
export function buildMaleLineTree(
  rootId: string,
  persons: Person[],
): MaleLineNode | null {
  const byId = new Map(persons.map((person) => [person.id, person]));
  const root = byId.get(rootId);
  if (!root) return null;

  const sonsOf = sonsByFatherId(persons);
  const visiting = new Set<string>();

  const walk = (person: Person): MaleLineNode => {
    visiting.add(person.id);
    const children: MaleLineNode[] = [];
    for (const son of sonsOf.get(person.id) ?? []) {
      if (visiting.has(son.id)) continue;
      children.push(walk(son));
    }
    visiting.delete(person.id);
    return {
      id: person.id,
      label: personDisplayName(person),
      children,
    };
  };

  return walk(root);
}

export function maleLinePersonCount(root: MaleLineNode): number {
  return countNodes(root);
}
