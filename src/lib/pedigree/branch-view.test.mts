import assert from "node:assert/strict";
import test from "node:test";

import type { Marriage, Person } from "@/lib/auth/types";
import { subsetForBranchView } from "@/lib/pedigree/branch-view.ts";

function person(seed: {
  id: string;
  gender?: "male" | "female";
  parents?: string[];
  marriage?: string | null;
}): Person {
  return {
    id: seed.id,
    name: seed.id,
    family_name: null,
    gender: seed.gender ?? "male",
    birth_date: null,
    death_date: null,
    birth_place: null,
    death_place: null,
    photo_url: null,
    photo_object_key: null,
    notes: null,
    marriage_id: seed.marriage ?? null,
    parents: (seed.parents ?? []).map((parent_id) => ({
      parent_id,
      relationship_type: "biological" as const,
    })),
  };
}

function marriage(seed: { id: string; a: string; b: string }): Marriage {
  return {
    id: seed.id,
    spouse_a_id: seed.a,
    spouse_b_id: seed.b,
    married_at: null,
    divorced_at: null,
  };
}

/**
 * grandparents (gf + gm) → root (+ wife) → child (+ wife) → grandchild
 */
const persons: Person[] = [
  person({ id: "gf" }),
  person({ id: "gm", gender: "female" }),
  person({ id: "root", parents: ["gf", "gm"] }),
  person({ id: "wife", gender: "female" }),
  person({ id: "child", parents: ["root", "wife"] }),
  person({ id: "childWife", gender: "female" }),
  person({ id: "grandchild", parents: ["child", "childWife"] }),
  person({ id: "stranger" }),
];

const marriages: Marriage[] = [
  marriage({ id: "m-gp", a: "gf", b: "gm" }),
  marriage({ id: "m-root", a: "root", b: "wife" }),
  marriage({ id: "m-child", a: "child", b: "childWife" }),
];

function ids(result: { persons: Person[] }): string[] {
  return result.persons.map((item) => item.id).sort();
}

test("depth 1 keeps the children and their spouses, not the grandchildren", () => {
  const result = subsetForBranchView(persons, marriages, "root", {
    depth: 1,
    includeParents: false,
  });
  assert.deepEqual(ids(result), ["child", "childWife", "root", "wife"]);
  assert.deepEqual(
    result.marriages.map((item) => item.id).sort(),
    ["m-child", "m-root"],
  );
});

test("a null depth keeps the whole branch", () => {
  const result = subsetForBranchView(persons, marriages, "root", {
    depth: null,
    includeParents: false,
  });
  assert.deepEqual(ids(result), [
    "child",
    "childWife",
    "grandchild",
    "root",
    "wife",
  ]);
});

test("includeParents adds the generation above, with its couple intact", () => {
  const result = subsetForBranchView(persons, marriages, "root", {
    depth: 1,
    includeParents: true,
  });
  assert.ok(ids(result).includes("gf"));
  assert.ok(ids(result).includes("gm"));
  assert.ok(result.marriages.some((item) => item.id === "m-gp"));
  assert.ok(!ids(result).includes("stranger"));
});

test("an unknown root yields nothing", () => {
  const result = subsetForBranchView(persons, marriages, "missing", {
    depth: null,
    includeParents: true,
  });
  assert.deepEqual(result.persons, []);
  assert.deepEqual(result.marriages, []);
});
