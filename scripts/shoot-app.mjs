import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { installMockApi, MOCK_IDS } from "./mock-api.mjs";

const BASE = process.argv[2] ?? "http://localhost:5199";
const OUT = path.resolve(import.meta.dirname, "..", ".shots", "app");
const { TREE_ID, USER_ID, TICKET_ID } = MOCK_IDS;

const PAGES = [
  { name: "dashboard", path: "/dashboard" },
  { name: "users", path: "/dashboard/users" },
  { name: "tickets", path: "/dashboard/tickets" },
  { name: "trees", path: "/dashboard/trees" },
  { name: "tree-settings", path: `/dashboard/trees/${TREE_ID}/settings` },
  { name: "tree", path: `/dashboard/trees/${TREE_ID}` },
  { name: "user", path: `/dashboard/users/${USER_ID}` },
  { name: "ticket", path: `/dashboard/tickets/${TICKET_ID}` },
  { name: "profile-sessions", path: "/dashboard/profile/sessions" },
];

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();

  for (const locale of ["en", "fa"]) {
    for (const vp of [
      { name: "320", width: 320, height: 720 },
      { name: "768", width: 768, height: 1024 },
    ]) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 2,
        reducedMotion: "reduce",
        storageState: {
          cookies: [],
          origins: [
            {
              origin: BASE,
              localStorage: [
                { name: "theme", value: "light" },
                { name: "ft.access_token", value: "mock-access" },
                { name: "ft.refresh_token", value: "mock-refresh" },
                { name: "ft.token_type", value: "bearer" },
              ],
            },
          ],
        },
      });
      const page = await context.newPage();
      await installMockApi(page);

      for (const item of PAGES) {
        await page.goto(`${BASE}/${locale}${item.path}`, {
          waitUntil: "networkidle",
        });
        await page.waitForTimeout(item.name === "tree" ? 2200 : 600);
        const file = `${item.name}-${locale}-${vp.name}.png`;
        await page.screenshot({ path: path.join(OUT, file), fullPage: true });
        console.log(file);
      }
      await context.close();
    }
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
