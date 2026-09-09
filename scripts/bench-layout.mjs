/**
 * Measures pedigree layout cost against tree size.
 *
 * Layout runs on the main thread whenever the graph is rebuilt, so its shape
 * matters more than its absolute speed: a quadratic curve means large trees
 * freeze the tab. Reported timings are medians over several runs, after a warm-up,
 * because the first pass pays JIT and allocation costs that steady state does not.
 *
 * Run with: node --experimental-strip-types --import ./scripts/test-alias-hook.mjs scripts/bench-layout.mjs
 */

import { performance } from "node:perf_hooks";

const { buildPedigreeGraph, subsetForPath } = await import(
  "../src/lib/pedigree/layout.ts"
);
const { buildTreeIndex, neighborhoodOf } = await import(
  "../src/lib/pedigree/index-tree.ts"
);

/**
 * Build a realistic tree: couples per generation, each with a few children who
 * then pair up. Branching stays modest so the result looks like a family rather
 * than a balanced binary tree.
 */
function makeTree(generations, childrenPerCouple) {
  const persons = [];
  const marriages = [];
  let next = 0;
  const id = () => `p${next++}`;

  const add = (gen, parents, marriageId) => {
    const person = {
      id: id(),
      name: `Person ${next}`,
      gender: next % 2 === 0 ? "male" : "female",
      birth_date: `${1900 + gen * 25}-06-15`,
      death_date: null,
      family_name: "Family",
      birth_place: "Tehran",
      death_place: null,
      notes: null,
      parents: parents.map((parent_id) => ({
        parent_id,
        relationship_type: "biological",
      })),
      marriage_id: marriageId,
      photo_object_key: null,
      photo_url: null,
    };
    persons.push(person);
    return person;
  };

  const marry = (a, b, gen) => {
    const marriage = {
      id: `m${marriages.length}`,
      spouse_a_id: a.id,
      spouse_b_id: b.id,
      married_at: `${1920 + gen * 25}-03-01`,
      divorced_at: null,
    };
    marriages.push(marriage);
    return marriage;
  };

  let couples = [];
  const root = marry(add(0, [], null), add(0, [], null), 0);
  couples.push(root);

  for (let gen = 1; gen < generations; gen += 1) {
    const nextCouples = [];
    for (const couple of couples) {
      for (let c = 0; c < childrenPerCouple; c += 1) {
        const child = add(gen, [couple.spouse_a_id, couple.spouse_b_id], couple.id);
        // Every other child marries in and continues the line.
        if (c % 2 === 0 && gen < generations - 1) {
          const spouse = add(gen, [], null);
          nextCouples.push(marry(child, spouse, gen));
        }
      }
    }
    couples = nextCouples;
  }

  return { persons, marriages };
}

/**
 * The scan this work replaced: for each marriage, walk every person to find its
 * children. Kept here so the improvement is measured rather than assumed.
 */
function childrenByScan(persons, marriages) {
  const out = new Map();
  for (const marriage of marriages) {
    const kids = persons
      .filter((person) => {
        if (person.marriage_id === marriage.id) return true;
        const parentIds = new Set(person.parents.map((link) => link.parent_id));
        return (
          parentIds.has(marriage.spouse_a_id) &&
          parentIds.has(marriage.spouse_b_id)
        );
      })
      .sort((a, b) => {
        const aDate = a.birth_date ?? "";
        const bDate = b.birth_date ?? "";
        if (aDate !== bDate) return aDate.localeCompare(bDate);
        return a.name.localeCompare(b.name);
      });
    out.set(marriage.id, kids);
  }
  return out;
}

