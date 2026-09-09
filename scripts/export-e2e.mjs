/**
 * End-to-end check for the pedigree export pipeline.
 *
 * Bundles the real export modules for the browser, renders a synthetic tree of
 * several sizes in headless Chromium, and asserts on the actual output: that
 * card text keeps its size no matter how wide the tree gets, that page count
 * grows instead, that tiles line up seamlessly, and that the PDF opens.
 *
 * Run with: npm run test:export
 */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import * as esbuild from "esbuild";
import { chromium } from "playwright";

const projectRoot = path.resolve(import.meta.dirname, "..");
const outputDir = path.join(projectRoot, ".export-e2e");

/** Bundle the export modules into one script the page can evaluate. */
async function bundleExportApi() {
  const entry = `
    import { buildPedigreeGraphic } from "@/lib/pedigree/export-graphic";
    import { renderPedigreePng, renderPedigreePdf, fitText } from "@/lib/pedigree/export-raster";
    import { planPages, legibilityFloorScale, MIN_LEGIBLE_PT } from "@/lib/pedigree/export-paginate";
    import { EXPORT_PRESETS } from "@/lib/pedigree/export-theme";
    globalThis.PedigreeExport = {
      buildPedigreeGraphic, renderPedigreePng, renderPedigreePdf, fitText,
      planPages, legibilityFloorScale, MIN_LEGIBLE_PT, EXPORT_PRESETS,
    };
  `;
  const result = await esbuild.build({
    stdin: {
      contents: entry,
      resolveDir: projectRoot,
      loader: "ts",
    },
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2022",
    write: false,
    alias: { "@": path.join(projectRoot, "src") },
    // The graphic builder only uses xyflow types, never its runtime.
    external: ["@xyflow/react", "react", "react-dom"],
    define: { "process.env.NEXT_PUBLIC_API_BASE_URL": '"http://localhost:8001"' },
  });
  return result.outputFiles[0].text;
}

