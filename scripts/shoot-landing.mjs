/**
 * Captures the landing page across locale, theme, and viewport so the visual
 * result can be reviewed without a browser session. Scratch tooling — the
 * output directory is gitignored.
 *
 * Usage: node scripts/shoot-landing.mjs [baseUrl]
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:5173";
const OUT = path.resolve(import.meta.dirname, "..", ".shots");

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

const SHOTS = [
  { locale: "en", theme: "light", viewport: "desktop" },
  { locale: "en", theme: "dark", viewport: "desktop" },
  { locale: "fa", theme: "light", viewport: "desktop" },
  { locale: "fa", theme: "dark", viewport: "desktop" },
  { locale: "en", theme: "light", viewport: "mobile" },
  { locale: "fa", theme: "light", viewport: "mobile" },
];

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();

  for (const { locale, theme, viewport } of SHOTS) {
    const context = await browser.newContext({
      viewport: VIEWPORTS[viewport],
      deviceScaleFactor: 2,
      // The app persists the theme choice, so seeding storage is equivalent to
      // clicking the toggle but does not depend on the header markup.
      storageState: {
        cookies: [],
        origins: [
          { origin: BASE, localStorage: [{ name: "theme", value: theme }] },
        ],
      },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(String(e)));

    await page.goto(`${BASE}/${locale}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(900);

    const applied = await page.evaluate(() =>
      document.documentElement.getAttribute("data-theme"),
    );
    const dir = await page.evaluate(() =>
      document.documentElement.getAttribute("dir"),
    );

    const name = `${viewport}-${locale}-${theme}.png`;
    await page.screenshot({ path: path.join(OUT, name), fullPage: true });
    console.log(
      `${name}  theme=${applied} dir=${dir}${
        errors.length ? `  console-errors=${errors.length}` : ""
      }`,
    );
    for (const e of errors.slice(0, 5)) console.log(`    ${e}`);

    await context.close();
  }

  await browser.close();
  console.log(`\nwrote to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
