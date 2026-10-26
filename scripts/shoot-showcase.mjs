/**
 * Captures the product screenshots used by the landing page and the READMEs,
 * from the invented family in `showcase-data.mjs` — never from real data.
 * Writes WebP files to `public/showcase/`, the one copy both consumers use.
 *
 * Usage: build and start the app, then
 *   node scripts/shoot-showcase.mjs [baseUrl]
 */
import { readFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { chromium } from "playwright";
import { installMockApi, MOCK_IDS } from "./mock-api.mjs";
import { showcaseDataset } from "./showcase-data.mjs";

const BASE = process.argv[2] ?? "http://localhost:5173";
const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "public", "showcase");
// sharp ships with Next.js; resolve it from there instead of adding a dependency.
const sharp = createRequire(createRequire(import.meta.url).resolve("next/package.json"))("sharp");

// Desktop shots are captured at exactly the width the landing shows them (its
// 72rem column inside the frame border), once per pixel density: a browser
// shrinking a larger capture blurs the small UI text, so each screen gets a
// file it shows pixel for pixel.
const DESKTOP = { width: 1150, height: 719 };
const DESKTOP_SCALES = [1, 2];
const MOBILE = { width: 390, height: 844 };

async function messages(locale) {
  const raw = await readFile(path.join(ROOT, "messages", `${locale}.json`), "utf8");
  return JSON.parse(raw).pedigree;
}

async function openTree(browser, { locale, theme, viewport, scale }) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: scale,
    reducedMotion: "reduce",
    storageState: {
      cookies: [],
      origins: [
        {
          origin: BASE,
          localStorage: [
            { name: "theme", value: theme },
            { name: "ft.access_token", value: "mock-access" },
            { name: "ft.refresh_token", value: "mock-refresh" },
            { name: "ft.token_type", value: "bearer" },
          ],
        },
      ],
    },
  });
  const page = await context.newPage();
  const dataset = showcaseDataset(locale);
  const unmatched = await installMockApi(page, { dataset });
  await page.goto(`${BASE}/${locale}/dashboard/trees/${MOCK_IDS.TREE_ID}`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(1200);
  return { context, page, dataset, unmatched };
}

async function save(page, name) {
  const png = await page.screenshot();
  const file = path.join(OUT, `${name}.webp`);
  // Lossless: UI text shows every compression artefact.
  await sharp(png).webp({ lossless: true, effort: 6 }).toFile(file);
  console.log(path.relative(ROOT, file));
}

/**
 * Selects the cousin pair, runs the closest-path search and narrows the canvas
 * to that path. The minimap is hidden for this shot only: framed on the path,
 * it lands on the destination's card.
 */
async function showRelation(page, t, dataset) {
  const from = dataset.persons.find((p) => p.id === dataset.relation.fromId);
  const to = dataset.persons.find((p) => p.id === dataset.relation.toId);
  await page.locator(`.react-flow__node[data-id="${from.id}"]`).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: t.findRelation }).click();
  await page.getByPlaceholder(t.relateSearchPlaceholder).fill(to.name);
  await page.getByRole("option", { name: new RegExp(to.name) }).first().click();
  await page.getByRole("button", { name: t.runRelation, exact: true }).click();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: t.pathViewActive, exact: true }).click();
  await page.addStyleTag({ content: ".react-flow__minimap { display: none; }" });
  await page.waitForTimeout(1200);
}

/**
 * The path is framed on the whole canvas, so the relation panel covers its
 * edge; drag the canvas away from the panel (which follows reading direction).
 */
async function clearPanel(page, locale) {
  const pane = await page.locator(".react-flow__pane").boundingBox();
  const x = pane.x + pane.width / 2;
  const y = pane.y + pane.height - 12;
  const shift = locale === "fa" ? 160 : -160;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + shift, y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(400);
}

/** The tree and relation shots of one locale, theme and pixel density. */
async function shootDesktop(browser, t, { locale, theme, scale }) {
  const { context, page, dataset, unmatched } = await openTree(browser, {
    locale,
    theme,
    viewport: DESKTOP,
    scale,
  });
  await page.getByRole("button", { name: t.fullscreen, exact: true }).click();
  await page.getByRole("button", { name: t.layoutDensityCompact, exact: true }).click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: t.fitView, exact: true }).click();
  await page.waitForTimeout(900);
  await save(page, `tree-${locale}-${theme}-${scale}x`);

  await showRelation(page, t, dataset);
  await clearPanel(page, locale);
  await save(page, `relation-${locale}-${theme}-${scale}x`);
  if (unmatched.length) console.warn("unmocked:", unmatched);
  await context.close();
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();

  for (const locale of ["fa", "en"]) {
    const t = await messages(locale);
    for (const theme of ["light", "dark"]) {
      for (const scale of DESKTOP_SCALES) {
        await shootDesktop(browser, t, { locale, theme, scale });
      }
    }

    // A phone only renders the cards in view, so the cousin pair is out of
    // reach there: show the founder's detail sheet instead.
    const { context, page, dataset } = await openTree(browser, {
      locale,
      theme: "light",
      viewport: MOBILE,
      scale: 2,
    });
    await page.locator(`.react-flow__node[data-id="${dataset.persons[0].id}"]`).click();
    await page.waitForTimeout(1200);
    await save(page, `profile-${locale}-mobile`);
    await context.close();
  }

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