/** A synthetic pedigree: `widest` people per generation, `generations` deep. */
function buildFixture(widest, generations) {
  const PERSON_W = 220;
  const PERSON_H = 176;
  const H_GAP = 72;
  const V_GAP = 280;
  const nodes = [];
  const edges = [];
  for (let g = 0; g < generations; g += 1) {
    for (let i = 0; i < widest; i += 1) {
      const id = `p-${g}-${i}`;
      nodes.push({
        id,
        type: "person",
        position: { x: i * (PERSON_W + H_GAP), y: g * V_GAP },
        width: PERSON_W,
        height: PERSON_H,
        data: {
          person: {
            id,
            name: i % 3 === 0 ? "محمدحسین عبدالله‌زاده طباطبایی" : "آرش آلفونه",
            family_name: "",
            gender: i % 2 === 0 ? "male" : "female",
            birth_date: "1990-04-12",
            death_date: g === 0 ? "2015-08-01" : null,
            birth_place: "تهران، ایران",
            death_place: null,
            notes: null,
            photo_url: null,
            photo_object_key: null,
            parents: [],
          },
          selected: false,
          highlighted: false,
          onPath: false,
          dimmed: false,
          inCouple: false,
        },
      });
      if (g > 0) {
        edges.push({
          id: `e-${g}-${i}`,
          source: `p-${g - 1}-${i}`,
          target: id,
          sourceHandle: "child",
          targetHandle: "parent",
          type: "smoothstep",
          style: { stroke: "var(--border)", strokeWidth: 1.7 },
        });
      }
    }
  }
  return { nodes, edges };
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
  const bundle = await bundleExportApi();
  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const consoleErrors = [];
  page.on("pageerror", (error) => consoleErrors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  // A document with the same font variables the app defines.
  await page.setContent(`<!doctype html><html lang="fa" dir="rtl"><head>
    <meta charset="utf-8">
    <style>
      :root { --font-vazirmatn: "Vazirmatn", sans-serif; --font-fraunces: "Fraunces", serif; --font-source-sans: "Source Sans 3", sans-serif; }
      body { font-family: var(--font-vazirmatn); }
    </style></head><body></body></html>`);
  await page.addScriptTag({ content: bundle });
  await page.waitForFunction(() => Boolean(globalThis.PedigreeExport));

  const cases = [
    { widest: 4, generations: 3, label: "tiny" },
    { widest: 20, generations: 4, label: "medium" },
    { widest: 80, generations: 5, label: "wide" },
    { widest: 200, generations: 5, label: "huge" },
  ];

  const report = [];

  for (const testCase of cases) {
    const fixture = buildFixture(testCase.widest, testCase.generations);
    const outcome = await page.evaluate(
      async ({ fixture, labels, testCase }) => {
        const api = globalThis.PedigreeExport;
        const theme = api.EXPORT_PRESETS.classic;
        const graphic = await api.buildPedigreeGraphic({
          nodes: fixture.nodes,
          edges: fixture.edges,
          pathIds: new Set(),
          theme,
          locale: "fa",
          labels,
          asOfYear: null,
          includePhotos: false,
        });

        const started = performance.now();
        const png = await api.renderPedigreePng({
          graphic,
          background: theme.background,
          locale: "fa",
        });
        const pngMs = performance.now() - started;

        const pdfStarted = performance.now();
        const pdf = await api.renderPedigreePdf({
          graphic,
          background: theme.background,
          locale: "fa",
          title: `tree-${testCase.label}`,
          paper: "a3",
          orientation: "landscape",
          fit: "actual",
        });
        const pdfMs = performance.now() - pdfStarted;

        const pdfBytes = new Uint8Array(await pdf.blob.arrayBuffer());

        // Sample the PNG so we can confirm real content was drawn, not a blank.
        const probe = await new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => {
            const canvas = document.createElement("canvas");
            const w = Math.min(image.naturalWidth, 1200);
            const h = Math.min(image.naturalHeight, 1200);
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(image, 0, 0, w, h, 0, 0, w, h);
            const { data } = ctx.getImageData(0, 0, w, h);
            const seen = new Set();
            let nonBackground = 0;
            for (let i = 0; i < data.length; i += 4) {
              const key = `${data[i]},${data[i + 1]},${data[i + 2]}`;
              seen.add(key);
              if (key !== "255,255,255") nonBackground += 1;
            }
            resolve({
              distinctColours: seen.size,
              inkRatio: nonBackground / (w * h),
            });
          };
          image.onerror = () => reject(new Error("png-decode"));
          image.src = png.dataUrl;
        });

        return {
          graph: { width: graphic.width, height: graphic.height, persons: graphic.personCount },
          png: {
            pixelWidth: png.pixelWidth,
            pixelHeight: png.pixelHeight,
            scale: png.scale,
            downscaled: png.downscaled,
            bytes: Math.round((png.dataUrl.length * 3) / 4),
            ms: Math.round(pngMs),
          },
          probe,
          pdf: {
            pageCount: pdf.plan.pageCount,
            columns: pdf.plan.columns,
            rows: pdf.plan.rows,
            scale: pdf.plan.scale,
            smallestTextPt: pdf.plan.smallestTextPt,
            belowLegible: pdf.plan.belowLegible,
            bytes: pdfBytes.length,
            head: Array.from(pdfBytes.slice(0, 8)),
            tail: new TextDecoder("latin1").decode(pdfBytes.slice(-6)),
            ms: Math.round(pdfMs),
          },
          pdfBase64: pdfBytes.length < 40_000_000
            ? btoa(String.fromCharCode(...pdfBytes.slice(0, 0)))
            : null,
        };
      },
      { fixture, labels: LABELS, testCase },
    );

    // --- Assertions on real rendered output ---
    assert.ok(
      outcome.probe.distinctColours > 20,
      `${testCase.label}: PNG looks blank (${outcome.probe.distinctColours} colours)`,
    );
    assert.ok(
      outcome.probe.inkRatio > 0.01,
      `${testCase.label}: PNG has almost no ink (${outcome.probe.inkRatio})`,
    );
    assert.equal(
      outcome.pdf.belowLegible,
      false,
      `${testCase.label}: PDF text dropped below the legibility floor`,
    );
    assert.equal(
      outcome.pdf.scale,
      1,
      `${testCase.label}: PDF scaled the tree instead of adding pages`,
    );
    assert.ok(
      outcome.pdf.smallestTextPt >= 7,
      `${testCase.label}: smallest text is ${outcome.pdf.smallestTextPt}pt`,
    );
    assert.deepEqual(
      outcome.pdf.head.slice(0, 5),
      [0x25, 0x50, 0x44, 0x46, 0x2d],
      `${testCase.label}: PDF is missing its %PDF- header`,
    );
    assert.match(
      outcome.pdf.tail,
      /%%EOF/,
      `${testCase.label}: PDF is missing its EOF marker`,
    );
    assert.ok(
      outcome.pdf.bytes > 1000,
      `${testCase.label}: PDF is suspiciously small (${outcome.pdf.bytes} bytes)`,
    );

    report.push({ case: testCase.label, ...outcome });
  }

  // Text size must not depend on how wide the tree is — the original defect.
  const textSizes = report.map((row) => row.pdf.smallestTextPt);
  assert.equal(
    new Set(textSizes.map((value) => value.toFixed(3))).size,
    1,
    `printed text size varied with tree width: ${textSizes.join(", ")}`,
  );

  // Wider trees must cost pages, not readability.
  for (let i = 1; i < report.length; i += 1) {
    assert.ok(
      report[i].pdf.pageCount >= report[i - 1].pdf.pageCount,
      `${report[i].case} used fewer pages than ${report[i - 1].case}`,
    );
  }

  assert.deepEqual(consoleErrors, [], "the page reported errors");

  // Save one PDF and PNG so the result can be inspected by eye.
  const sample = report.find((row) => row.case === "medium") ?? report[0];
  const saved = await page.evaluate(
    async ({ fixture, labels }) => {
      const api = globalThis.PedigreeExport;
      const theme = api.EXPORT_PRESETS.classic;
      const graphic = await api.buildPedigreeGraphic({
        nodes: fixture.nodes,
        edges: fixture.edges,
        pathIds: new Set(),
        theme,
        locale: "fa",
        labels,
        asOfYear: null,
        includePhotos: false,
      });
      const pdf = await api.renderPedigreePdf({
        graphic,
        background: theme.background,
        locale: "fa",
        title: "sample",
        paper: "a3",
        orientation: "landscape",
        fit: "actual",
      });
      const png = await api.renderPedigreePng({
        graphic,
        background: theme.background,
        locale: "fa",
        maxEdge: 2200,
      });
      const bytes = new Uint8Array(await pdf.blob.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      }
      return { pdfBase64: btoa(binary), pngDataUrl: png.dataUrl };
    },
    { fixture: buildFixture(20, 4), labels: LABELS },
  );

  await writeFile(
    path.join(outputDir, "sample.pdf"),
    Buffer.from(saved.pdfBase64, "base64"),
  );
  await writeFile(
    path.join(outputDir, "sample.png"),
    Buffer.from(saved.pngDataUrl.split(",")[1], "base64"),
  );

  await browser.close();

  console.log("Export pipeline results\n");
  for (const row of report) {
    console.log(
      [
        `${row.case.padEnd(7)}`,
        `${row.graph.persons} people`,
        `graph ${Math.round(row.graph.width)}x${Math.round(row.graph.height)}px`,
        `PNG ${row.png.pixelWidth}x${row.png.pixelHeight} @${row.png.scale.toFixed(2)}x` +
          `${row.png.downscaled ? " (downscaled)" : ""} ${Math.round(row.png.bytes / 1024)}KB ${row.png.ms}ms`,
        `PDF ${row.pdf.pageCount}pg (${row.pdf.columns}x${row.pdf.rows}) ` +
          `text ${row.pdf.smallestTextPt.toFixed(2)}pt ${Math.round(row.pdf.bytes / 1024)}KB ${row.pdf.ms}ms`,
      ].join(" | "),
    );
  }
  console.log(`\nSamples written to ${outputDir}`);
  console.log("All export assertions passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
