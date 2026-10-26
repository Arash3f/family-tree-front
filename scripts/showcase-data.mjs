/**
 * An invented family for README screenshots — every name, date and place is
 * fictional. Four generations, three branches, one cousin relation to show the
 * pathfinding view. The same tree in Persian and English so each locale's
 * screenshot reads naturally.
 */

const NAMES = {
  fa: {
    // Per person, in PEOPLE order: children carry their father's family name.
    families: [
      "رحیمی", "صادقی", "رحیمی", "نوری", "رحیمی", "کاظمی", "رحیمی", "احمدی",
      "رحیمی", "موسوی", "رحیمی", "کاظمی", "رحیمی", "کریمی", "رحیمی", "رحیمی",
    ],
    place: "شیراز",
    tree: "خاندان رحیمی",
    me: "آرمان رحیمی",
    people: [
      "حسن", "مهین", "محمود", "پروین", "فرشته", "رضا", "جواد", "لیلا",
      "آرمان", "شیرین", "نازنین", "سینا", "کیان", "الهام", "ارسلان", "ترانه",
    ],
    relation: {
      label: "پسرعمو",
      description: "آرمان ← پدر: محمود ← پدر: حسن ← پسر: جواد ← پسر: کیان",
    },
  },
  en: {
    families: [
      "Carter", "Hughes", "Carter", "Wood", "Carter", "Bell", "Carter", "Price",
      "Carter", "Lane", "Carter", "Bell", "Carter", "Hall", "Carter", "Carter",
    ],
    place: "Bristol",
    tree: "The Carter Family",
    me: "Adam Carter",
    people: [
      "Henry", "Margaret", "Michael", "Patricia", "Fiona", "Robert", "James", "Laura",
      "Adam", "Sophie", "Natalie", "Simon", "Kevin", "Emma", "Oliver", "Grace",
    ],
    relation: {
      label: "First cousin",
      description: "Adam → father: Michael → father: Henry → son: James → son: Kevin",
    },
  },
};

const GENDERS = [
  "male", "female", "male", "female", "female", "male", "male", "female",
  "male", "female", "female", "male", "male", "female", "male", "female",
];

/** [person, parents, birth, death] — indexes into the name list, 1-based. */
const PEOPLE = [
  [1, [], "1931-04-02", "2009-11-20"],
  [2, [], "1936-09-15", "2018-02-03"],
  [3, [1, 2], "1957-01-22", null],
  [4, [], "1960-06-10", null],
  [5, [1, 2], "1961-12-05", null],
  [6, [], "1958-03-30", null],
  [7, [1, 2], "1965-08-18", null],
  [8, [], "1968-05-27", null],
  [9, [3, 4], "1986-02-14", null],
  [10, [], "1988-10-09", null],
  [11, [3, 4], "1990-07-01", null],
  [12, [5, 6], "1989-04-23", null],
  [13, [7, 8], "1991-11-11", null],
  [14, [], "1993-01-17", null],
  [15, [9, 10], "2015-06-05", null],
  [16, [13, 14], "2019-09-28", null],
];

/** [id, spouse a, spouse b, married] */
const MARRIAGES = [
  [1, 1, 2, "1955-05-12"],
  [2, 3, 4, "1984-08-20"],
  [3, 6, 5, "1987-03-14"],
  [4, 7, 8, "1989-10-02"],
  [5, 9, 10, "2013-04-19"],
  [6, 13, 14, "2017-06-24"],
];

const pid = (n) => `p-${String(n).padStart(3, "0")}`;
const mid = (n) => `m-${String(n).padStart(3, "0")}`;

/**
 * The showcase dataset for one locale, in the shape `installMockApi`'s
 * `dataset` option expects.
 */
export function showcaseDataset(locale) {
  const names = NAMES[locale] ?? NAMES.en;
  // A person's `marriage_id` is the marriage they were born into (their
  // parents'), not their own.
  const bornInto = (parents) =>
    MARRIAGES.find(([, a, b]) => parents.includes(a) && parents.includes(b))?.[0];
  const persons = PEOPLE.map(([n, parents, birth, death]) => ({
    id: pid(n),
    name: names.people[n - 1],
    gender: GENDERS[n - 1],
    birth_date: birth,
    death_date: death,
    family_name: names.families[n - 1],
    birth_place: names.place,
    death_place: death ? names.place : null,
    notes: null,
    parents: parents.map((p) => ({ parent_id: pid(p), relationship_type: "biological" })),
    marriage_id: parents.length ? mid(bornInto(parents)) : null,
    photo_object_key: null,
    photo_url: null,
  }));

  const marriages = MARRIAGES.map(([id, a, b, married]) => ({
    id: mid(id),
    spouse_a_id: pid(a),
    spouse_b_id: pid(b),
    married_at: married,
    divorced_at: null,
  }));

  const path = [9, 3, 1, 7, 13].map(pid);
  return {
    meFullname: names.me,
    treeName: names.tree,
    persons,
    marriages,
    relation: {
      fromId: pid(9),
      toId: pid(13),
      result: {
        from_person_id: pid(9),
        to_person_id: pid(13),
        found: true,
        distance: 4,
        path_person_ids: path,
        relationship_types: ["CHILD_OF", "CHILD_OF", "PARENT_OF", "PARENT_OF"],
        label_fa: NAMES.fa.relation.label,
        label_en: NAMES.en.relation.label,
        description_fa: NAMES.fa.relation.description,
        description_en: NAMES.en.relation.description,
        paths: [
          {
            distance: 4,
            path_person_ids: path,
            relationship_types: ["CHILD_OF", "CHILD_OF", "PARENT_OF", "PARENT_OF"],
            label_fa: NAMES.fa.relation.label,
            label_en: NAMES.en.relation.label,
            description_fa: NAMES.fa.relation.description,
            description_en: NAMES.en.relation.description,
          },
        ],
      },
    },
  };
}
