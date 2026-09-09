import type { Person } from "@/lib/auth/types";
import { parseIsoDate } from "@/lib/pedigree/dates";

export type GenderCounts = {
  male: number;
  female: number;
  total: number;
};

export type GenerationStats = GenderCounts & {
  generation: number;
  people: Person[];
};

export type DescendantStats = {
  generations: GenerationStats[];
  total: GenderCounts;
};

const NAMED_GENERATION_MAX = 5;

function emptyCounts(): GenderCounts {
  return { male: 0, female: 0, total: 0 };
}

function addPerson(counts: GenderCounts, person: Person) {
  counts.total += 1;
  if (person.gender === "male") counts.male += 1;
  else counts.female += 1;
}

function sortPeople(people: Person[]): Person[] {
  return [...people].sort((a, b) => {
    const aBirth = parseIsoDate(a.birth_date);
    const bBirth = parseIsoDate(b.birth_date);
    if (aBirth && bBirth) {
      if (aBirth.year !== bBirth.year) return aBirth.year - bBirth.year;
      if (aBirth.month !== bBirth.month) return aBirth.month - bBirth.month;
      if (aBirth.day !== bBirth.day) return aBirth.day - bBirth.day;
    } else if (aBirth) return -1;
    else if (bBirth) return 1;
    return a.name.localeCompare(b.name);
  });
}

function childrenByParentId(persons: Person[]): Map<string, Person[]> {
  const map = new Map<string, Person[]>();
  for (const person of persons) {
    for (const link of person.parents) {
      const list = map.get(link.parent_id) ?? [];
      list.push(person);
      map.set(link.parent_id, list);
    }
  }
  return map;
}

/**
 * Count unique descendants of `rootId` by generation (1 = children).
 * A person reachable by several paths is counted once, at the closest generation.
 */
export function countDescendantsByGeneration(
  rootId: string,
  persons: Person[],
): DescendantStats {
  const byId = new Map(persons.map((person) => [person.id, person]));
  const childrenMap = childrenByParentId(persons);
  const generationOf = new Map<string, number>([[rootId, 0]]);
  const queue = [rootId];

  while (queue.length > 0) {
    const id = queue.shift()!;
    const gen = generationOf.get(id) ?? 0;
    for (const child of childrenMap.get(id) ?? []) {
      const next = gen + 1;
      const existing = generationOf.get(child.id);
      if (existing === undefined || next < existing) {
        generationOf.set(child.id, next);
        queue.push(child.id);
      }
    }
  }

  const byGen = new Map<number, GenderCounts>();
  const peopleByGen = new Map<number, Person[]>();
  const total = emptyCounts();

  for (const [id, generation] of generationOf) {
    if (generation <= 0) continue;
    const person = byId.get(id);
    if (!person) continue;
    const bucket = byGen.get(generation) ?? emptyCounts();
    addPerson(bucket, person);
    byGen.set(generation, bucket);
    addPerson(total, person);
    const list = peopleByGen.get(generation) ?? [];
    list.push(person);
    peopleByGen.set(generation, list);
  }

  const generations = [...byGen.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([generation, counts]) => ({
      generation,
      ...counts,
      people: sortPeople(peopleByGen.get(generation) ?? []),
    }));

  return { generations, total };
}

export function namedGenerationKey(
  generation: number,
): "1" | "2" | "3" | "4" | "5" | "n" {
  if (generation >= 1 && generation <= NAMED_GENERATION_MAX) {
    return String(generation) as "1" | "2" | "3" | "4" | "5";
  }
  return "n";
}
