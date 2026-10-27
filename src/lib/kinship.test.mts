import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describeChain, KINSHIP_TABLE, type KinshipStep } from "@/lib/kinship.ts";

const EN: Record<KinshipStep, string> = {
  father: "father",
  mother: "mother",
  brother: "brother",
  sister: "sister",
  son: "son",
  daughter: "daughter",
  husband: "husband",
  wife: "wife",
};
const FA: Record<KinshipStep, string> = {
  father: "پدر",
  mother: "مادر",
  brother: "برادر",
  sister: "خواهر",
  son: "پسر",
  daughter: "دختر",
  husband: "شوهر",
  wife: "زن",
};

describe("kinship", () => {
  it("reads a chain forwards in English", () => {
    assert.equal(
      describeChain(["father", "brother", "son"], EN, "en", "my"),
      "my father's brother's son",
    );
  });

  it("reads a chain in Persian possessive order, ending with «من»", () => {
    assert.equal(
      describeChain(["father", "brother", "son"], FA, "fa", "من"),
      "پسرِ برادرِ پدرِ من",
    );
  });

  it("lists every reference relation once", () => {
    const keys = KINSHIP_TABLE.map((row) => row.steps.join(">"));
    assert.equal(new Set(keys).size, keys.length);
  });
});
