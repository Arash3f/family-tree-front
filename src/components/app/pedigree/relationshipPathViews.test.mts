import assert from "node:assert/strict";
import test from "node:test";

import type { ClosestRelationship } from "@/lib/auth/types.ts";
import {
  pickLocalizedKinship,
  relationshipToPathViews,
} from "@/components/app/pedigree/relationshipPathViews.ts";

const baseResult = (
  overrides: Partial<ClosestRelationship> = {},
): ClosestRelationship => ({
  from_person_id: "a",
  to_person_id: "b",
  found: true,
  distance: 2,
  path_person_ids: ["a", "c", "b"],
  relationship_types: ["PARENT_OF", "PARENT_OF"],
  paths: [],
  ...overrides,
});

test("pickLocalizedKinship prefers fa then falls back to en", () => {
  assert.equal(pickLocalizedKinship("fa", "پسرِ عمو", "uncle's son"), "پسرِ عمو");
  assert.equal(pickLocalizedKinship("fa", null, "uncle's son"), "uncle's son");
  assert.equal(pickLocalizedKinship("fa", "  ", "uncle's son"), "uncle's son");
});

test("pickLocalizedKinship prefers en then falls back to fa", () => {
  assert.equal(
    pickLocalizedKinship("en", "پسرِ عمو", "uncle's son"),
    "uncle's son",
  );
  assert.equal(pickLocalizedKinship("en-US", "پسرِ عمو", null), "پسرِ عمو");
});

test("relationshipToPathViews maps path labels for the active locale", () => {
  const result = baseResult({
    paths: [
      {
        distance: 3,
        path_person_ids: ["a", "x", "b"],
        relationship_types: ["PARENT_OF", "PARENT_OF"],
        label_fa: "پسرِ خواهر",
        label_en: "sister's son",
        description_fa: "پسرِ دخترِ مادر",
        description_en: "son of daughter of mother",
      },
    ],
  });

  const [faPath] = relationshipToPathViews(result, "fa");
  assert.equal(faPath.kinship, "پسرِ خواهر");
  assert.equal(faPath.kinshipDetail, "پسرِ دخترِ مادر");

  const [enPath] = relationshipToPathViews(result, "en");
  assert.equal(enPath.kinship, "sister's son");
  assert.equal(enPath.kinshipDetail, "son of daughter of mother");
});

test("relationshipToPathViews uses top-level labels when paths are empty", () => {
  const result = baseResult({
    label_fa: "عمو",
    label_en: "paternal uncle",
    description_fa: "برادرِ پدر",
    description_en: "father's brother",
  });

  const [path] = relationshipToPathViews(result, "en");
  assert.deepEqual(path.ids, ["a", "c", "b"]);
  assert.equal(path.kinship, "paternal uncle");
  assert.equal(path.kinshipDetail, "father's brother");
});

test("relationshipToPathViews tolerates missing kinship fields", () => {
  const result = baseResult({
    paths: [
      {
        distance: 1,
        path_person_ids: ["a", "b"],
        relationship_types: ["PARENT_OF"],
      },
    ],
  });

  const [path] = relationshipToPathViews(result, "fa");
  assert.equal(path.kinship, null);
  assert.equal(path.kinshipDetail, null);
});
