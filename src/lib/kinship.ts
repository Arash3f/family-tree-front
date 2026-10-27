/**
 * The public kinship tool's vocabulary and its reference table.
 *
 * The names themselves come from the backend (`POST /kinship/label`), the same
 * labeller the relationship finder uses. The table below is what that labeller
 * returns for common chains; `tests/unit/services/test_kinship_chain.py` in the
 * backend asserts the very same rows, so the two cannot drift apart unnoticed.
 */

export const KINSHIP_STEPS = [
  "father",
  "mother",
  "brother",
  "sister",
  "son",
  "daughter",
  "husband",
  "wife",
] as const;

export type KinshipStep = (typeof KINSHIP_STEPS)[number];

/** Matches the backend's MAX_KINSHIP_STEPS. */
export const MAX_KINSHIP_STEPS = 8;

export type KinshipLabel = {
  label_fa: string | null;
  label_en: string | null;
};

type Row = { steps: KinshipStep[]; fa: string; en: string };

const ZWNJ = "‌";

/** Common relations and the names the app gives them. */
export const KINSHIP_TABLE: readonly Row[] = [
  { steps: ["father", "father"], fa: "پدربزرگ", en: "grandfather" },
  { steps: ["father", "mother"], fa: "مادربزرگ", en: "grandmother" },
  { steps: ["father", "brother"], fa: "عمو", en: "paternal uncle" },
  { steps: ["father", "sister"], fa: "عمه", en: "paternal aunt" },
  { steps: ["mother", "brother"], fa: "دایی", en: "maternal uncle" },
  { steps: ["mother", "sister"], fa: "خاله", en: "maternal aunt" },
  { steps: ["father", "brother", "son"], fa: "پسرعمو", en: "paternal uncle's son" },
  { steps: ["father", "brother", "daughter"], fa: "دخترعمو", en: "paternal uncle's daughter" },
  { steps: ["father", "sister", "son"], fa: "پسرعمه", en: "paternal aunt's son" },
  { steps: ["father", "sister", "daughter"], fa: "دخترعمه", en: "paternal aunt's daughter" },
  { steps: ["mother", "brother", "son"], fa: "پسردایی", en: "maternal uncle's son" },
  { steps: ["mother", "brother", "daughter"], fa: "دختردایی", en: "maternal uncle's daughter" },
  { steps: ["mother", "sister", "son"], fa: "پسرخاله", en: "maternal aunt's son" },
  { steps: ["mother", "sister", "daughter"], fa: "دخترخاله", en: "maternal aunt's daughter" },
  { steps: ["brother", "son"], fa: "برادرزاده", en: "nephew" },
  { steps: ["sister", "daughter"], fa: "خواهرزاده", en: "niece" },
  { steps: ["son", "son"], fa: "نوه", en: "grandson" },
  { steps: ["daughter", "daughter"], fa: "نوه", en: "granddaughter" },
  { steps: ["son", "wife"], fa: "عروس", en: "daughter-in-law" },
  { steps: ["daughter", "husband"], fa: "داماد", en: "son-in-law" },
  { steps: ["brother", "wife"], fa: `زن${ZWNJ}برادر`, en: "sister-in-law" },
  { steps: ["sister", "husband"], fa: "شوهرخواهر", en: "brother-in-law" },
  { steps: ["father", "brother", "wife"], fa: `زن${ZWNJ}عمو`, en: "paternal uncle's wife" },
  { steps: ["father", "sister", "husband"], fa: "شوهرعمه", en: "paternal aunt's husband" },
  { steps: ["mother", "brother", "wife"], fa: `زن${ZWNJ}دایی`, en: "maternal uncle's wife" },
  { steps: ["mother", "sister", "husband"], fa: "شوهرخاله", en: "maternal aunt's husband" },
  { steps: ["wife", "father"], fa: "پدرزن", en: "father-in-law" },
  { steps: ["wife", "mother"], fa: "مادرزن", en: "mother-in-law" },
  { steps: ["wife", "brother"], fa: "برادرزن", en: "brother-in-law" },
  { steps: ["wife", "sister"], fa: "خواهرزن", en: "sister-in-law" },
  { steps: ["husband", "father"], fa: "پدرشوهر", en: "father-in-law" },
  { steps: ["husband", "mother"], fa: "مادرشوهر", en: "mother-in-law" },
  { steps: ["husband", "brother"], fa: "برادرشوهر", en: "brother-in-law" },
  { steps: ["husband", "sister"], fa: `خواهر${ZWNJ}شوهر`, en: "sister-in-law" },
  { steps: ["wife", "sister", "husband"], fa: "باجناق", en: "wife's sister's husband" },
  { steps: ["husband", "brother", "wife"], fa: "جاری", en: "husband's brother's wife" },
  { steps: ["father", "father", "brother"], fa: "برادرِ پدربزرگ", en: "grandfather's brother" },
];

/**
 * Spells a chain out as the reader would say it.
 *
 * @param steps - the chain from the speaker outwards
 * @param words - each step's word in the reader's language
 * @param locale - "fa" puts the steps in Persian possessive order
 * ("پسرِ برادرِ پدرِ من"); anything else reads like English ("my father's
 * brother's son")
 * @param me - the word for "me" / "my"
 */
export function describeChain(
  steps: readonly KinshipStep[],
  words: Record<KinshipStep, string>,
  locale: string,
  me: string,
): string {
  if (locale === "fa") {
    return [...steps.map((step) => `${words[step]}ِ`).reverse(), me].join(" ");
  }
  return `${me} ${steps.map((step) => words[step]).join("'s ")}`;
}
