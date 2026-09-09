import assert from "node:assert/strict";
import test from "node:test";

import {
  TreeAccess,
  TREE_ACCESS_ALL,
  expandTreeAccess,
  getTreeAccessCompanions,
  getTreeAccessRequiring,
  groupTreeAccess,
  minimizeExplicitTreeAccess,
  normalizeTreeAccess,
  treeAccessSetsEqual,
} from "@/lib/auth/tree-access.ts";

test("catalog matches the backend tree-access keys", () => {
  assert.deepEqual(
    [...TREE_ACCESS_ALL],
    [
      "view",
      "person_create",
      "person_update",
      "person_delete",
      "marriage_create",
      "marriage_update",
      "marriage_delete",
      "marriage_divorce",
      "upload_photo",
      "member_add",
      "member_remove",
      "view_birth_date",
      "view_marriage_date",
      "view_photo",
      "ticket_manage",
    ],
  );
  // The removed capabilities must not linger anywhere in the catalog.
  assert.equal((TREE_ACCESS_ALL as readonly string[]).includes("edit"), false);
  assert.equal(
    (TREE_ACCESS_ALL as readonly string[]).includes("add_persons"),
    false,
  );
});

test("every capability pulls in view as a prerequisite", () => {
  for (const name of TREE_ACCESS_ALL) {
    if (name === TreeAccess.VIEW) continue;
    assert.equal(
      expandTreeAccess([name]).has(TreeAccess.VIEW),
      true,
      `${name} should require view`,
    );
  }
});

test("editing a person also exposes its protected views", () => {
  const expanded = expandTreeAccess([TreeAccess.PERSON_UPDATE]);
  assert.equal(expanded.has(TreeAccess.VIEW), true);
  assert.equal(expanded.has(TreeAccess.VIEW_BIRTH_DATE), true);
  assert.equal(expanded.has(TreeAccess.VIEW_PHOTO), true);
});

test("marriage edits and divorces expose the marriage date", () => {
  for (const name of [
    TreeAccess.MARRIAGE_UPDATE,
    TreeAccess.MARRIAGE_DIVORCE,
  ]) {
    assert.equal(
      expandTreeAccess([name]).has(TreeAccess.VIEW_MARRIAGE_DATE),
      true,
      `${name} should require view_marriage_date`,
    );
  }
});

test("uploading a photo requires seeing photos", () => {
  const expanded = expandTreeAccess([TreeAccess.UPLOAD_PHOTO]);
  assert.equal(expanded.has(TreeAccess.VIEW_PHOTO), true);
  assert.equal(expanded.has(TreeAccess.VIEW), true);
});

test("companions list the prerequisites minus the capability itself", () => {
  assert.deepEqual(getTreeAccessCompanions(TreeAccess.PERSON_UPDATE), [
    "view",
    "view_birth_date",
    "view_photo",
  ]);
});

test("normalize adds view when nothing known is selected", () => {
  assert.deepEqual(normalizeTreeAccess([]), ["view"]);
  assert.deepEqual(normalizeTreeAccess(["bogus"]), ["view"]);
});

test("normalize expands prerequisites and drops unknown names", () => {
  assert.deepEqual(normalizeTreeAccess([TreeAccess.MEMBER_ADD, "nope"]), [
    "member_add",
    "view",
  ]);
});

test("a prerequisite cannot be dropped while a dependant is selected", () => {
  const explicit = [TreeAccess.PERSON_UPDATE];
  assert.deepEqual(getTreeAccessRequiring(TreeAccess.VIEW_PHOTO, explicit), [
    "person_update",
  ]);
});

test("minimize keeps only the roots that imply the rest", () => {
  const explicit = minimizeExplicitTreeAccess([
    TreeAccess.VIEW,
    TreeAccess.VIEW_PHOTO,
    TreeAccess.PERSON_UPDATE,
  ]);
  assert.deepEqual([...explicit], ["person_update"]);
});

test("groupTreeAccess buckets granted names in a stable order", () => {
  const groups = groupTreeAccess([
    TreeAccess.VIEW,
    TreeAccess.PERSON_CREATE,
    TreeAccess.MARRIAGE_DIVORCE,
    TreeAccess.UPLOAD_PHOTO,
    TreeAccess.MEMBER_ADD,
    TreeAccess.TICKET_MANAGE,
    TreeAccess.VIEW_PHOTO,
  ]);
  assert.deepEqual(
    groups.map((group) => group.id),
    ["person", "marriage", "photo", "members", "tickets", "views"],
  );
  assert.deepEqual(groups[0].items, ["person_create"]);
  assert.deepEqual(groups[4].items, ["ticket_manage"]);
  assert.deepEqual(groups[5].items, ["view", "view_photo"]);
});

test("groupTreeAccess omits groups with nothing granted", () => {
  const groups = groupTreeAccess([TreeAccess.VIEW]);
  assert.deepEqual(
    groups.map((group) => group.id),
    ["views"],
  );
});

test("treeAccessSetsEqual ignores ordering", () => {
  assert.equal(
    treeAccessSetsEqual(["view", "view_photo"], ["view_photo", "view"]),
    true,
  );
  assert.equal(treeAccessSetsEqual(["view"], ["view", "view_photo"]), false);
});
