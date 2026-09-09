import type {
  TreeExcelPreviewMarriage,
  TreeExcelPreviewPerson,
  TreeExcelPreviewResult,
} from "@/lib/auth/client";

export function isImportablePerson(person: TreeExcelPreviewPerson): boolean {
  return !person.already_exists && !person.duplicate_of_ref;
}

export function isImportableMarriage(
  marriage: TreeExcelPreviewMarriage,
): boolean {
  return !marriage.already_exists && !marriage.duplicate_of_ref;
}

export function defaultExcelSelection(preview: TreeExcelPreviewResult): {
  persons: Set<string>;
  marriages: Set<string>;
} {
  return {
    persons: new Set(
      preview.persons.filter(isImportablePerson).map((person) => person.ref),
    ),
    marriages: new Set(
      preview.marriages
        .filter((marriage) => isImportableMarriage(marriage) && !marriage.warning)
        .map((marriage) => marriage.ref),
    ),
  };
}

/**
 * Everything that has to come along when one person is picked: their ancestors
 * and the marriages tying them together. Rows already in the tree stop the
 * walk, since importing them again would duplicate people.
 */
export function collectPersonImportGraph(
  startRef: string,
  preview: TreeExcelPreviewResult,
): { people: Set<string>; marriages: Set<string> } {
  const people = new Set<string>();
  const marriages = new Set<string>();
  const personsByRef = new Map(
    preview.persons.map((person) => [person.ref, person]),
  );
  const marriagesByRef = new Map(
    preview.marriages.map((marriage) => [marriage.ref, marriage]),
  );
  const queue = [startRef];
  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) continue;
    const person = personsByRef.get(current);
    if (!person || !isImportablePerson(person) || people.has(current)) continue;
    people.add(current);
    for (const parentRef of [person.parent1_ref, person.parent2_ref]) {
      if (parentRef) queue.push(parentRef);
    }
    if (!person.marriage_ref) continue;
    const marriage = marriagesByRef.get(person.marriage_ref);
    if (!marriage || !isImportableMarriage(marriage) || marriages.has(marriage.ref)) {
      continue;
    }
    marriages.add(marriage.ref);
    queue.push(marriage.spouse_a_ref, marriage.spouse_b_ref);
  }
  return { people, marriages };
}
