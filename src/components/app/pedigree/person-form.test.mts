import assert from "node:assert/strict";
import test from "node:test";

import {
  buildParents,
  emptyPersonForm,
  personToForm,
} from "@/components/app/pedigree/person-form.ts";
import type { Person } from "@/lib/auth/types";

function person(overrides: Partial<Person> = {}): Person {
  return {
    id: "p1",
    name: "Ali",
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
    parents: [],
    ...overrides,
  };
}

test("a person with no optional fields becomes an all-empty form", () => {
  const form = personToForm(person());

  assert.deepEqual(form, {
    ...emptyPersonForm(),
    name: "Ali",
    gender: "male",
  });
});

test("the first two parent links fill the two parent slots", () => {
  const form = personToForm(
    person({
      parents: [
        { parent_id: "dad", relationship_type: "biological" },
        { parent_id: "mom", relationship_type: "adoptive" },
      ],
    }),
  );

  assert.equal(form.parent1_id, "dad");
  assert.equal(form.parent1_type, "biological");
  assert.equal(form.parent2_id, "mom");
  assert.equal(form.parent2_type, "adoptive");
});

test("photo fields start clean so an edit never re-uploads by accident", () => {
  const form = personToForm(
    person({ photo_url: "https://example.test/a.png", photo_object_key: "a.png" }),
  );

  assert.equal(form.photoFile, null);
  assert.equal(form.photoRemoved, false);
});

test("empty parent slots produce no links", () => {
  assert.deepEqual(buildParents(emptyPersonForm()), []);
});

test("both parent slots become links with their own relationship types", () => {
  const links = buildParents({
    ...emptyPersonForm(),
    parent1_id: "dad",
    parent1_type: "biological",
    parent2_id: "mom",
    parent2_type: "step",
  });

  assert.deepEqual(links, [
    { parent_id: "dad", relationship_type: "biological" },
    { parent_id: "mom", relationship_type: "step" },
  ]);
});

test("the same person picked twice is linked once", () => {
  const links = buildParents({
    ...emptyPersonForm(),
    parent1_id: "dad",
    parent2_id: "dad",
    parent2_type: "adoptive",
  });

  assert.deepEqual(links, [
    { parent_id: "dad", relationship_type: "biological" },
  ]);
});

test("a second parent alone still becomes a link", () => {
  const links = buildParents({
    ...emptyPersonForm(),
    parent2_id: "mom",
    parent2_type: "biological",
  });

  assert.deepEqual(links, [
    { parent_id: "mom", relationship_type: "biological" },
  ]);
});

test("origin marriage prefers the active couple between two parents", async () => {
  const { findOriginMarriageId } = await import(
    "@/components/app/pedigree/person-form.ts"
  );
  const marriages = [
    {
      id: "old",
      spouse_a_id: "dad",
      spouse_b_id: "mom",
      married_at: "1990-01-01",
      divorced_at: "2000-01-01",
    },
    {
      id: "active",
      spouse_a_id: "mom",
      spouse_b_id: "dad",
      married_at: "2001-01-01",
      divorced_at: null,
    },
  ];

  assert.equal(findOriginMarriageId("dad", "mom", marriages), "active");
  assert.equal(findOriginMarriageId("dad", "other", marriages), null);
});
