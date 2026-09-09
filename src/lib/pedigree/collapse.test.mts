import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveBranchCollapse,
  subsetWithoutHidden,
  type BranchCollapseState,
} from "@/lib/pedigree/collapse.ts";
import type { Marriage, Person } from "@/lib/auth/types";

type PersonSeed = {
  id: string;
  parents?: string[];
};

function person(seed: PersonSeed): Person {
  return {
    id: seed.id,
    name: seed.id,
    family_name: null,
    gender: "male",
    birth_date: null,
    death_date: null,
    birth_place: null,
    death_place: null,
    photo_url: null,
    photo_object_key: null,
    notes: null,
    marriage_id: null,
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

function state(partial: Partial<BranchCollapseState>): BranchCollapseState {
  return {
    collapsed: partial.collapsed ?? new Set(),
    hidden: partial.hidden ?? new Set(),
  };
}

/**
 * grandpa × grandma
 *   ├── father × mother (mother married in)
 *   │     └── child
 *   └── aunt
 */
const persons = [
  person({ id: "grandpa" }),
  person({ id: "grandma" }),
  person({ id: "father", parents: ["grandpa", "grandma"] }),
  person({ id: "aunt", parents: ["grandpa", "grandma"] }),
  person({ id: "mother" }),
  person({ id: "child", parents: ["father", "mother"] }),
];
const marriages = [
  marriage("m1", "grandpa", "grandma"),
  marriage("m2", "father", "mother"),
];

test("collapsing keeps the root and folds away the line below it", () => {
  const result = resolveBranchCollapse(
    persons,
    marriages,
    state({ collapsed: new Set(["father"]) }),
  );
  assert.deepEqual([...result.hiddenPersonIds].sort(), ["child"]);
  assert.equal(result.countByRoot.get("father"), 1);
});

test("hiding a person takes the person and their married-in spouse", () => {
  const result = resolveBranchCollapse(
    persons,
    marriages,
    state({ hidden: new Set(["father"]) }),
  );
  assert.deepEqual(
    [...result.hiddenPersonIds].sort(),
    ["child", "father", "mother"],
  );
  assert.equal(result.countByRoot.get("father"), 3);
});

test("a spouse with their own parents on the canvas stays", () => {
  const inLaws = [
    ...persons,
    person({ id: "mother-dad" }),
    person({ id: "mother-with-line", parents: ["mother-dad"] }),
    person({ id: "grandchild", parents: ["child", "mother-with-line"] }),
  ];
  const inLawMarriages = [
    ...marriages,
    marriage("m3", "child", "mother-with-line"),
  ];

  const result = resolveBranchCollapse(
    inLaws,
    inLawMarriages,
    state({ collapsed: new Set(["father"]) }),
  );
  assert.deepEqual(
    [...result.hiddenPersonIds].sort(),
    ["child", "grandchild"],
  );
});

test("collapsing one parent does not fold the co-parent away", () => {
  const result = resolveBranchCollapse(
    persons,
    marriages,
    state({ collapsed: new Set(["father"]) }),
  );
  assert.ok(!result.hiddenPersonIds.has("mother"));
});

test("folds nest: a root inside a hidden branch disappears with it", () => {
  const result = resolveBranchCollapse(
    persons,
    marriages,
    state({ hidden: new Set(["grandpa"]), collapsed: new Set(["father"]) }),
  );
  assert.deepEqual(
    [...result.hiddenPersonIds].sort(),
    ["aunt", "child", "father", "grandma", "grandpa", "mother"],
  );
});

test("roots that no longer exist are ignored", () => {
  const result = resolveBranchCollapse(
    persons,
    marriages,
    state({ collapsed: new Set(["deleted"]) }),
  );
  assert.equal(result.hiddenPersonIds.size, 0);
  assert.equal(result.countByRoot.size, 0);
});

test("a parent link cycle terminates", () => {
  const cyclic = [
    person({ id: "a", parents: ["b"] }),
    person({ id: "b", parents: ["a"] }),
  ];
  const result = resolveBranchCollapse(
    cyclic,
    [],
    state({ collapsed: new Set(["a"]) }),
  );
  assert.deepEqual([...result.hiddenPersonIds], ["b"]);
});

test("subsetWithoutHidden drops marriages that lost a spouse", () => {
  const hidden = new Set(["mother"]);
  const subset = subsetWithoutHidden(persons, marriages, hidden);
  assert.deepEqual(
    subset.persons.map((p) => p.id).sort(),
    ["aunt", "child", "father", "grandma", "grandpa"],
  );
  assert.deepEqual(subset.marriages.map((m) => m.id), ["m1"]);
});

test("no folds means the original arrays are handed back untouched", () => {
  const subset = subsetWithoutHidden(persons, marriages, new Set());
  assert.equal(subset.persons, persons);
  assert.equal(subset.marriages, marriages);
});
