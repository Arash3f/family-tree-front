import assert from "node:assert/strict";
import test from "node:test";

import {
  collectPersonImportGraph,
  defaultExcelSelection,
  isImportableMarriage,
  isImportablePerson,
} from "@/components/app/pedigree/excel-import.ts";
import type {
  TreeExcelPreviewMarriage,
  TreeExcelPreviewPerson,
  TreeExcelPreviewResult,
} from "@/lib/auth/client";

type PersonSeed = Partial<TreeExcelPreviewPerson> & { ref: string };
type MarriageSeed = Partial<TreeExcelPreviewMarriage> & { ref: string };

function person(seed: PersonSeed): TreeExcelPreviewPerson {
  return {
    name: seed.ref,
    family_name: null,
    gender: "male",
    birth_date: null,
    death_date: null,
    parent1_ref: null,
    parent2_ref: null,
    marriage_ref: null,
    row_number: 1,
    already_exists: false,
    existing_label: null,
    duplicate_of_ref: null,
    warning: null,
    parent1_label: null,
    parent2_label: null,
    marriage_label: null,
    ...seed,
  };
}

function marriage(seed: MarriageSeed): TreeExcelPreviewMarriage {
  return {
    spouse_a_ref: "a",
    spouse_b_ref: "b",
    married_at: "1990-01-01",
    divorced_at: null,
    row_number: 1,
    already_exists: false,
    duplicate_of_ref: null,
    warning: null,
    spouse_a_label: null,
    spouse_b_label: null,
    ...seed,
  };
}

function preview(
  persons: TreeExcelPreviewPerson[],
  marriages: TreeExcelPreviewMarriage[] = [],
): TreeExcelPreviewResult {
  return { valid: true, persons, marriages, errors: [] };
}

test("rows already in the tree or duplicated are not importable", () => {
  assert.equal(isImportablePerson(person({ ref: "p1" })), true);
  assert.equal(
    isImportablePerson(person({ ref: "p1", already_exists: true })),
    false,
  );
  assert.equal(
    isImportablePerson(person({ ref: "p2", duplicate_of_ref: "p1" })),
    false,
  );
  assert.equal(
    isImportablePerson(
      person({ ref: "p3", warning: "Same name identity as 'p1' in this file" }),
    ),
    true,
  );
  assert.equal(isImportableMarriage(marriage({ ref: "m1" })), true);
  assert.equal(
    isImportableMarriage(marriage({ ref: "m1", already_exists: true })),
    false,
  );
});

test("default selection includes namesake warnings as new people", () => {
  const selection = defaultExcelSelection(
    preview([
      person({ ref: "ali-1" }),
      person({
        ref: "ali-2",
        warning: "Same name identity as 'ali-1' in this file",
      }),
      person({ ref: "existing", already_exists: true }),
    ]),
  );

  assert.deepEqual([...selection.persons].sort(), ["ali-1", "ali-2"]);
});

test("default selection takes every importable person", () => {
  const selection = defaultExcelSelection(
    preview([
      person({ ref: "new" }),
      person({ ref: "existing", already_exists: true }),
      person({ ref: "dupe", duplicate_of_ref: "new" }),
    ]),
  );

  assert.deepEqual([...selection.persons], ["new"]);
});

test("default selection skips marriages carrying a warning", () => {
  const selection = defaultExcelSelection(
    preview(
      [],
      [
        marriage({ ref: "clean" }),
        marriage({ ref: "warned", warning: "spouse missing" }),
        marriage({ ref: "existing", already_exists: true }),
      ],
    ),
  );

  assert.deepEqual([...selection.marriages], ["clean"]);
});

test("picking a person pulls in ancestors and their marriages", () => {
  const result = collectPersonImportGraph(
    "kid",
    preview(
      [
        person({ ref: "kid", parent1_ref: "dad", parent2_ref: "mom" }),
        person({ ref: "dad", marriage_ref: "m1" }),
        person({ ref: "mom", marriage_ref: "m1" }),
        person({ ref: "grandpa" }),
        person({ ref: "stranger" }),
      ],
      [marriage({ ref: "m1", spouse_a_ref: "dad", spouse_b_ref: "mom" })],
    ),
  );

  assert.deepEqual([...result.people].sort(), ["dad", "kid", "mom"]);
  assert.deepEqual([...result.marriages], ["m1"]);
});

test("a marriage drags in both spouses even when only one is an ancestor", () => {
  const result = collectPersonImportGraph(
    "kid",
    preview(
      [
        person({ ref: "kid", parent1_ref: "dad" }),
        person({ ref: "dad", marriage_ref: "m1" }),
        person({ ref: "stepmom" }),
      ],
      [marriage({ ref: "m1", spouse_a_ref: "dad", spouse_b_ref: "stepmom" })],
    ),
  );

  assert.deepEqual([...result.people].sort(), ["dad", "kid", "stepmom"]);
});

test("people already in the tree stop the walk", () => {
  const result = collectPersonImportGraph(
    "kid",
    preview([
      person({ ref: "kid", parent1_ref: "dad" }),
      person({ ref: "dad", already_exists: true, parent1_ref: "grandpa" }),
      person({ ref: "grandpa" }),
    ]),
  );

  assert.deepEqual([...result.people], ["kid"]);
});

test("a marriage that already exists is not selected with its spouses", () => {
  const result = collectPersonImportGraph(
    "kid",
    preview(
      [
        person({ ref: "kid", parent1_ref: "dad" }),
        person({ ref: "dad", marriage_ref: "m1" }),
        person({ ref: "mom" }),
      ],
      [
        marriage({
          ref: "m1",
          spouse_a_ref: "dad",
          spouse_b_ref: "mom",
          already_exists: true,
        }),
      ],
    ),
  );

  assert.deepEqual([...result.people].sort(), ["dad", "kid"]);
  assert.deepEqual([...result.marriages], []);
});

test("cycles in the parent links terminate", () => {
  const result = collectPersonImportGraph(
    "a",
    preview([
      person({ ref: "a", parent1_ref: "b" }),
      person({ ref: "b", parent1_ref: "a" }),
    ]),
  );

  assert.deepEqual([...result.people].sort(), ["a", "b"]);
});

test("an unknown starting ref selects nothing", () => {
  const result = collectPersonImportGraph("ghost", preview([person({ ref: "a" })]));

  assert.deepEqual([...result.people], []);
  assert.deepEqual([...result.marriages], []);
});
