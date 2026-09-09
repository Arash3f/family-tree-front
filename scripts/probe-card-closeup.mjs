/**
 * Ad-hoc probe: render a few person cards large enough to inspect by eye,
 * across themes and states, and write them to .export-e2e/.
 *
 * Run with: node scripts/probe-card-closeup.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import * as esbuild from "esbuild";
import { chromium } from "playwright";

const projectRoot = path.resolve(import.meta.dirname, "..");
const outputDir = path.join(projectRoot, ".export-e2e");

async function bundle() {
  const result = await esbuild.build({
    stdin: {
      contents: `
        import { buildPedigreeGraphic } from "@/lib/pedigree/export-graphic";
        import { renderPedigreePng } from "@/lib/pedigree/export-raster";
        import { EXPORT_PRESETS } from "@/lib/pedigree/export-theme";
        globalThis.P = { buildPedigreeGraphic, renderPedigreePng, EXPORT_PRESETS };
      `,
      resolveDir: projectRoot,
      loader: "ts",
    },
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2022",
    write: false,
    alias: { "@": path.join(projectRoot, "src") },
    external: ["@xyflow/react", "react", "react-dom"],
    define: { "process.env.NEXT_PUBLIC_API_BASE_URL": '"http://localhost:8001"' },
  });
  return result.outputFiles[0].text;
}

function person(id, overrides = {}) {
  return {
    id,
    name: "آرش آلفونه",
    family_name: "",
    gender: "male",
    birth_date: "1990-04-12",
    death_date: null,
    birth_place: "تهران، ایران",
    death_place: null,
    notes: null,
    photo_url: null,
    photo_object_key: null,
    parents: [],
    ...overrides,
  };
}

/** One row of cards showing the states a reader needs to tell apart. */
function fixture() {
  const W = 220;
  const GAP = 40;
  const states = [
    { label: "male", data: {} },
    { label: "female", person: { gender: "female", name: "زهرا محمدی" } },
    { label: "deceased", person: { death_date: "2018-02-03" } },
    { label: "onPath", data: { onPath: true } },
    { label: "longName", person: { name: "محمدحسین عبدالله‌زاده طباطبایی" } },
    { label: "empty", person: { birth_date: null, birth_place: null } },
  ];
  const nodes = states.map((state, i) => ({
    id: `p-${i}`,
    type: "person",
    position: { x: i * (W + GAP), y: 0 },
    width: 220,
    height: 176,
    data: {
      person: person(`p-${i}`, state.person ?? {}),
      selected: false,
      highlighted: false,
      onPath: false,
      dimmed: false,
      inCouple: false,
      ...(state.data ?? {}),
    },
  }));

  // A couple frame with its two members and the union dot.
  const coupleX = states.length * (W + GAP);
  nodes.push({
    id: "couple-1",
    type: "couple",
    position: { x: coupleX, y: 0 },
    width: 486,
    height: 218,
    data: { leftId: "p-a", rightId: "p-b", marriedAt: "2010-06-01", divorced: false },
  });
  nodes.push({
    id: "union-1",
    type: "union",
    position: { x: coupleX + 237, y: 250 },
    width: 12,
    height: 12,
    data: { leftId: "p-a", rightId: "p-b", marriedAt: "2010-06-01" },
  });

  return { nodes, edges: [] };
}

const LABELS = {
  born: "تولد",
  died: "وفات",
  age: "سن",
  gender: "جنسیت",
  birthPlace: "زادگاه",
  notYetMarried: "هنوز ازدواج نکرده",
  empty: "—",
  male: "مرد",
  female: "زن",
};

async function main() {
  const code = await bundle();
  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(
    `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><style>
      :root{--font-vazirmatn:"Vazirmatn","Tahoma",sans-serif;--font-fraunces:Georgia,serif;--font-source-sans:sans-serif}
    </style></head><body></body></html>`,
  );
  await page.addScriptTag({ content: code });

  for (const preset of ["classic", "parchment", "night"]) {
    const dataUrl = await page.evaluate(
      async ({ nodes, edges, labels, preset }) => {
        const api = globalThis.P;
        const theme = api.EXPORT_PRESETS[preset];
        const graphic = await api.buildPedigreeGraphic({
          nodes,
          edges,
          pathIds: new Set(),
          theme,
          locale: "fa",
          labels,
          asOfYear: null,
          includePhotos: false,
        });
        const png = await api.renderPedigreePng({
          graphic,
          background: theme.background,
          locale: "fa",
          targetScale: 3,
        });
        return png.dataUrl;
      },
      { ...fixture(), labels: LABELS, preset },
    );
    await writeFile(
      path.join(outputDir, `cards-${preset}.png`),
      Buffer.from(dataUrl.split(",")[1], "base64"),
    );
    console.log(`wrote cards-${preset}.png`);
  }

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
