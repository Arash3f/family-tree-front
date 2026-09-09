import assert from "node:assert/strict";
import test from "node:test";

import { allOrCancelled } from "@/lib/api.ts";

function later<T>(value: T, ms = 0): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

const failsLater = (error: unknown, ms = 0) =>
  new Promise<never>((_, reject) => setTimeout(() => reject(error), ms));

test("results come back in request order", async () => {
  const results = await allOrCancelled([
    later("tree", 5),
    later([1, 2], 1),
    later([], 3),
  ] as const);

  assert.deepEqual(results, ["tree", [1, 2], []]);
});

test("a cancelled group resolves with nothing instead of throwing", async () => {
  const controller = new AbortController();
  const group = allOrCancelled(
    [later("tree", 5), failsLater(new Error("cancelled request"), 1)] as const,
    controller.signal,
  );
  controller.abort();

  assert.equal(await group, null);
});

test("a real failure is thrown once every sibling has settled", async () => {
  let siblingSettled = false;
  const sibling = later("tree", 10).then((value) => {
    siblingSettled = true;
    return value;
  });

  await assert.rejects(
    () => allOrCancelled([sibling, failsLater(new Error("boom"), 1)] as const),
    /boom/,
  );
  assert.equal(siblingSettled, true);
});

test("a cancel mid-flight discards the answers that did arrive", async () => {
  const controller = new AbortController();
  const group = allOrCancelled(
    [later("tree", 1), later("people", 40)] as const,
    controller.signal,
  );
  await later(null, 10);
  controller.abort();

  assert.equal(await group, null);
});
