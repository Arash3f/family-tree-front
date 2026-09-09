import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTreeIndex,
  childrenOf,
  marriagesOf,
  neighborhoodOf,
} from "@/lib/pedigree/index-tree.ts";
import type { Marriage, Person } from "@/lib/auth/types";

type PersonSeed = {
  id: string;
  name?: string;
  birth?: string | null;
  parents?: string[];
  marriageId?: string | null;
};

function person(seed: PersonSeed): Person {
  return {
    id: seed.id,
    name: seed.name ?? seed.id,
    family_name: null,
    gender: "male",
    birth_date: seed.birth ?? null,
    death_date: null,
    birth_place: null,
    death_place: null,
    photo_url: null,
    photo_object_key: null,
    notes: null,
    marriage_id: seed.marriageId ?? null,
    parents: (seed.parents ?? []).map((parent_id) => ({
      parent_id,
      relationship_type: "biological" as const,
    })),
  };
}

function marriage(id: string, a: string, b: string): Marriage {
  return {
    id,
    spouse_a_id: a,
    spouse_b_id: b,
    married_at: "1970-01-01",
    divorced_at: null,
  };
}

/**
 * The scan this index replaced, kept verbatim as the oracle. Any divergence
 * between the two is a regression, not an improvement.
 */
function childrenOfMarriageByScan(
  persons: Person[],
  target: Marriage,
): Person[] {
  return persons
    .filter((p) => {
      if (p.marriage_id === target.id) return true;
      const parentIds = new Set(p.parents.map((link) => link.parent_id));
      return (
        parentIds.has(target.spouse_a_id) && parentIds.has(target.spouse_b_id)
      );
    })
    .sort((a, b) => {
      const aDate = a.birth_date ?? "";
      const bDate = b.birth_date ?? "";
      if (aDate !== bDate) return aDate.localeCompare(bDate);
      return a.name.localeCompare(b.name);
    });
}

test("children are found via explicit marriage_id", () => {
  const persons = [
    person({ id: "dad" }),
    person({ id: "mom" }),
    person({ id: "kid", marriageId: "m1" }),
  ];
  const marriages = [marriage("m1", "dad", "mom")];
  const index = buildTreeIndex(persons, marriages);

  assert.deepEqual(
    childrenOf(index, "m1").map((p) => p.id),
    ["kid"],
  );
});

test("children are found via both parents naming the same couple", () => {
  const persons = [
    person({ id: "dad" }),
    person({ id: "mom" }),
    person({ id: "kid", parents: ["dad", "mom"] }),
  ];
  const marriages = [marriage("m1", "dad", "mom")];
  const index = buildTreeIndex(persons, marriages);

  assert.deepEqual(
    childrenOf(index, "m1").map((p) => p.id),
    ["kid"],
  );
});

test("parent order does not matter when matching a couple", () => {
  const persons = [
    person({ id: "dad" }),
    person({ id: "mom" }),
    // Reversed relative to the marriage record.
    person({ id: "kid", parents: ["mom", "dad"] }),
  ];
  const index = buildTreeIndex(persons, [marriage("m1", "dad", "mom")]);

  assert.deepEqual(
    childrenOf(index, "m1").map((p) => p.id),
    ["kid"],
  );
});

test("a child of only one spouse is not attributed to the marriage", () => {
  const persons = [
    person({ id: "dad" }),
    person({ id: "mom" }),
    person({ id: "stepkid", parents: ["dad"] }),
  ];
  const index = buildTreeIndex(persons, [marriage("m1", "dad", "mom")]);

  assert.deepEqual(childrenOf(index, "m1"), []);
  assert.deepEqual(
    (index.childrenByParentId.get("dad") ?? []).map((p) => p.id),
    ["stepkid"],
  );
});

test("children are ordered by birth date, then name", () => {
  const persons = [
    person({ id: "dad" }),
    person({ id: "mom" }),
    person({ id: "c", name: "Zahra", birth: "1990-01-01", marriageId: "m1" }),
    person({ id: "a", name: "Ali", birth: "1985-06-01", marriageId: "m1" }),
    person({ id: "b", name: "Beh", birth: "1990-01-01", marriageId: "m1" }),
  ];
  const index = buildTreeIndex(persons, [marriage("m1", "dad", "mom")]);

  assert.deepEqual(
    childrenOf(index, "m1").map((p) => p.id),
    ["a", "b", "c"],
  );
});

test("people with no birth date sort before dated siblings", () => {
  const persons = [
    person({ id: "dad" }),
    person({ id: "mom" }),
    person({ id: "dated", birth: "1970-01-01", marriageId: "m1" }),
    person({ id: "undated", marriageId: "m1" }),
  ];
  const index = buildTreeIndex(persons, [marriage("m1", "dad", "mom")]);

  assert.deepEqual(
    childrenOf(index, "m1").map((p) => p.id),
    ["undated", "dated"],
  );
});