/** The old neighborhood computation, which scanned the tree twice per click. */
function neighborhoodByScan(personId, persons, marriages) {
  const focus = new Set([personId]);
  const person = persons.find((item) => item.id === personId);
  if (!person) return focus;
  for (const link of person.parents) focus.add(link.parent_id);
  for (const marriage of marriages) {
    if (
      marriage.spouse_a_id !== personId &&
      marriage.spouse_b_id !== personId
    ) {
      continue;
    }
    focus.add(marriage.spouse_a_id);
    focus.add(marriage.spouse_b_id);
    for (const child of persons) {
      if (child.marriage_id === marriage.id) focus.add(child.id);
    }
  }
  for (const other of persons) {
    if (other.parents.some((link) => link.parent_id === personId)) {
      focus.add(other.id);
    }
  }
  return focus;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function time(label, runs, fn) {
  fn();
  fn();
  const samples = [];
  for (let i = 0; i < runs; i += 1) {
    const started = performance.now();
    fn();
    samples.push(performance.now() - started);
  }
  return { label, ms: median(samples) };
}

// Sized so the largest is well past any real family tree, which is where a
// quadratic term would show up if one were still hiding.
const shapes = [
  { generations: 5, children: 4 },
  { generations: 6, children: 4 },
  { generations: 7, children: 4 },
  { generations: 8, children: 4 },
  { generations: 9, children: 4 },
];

const rows = [];

for (const shape of shapes) {
  const { persons, marriages } = makeTree(shape.generations, shape.children);
  const runs = persons.length > 1500 ? 3 : 8;

  const treeIndex = buildTreeIndex(persons, marriages);
  const index = time("index", runs, () => buildTreeIndex(persons, marriages));
  const scan = time("scan", runs, () => childrenByScan(persons, marriages));

  const layout = time("layout", runs, () =>
    buildPedigreeGraph({ persons, marriages, index: treeIndex }),
  );

  // Selecting a person recomputes the highlighted ring, on every click.
  const target = persons[Math.floor(persons.length / 2)].id;
  const hood = time("neighborhood", 200, () =>
    neighborhoodOf(treeIndex, target),
  );
  const hoodScan = time("neighborhoodScan", 200, () =>
    neighborhoodByScan(target, persons, marriages),
  );

  const graph = buildPedigreeGraph({ persons, marriages, index: treeIndex });
  const pathIds = new Set(persons.slice(0, 12).map((p) => p.id));
  const path = time("subsetForPath", runs, () =>
    subsetForPath(persons, marriages, pathIds, treeIndex),
  );

  rows.push({
    people: persons.length,
    marriages: marriages.length,
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    index: index.ms,
    scan: scan.ms,
    layout: layout.ms,
    neighborhood: hood.ms,
    neighborhoodScan: hoodScan.ms,
    path: path.ms,
  });
}

const fmt = (n, digits = 2, width = 9) =>
  n.toFixed(digits).padStart(width);

console.log("\nAdjacency lookups: one index pass vs. the per-marriage scan\n");
console.log("people  marr |     index      scan   speedup |  neighborhood      scan   speedup");
for (const row of rows) {
  console.log(
    `${String(row.people).padStart(6)}  ${String(row.marriages).padStart(4)} |` +
      `${fmt(row.index)} ${fmt(row.scan)} ${fmt(row.scan / row.index, 1, 8)}x |` +
      `${fmt(row.neighborhood, 4, 13)} ${fmt(row.neighborhoodScan, 4)} ` +
      `${fmt(row.neighborhoodScan / row.neighborhood, 1, 8)}x`,
  );
}

console.log("\nFull layout (median ms)\n");
console.log("people   nodes   edges |    layout  pathSubset | us/person");
for (const row of rows) {
  console.log(
    `${String(row.people).padStart(6)}  ${String(row.nodes).padStart(6)}  ` +
      `${String(row.edges).padStart(6)} |${fmt(row.layout)} ${fmt(row.path)} |` +
      `${fmt((row.layout * 1000) / row.people, 1)}`,
  );
}

// A linear algorithm holds roughly constant time-per-person as the tree grows;
// a quadratic one shows it climbing with each row.
const perPerson = rows.map((row) => (row.layout * 1000) / row.people);
const growth = perPerson[perPerson.length - 1] / perPerson[0];
console.log(
  `\nTime per person changed by ${growth.toFixed(2)}x from ${rows[0].people} ` +
    `people to ${rows[rows.length - 1].people}.`,
);
if (growth > 4) {
  console.log("That still looks super-linear — worth another look.");
  process.exitCode = 1;
} else {
  console.log("Scaling looks linear or better.");
}
