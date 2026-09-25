import assert from "node:assert/strict";
import test from "node:test";

import {
  CHROME_LABELED_MIN,
  CHROME_PHONE_MAX,
  chromePlanAfterOverflow,
  chromePlanFromWidth,
} from "./chrome-density.ts";

test("phone stacks title above search + menu", () => {
  assert.deepEqual(chromePlanFromWidth(CHROME_PHONE_MAX), {
    layout: "stack",
    tools: "menu",
  });
});

test("typical sidebar chrome stays on icon tools", () => {
  assert.deepEqual(chromePlanFromWidth(720), {
    layout: "centered",
    tools: "icons",
  });
  assert.deepEqual(chromePlanFromWidth(1468), {
    layout: "centered",
    tools: "icons",
  });
  assert.deepEqual(chromePlanFromWidth(CHROME_LABELED_MIN - 1), {
    layout: "centered",
    tools: "icons",
  });
});

test("labeled strip only on very wide chrome", () => {
  assert.deepEqual(chromePlanFromWidth(CHROME_LABELED_MIN), {
    layout: "centered",
    tools: "labeled",
  });
});

test("overflow folds the whole strip into the menu beside centered search", () => {
  assert.deepEqual(
    chromePlanAfterOverflow({ layout: "centered", tools: "labeled" }, true),
    { layout: "centered", tools: "menu" },
  );
  assert.deepEqual(
    chromePlanAfterOverflow({ layout: "centered", tools: "icons" }, true),
    { layout: "centered", tools: "menu" },
  );
  assert.deepEqual(
    chromePlanAfterOverflow({ layout: "centered", tools: "icons" }, false),
    { layout: "centered", tools: "icons" },
  );
  assert.deepEqual(
    chromePlanAfterOverflow({ layout: "stack", tools: "icons" }, true),
    { layout: "stack", tools: "menu" },
  );
});