test("index agrees with the full scan across a mixed tree", () => {
  const persons: Person[] = [
    person({ id: "g1" }),
    person({ id: "g2" }),
    person({ id: "p1", birth: "1950-01-01", marriageId: "m1" }),
    person({ id: "p2", birth: "1952-01-01", parents: ["g1", "g2"] }),
    person({ id: "spouse" }),
    person({ id: "c1", birth: "1980-01-01", parents: ["p1", "spouse"] }),
    person({ id: "c2", birth: "1982-01-01", marriageId: "m2" }),
    person({ id: "orphan" }),
    person({ id: "halfkid", parents: ["p1"] }),
  ];
  const marriages = [
    marriage("m1", "g1", "g2"),
    marriage("m2", "p1", "spouse"),
  ];
  const index = buildTreeIndex(persons, marriages);

  for (const m of marriages) {
    assert.deepEqual(
      childrenOf(index, m.id).map((p) => p.id),
      childrenOfMarriageByScan(persons, m).map((p) => p.id),
      `marriage ${m.id} disagrees with the scan`,
    );
  }
});

test("spouse lookup returns every marriage a person appears in", () => {
  const persons = [
    person({ id: "a" }),
    person({ id: "b" }),
    person({ id: "c" }),
  ];
  const marriages = [marriage("m1", "a", "b"), marriage("m2", "a", "c")];
  const index = buildTreeIndex(persons, marriages);

  assert.deepEqual(
    marriagesOf(index, "a").map((m) => m.id),
    ["m1", "m2"],
  );
  assert.deepEqual(
    marriagesOf(index, "b").map((m) => m.id),
    ["m1"],
  );
  assert.deepEqual(marriagesOf(index, "nobody"), []);
});

test("neighborhood covers self, parents, spouses and children", () => {
  const persons = [
    person({ id: "grandpa" }),
    person({ id: "grandma" }),
    person({ id: "me", parents: ["grandpa", "grandma"] }),
    person({ id: "wife" }),
    person({ id: "son", marriageId: "m2" }),
    person({ id: "stranger" }),
  ];
  const marriages = [
    marriage("m1", "grandpa", "grandma"),
    marriage("m2", "me", "wife"),
  ];
  const index = buildTreeIndex(persons, marriages);

  const focus = neighborhoodOf(index, "me");
  assert.deepEqual(
    [...focus].sort(),
    ["grandma", "grandpa", "me", "son", "wife"],
  );
  assert.ok(!focus.has("stranger"));
});

test("neighborhood of an unknown person is just that id", () => {
  const index = buildTreeIndex([person({ id: "a" })], []);
  assert.deepEqual([...neighborhoodOf(index, "ghost")], ["ghost"]);
});

test("children reached only through a parent link still appear in the neighborhood", () => {
  const persons = [
    person({ id: "parent" }),
    // No marriage, so this child is only reachable via childrenByParentId.
    person({ id: "kid", parents: ["parent"] }),
  ];
  const index = buildTreeIndex(persons, []);

  assert.ok(neighborhoodOf(index, "parent").has("kid"));
});

test("a dangling marriage_id does not invent a child", () => {
  const persons = [person({ id: "kid", marriageId: "gone" })];
  const index = buildTreeIndex(persons, []);

  assert.deepEqual(childrenOf(index, "gone"), []);
});

test("building an index is linear, not quadratic", () => {
  // 4000 persons across 1000 marriages. The old scan would do ~4,000,000
  // comparisons here; this should stay far below any timeout.
  const persons: Person[] = [];
  const marriages: Marriage[] = [];
  for (let i = 0; i < 1000; i += 1) {
    persons.push(person({ id: `a${i}` }), person({ id: `b${i}` }));
    marriages.push(marriage(`m${i}`, `a${i}`, `b${i}`));
    persons.push(
      person({ id: `c${i}`, marriageId: `m${i}`, birth: "1990-01-01" }),
      person({ id: `d${i}`, parents: [`a${i}`, `b${i}`], birth: "1992-01-01" }),
    );
  }

  const started = performance.now();
  const index = buildTreeIndex(persons, marriages);
  const elapsed = performance.now() - started;

  assert.equal(index.childrenByMarriageId.size, 1000);
  for (let i = 0; i < 1000; i += 1) {
    assert.deepEqual(
      childrenOf(index, `m${i}`).map((p) => p.id),
      [`c${i}`, `d${i}`],
    );
  }
  assert.ok(elapsed < 1000, `indexing 4000 people took ${elapsed}ms`);
});
