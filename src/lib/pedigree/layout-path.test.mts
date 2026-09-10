import assert from "node:assert/strict";
import test from "node:test";

import type { Marriage, Person } from "@/lib/auth/types";
import { buildTreeIndex } from "@/lib/pedigree/index-tree.ts";
import {
  buildPedigreeGraph,
  subsetForPath,
} from "@/lib/pedigree/layout.ts";

type PersonSeed = {
  id: string;
  name?: string;
  gender?: Person["gender"];
  parents?: string[];
  marriageId?: string | null;
};

function person(seed: PersonSeed): Person {
  return {
    id: seed.id,
    name: seed.name ?? seed.id,
    family_name: null,
    gender: seed.gender ?? "male",
    birth_date: null,
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

/** Spouses + shared child — the classic alternate-path triangle. */
function spouseChildFixture() {
  const persons = [
    person({ id: "a", gender: "male" }),
    person({ id: "b", gender: "female" }),
    person({ id: "kid", parents: ["a", "b"], marriageId: "m1" }),
  ];
  const marriages = [marriage("m1", "a", "b")];
  const index = buildTreeIndex(persons, marriages);
  return { persons, marriages, index };
}

test("spouse hop keeps the marriage in the path subset", () => {
  const { persons, marriages, index } = spouseChildFixture();
  const pathIds = new Set(["a", "b"]);
  const subset = subsetForPath(persons, marriages, pathIds, index, [
    ["a", "b"],
  ]);
  assert.equal(subset.marriages.length, 1);
  assert.equal(subset.marriages[0]?.id, "m1");
  assert.deepEqual(
    subset.persons.map((p) => p.id).sort(),
    ["a", "b"].sort(),
  );
});

test("via-child path does not keep the spouse chord", () => {
  const { persons, marriages, index } = spouseChildFixture();
  const pathIds = new Set(["a", "kid", "b"]);
  const subset = subsetForPath(persons, marriages, pathIds, index, [
    ["a", "kid", "b"],
  ]);
  assert.equal(subset.marriages.length, 0);
  assert.deepEqual(
    subset.persons.map((p) => p.id).sort(),
    ["a", "b", "kid"].sort(),
  );

  const graph = buildPedigreeGraph({
    ...subset,
    pathLayout: { orders: [["a", "kid", "b"]], compact: true },
  });
  assert.equal(
    graph.nodes.some((node) => node.id === "couple-m1"),
    false,
    "couple chrome must not appear for a via-child corridor",
  );
  assert.equal(
    graph.edges.some((edge) => edge.id === "spouse-m1"),
    false,
  );
});

test("one parent on path still pulls the co-parent couple", () => {
  const { persons, marriages, index } = spouseChildFixture();
  const pathIds = new Set(["a", "kid"]);
  const subset = subsetForPath(persons, marriages, pathIds, index, [
    ["a", "kid"],
  ]);
  assert.equal(subset.marriages.length, 1);
  assert.ok(subset.persons.some((p) => p.id === "b"));
});

test("all-paths orders keep a marriage when any corridor uses the spouse hop", () => {
  const { persons, marriages, index } = spouseChildFixture();
  const pathIds = new Set(["a", "b", "kid"]);
  const subset = subsetForPath(persons, marriages, pathIds, index, [
    ["a", "b"],
    ["a", "kid", "b"],
  ]);
  assert.equal(subset.marriages.length, 1);
});
