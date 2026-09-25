import assert from "node:assert/strict";
import test from "node:test";

import type { Person } from "@/lib/auth/types";
import {
  buildMaleLineTree,
  maleLinePersonCount,
} from "@/lib/pedigree/male-line.ts";
import { layoutMaleLine } from "@/lib/pedigree/male-line-layout.ts";

function person(seed: {
  id: string;
  name?: string;
  family?: string | null;
  gender?: "male" | "female";
  birth?: string | null;
  parents?: string[];
}): Person {
  return {
    id: seed.id,
    name: seed.name ?? seed.id,
    family_name: seed.family ?? null,
    gender: seed.gender ?? "male",
    birth_date: seed.birth ?? null,
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

test("male line keeps sons of sons and skips daughters", () => {
  const persons = [
    person({ id: "root", name: "Ali", family: "Karimi" }),
    person({ id: "son", name: "Hasan", family: "Karimi", parents: ["root"], birth: "1980-01-01" }),
    person({
      id: "daughter",
      name: "Zahra",
      family: "Karimi",
      gender: "female",
      parents: ["root"],
      birth: "1982-01-01",
    }),
    person({
      id: "sonInLaw",
      name: "Reza",
      family: "Ahmadi",
      parents: [], // husband of daughter — not a child of root
    }),
    person({
      id: "daughterSon",
      name: "Omid",
      family: "Ahmadi",
      parents: ["daughter", "sonInLaw"],
      birth: "2005-01-01",
    }),
    person({
      id: "grandson",
      name: "Hossein",
      family: "Karimi",
      parents: ["son"],
      birth: "2008-01-01",
    }),
  ];

  const tree = buildMaleLineTree("root", persons);
  assert.ok(tree);
  assert.equal(tree.label, "Ali Karimi");
  assert.equal(tree.children.length, 1);
  assert.equal(tree.children[0]!.id, "son");
  assert.equal(tree.children[0]!.children.length, 1);
  assert.equal(tree.children[0]!.children[0]!.id, "grandson");
  assert.equal(maleLinePersonCount(tree), 3);
});

test("son-in-law never appears even if linked as child somehow", () => {
  // Defensive: if a male were wrongly parent-linked through a daughter path,
  // only direct male children of included males are walked — daughter's kids
  // are unreachable because the daughter is never visited.
  const persons = [
    person({ id: "root", name: "Ali" }),
    person({
      id: "d",
      name: "Sara",
      gender: "female",
      parents: ["root"],
    }),
    person({
      id: "sil",
      name: "Husband",
      parents: ["d"],
    }),
  ];
  const tree = buildMaleLineTree("root", persons);
  assert.ok(tree);
  assert.equal(tree.children.length, 0);
  assert.equal(maleLinePersonCount(tree), 1);
});

test("female root still starts the chart; only her sons branch", () => {
  const persons = [
    person({ id: "mom", name: "Maryam", gender: "female" }),
    person({ id: "boy", name: "Nima", parents: ["mom"] }),
    person({
      id: "girl",
      name: "Neda",
      gender: "female",
      parents: ["mom"],
    }),
  ];
  const tree = buildMaleLineTree("mom", persons);
  assert.ok(tree);
  assert.equal(tree.id, "mom");
  assert.equal(tree.children.length, 1);
  assert.equal(tree.children[0]!.id, "boy");
});

test("layout produces boxes for every node and edges when there are sons", () => {
  const tree = buildMaleLineTree("root", [
    person({ id: "root", name: "A" }),
    person({ id: "b", name: "B", parents: ["root"] }),
    person({ id: "c", name: "C", parents: ["root"] }),
  ]);
  assert.ok(tree);
  const graphic = layoutMaleLine(tree);
  assert.equal(graphic.boxes.length, 3);
  assert.ok(graphic.edges.length >= 2);
  assert.ok(graphic.width > 0);
  assert.ok(graphic.height > 0);
});

test("missing root returns null", () => {
  assert.equal(buildMaleLineTree("nope", []), null);
});
