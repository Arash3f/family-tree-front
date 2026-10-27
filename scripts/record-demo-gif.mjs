/**
 * Records the README demo: add a child, then ask how two people are related.
 * Drives the invented family of `showcase-data.mjs` against the mock API, so
 * no real data is ever filmed. Frames are plain screenshots taken while the
 * scenario runs — Playwright's own video letterboxes a desktop viewport — and
 * sharp joins them into `.shots/demo-<locale>.gif`, each frame carrying the
 * time it actually took, so the GIF plays at the speed it was recorded.
 *
 * Usage: build and start the app, then
 *   node scripts/record-demo-gif.mjs [baseUrl] [locale]
 */
import { mkdir, readFile, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import { chromium } from "playwright"
import { installMockApi, MOCK_IDS } from "./mock-api.mjs"
import { showcaseDataset } from "./showcase-data.mjs"

const BASE = process.argv[2] ?? "http://localhost:5198"
const LOCALE = process.argv[3] ?? "en"
const ROOT = path.resolve(import.meta.dirname, "..")
const OUT = path.join(ROOT, ".shots")
const WORK = path.join(OUT, "demo-work")
// sharp ships with Next.js; resolve it from there instead of adding a dependency.
const sharp = createRequire(createRequire(import.meta.url).resolve("next/package.json"))("sharp")

// The width the landing shots use: narrower, and the canvas tools fold
// behind a ⋮ menu.
const VIEWPORT = { width: 1150, height: 719 }
/** The child typed on camera — invented, like the rest of the family. */
const GIVEN_NAME = { en: "Maya", fa: "مریم" }
const FAMILY_NAME = { en: "Carter", fa: "رحیمی" }

/** GIF width the README shows it at, plus its palette and frame pacing. */
const GIF = { width: 900, colours: 128, minDelayMs: 60, maxDelayMs: 900 }

async function messages(locale) {
  const raw = await readFile(path.join(ROOT, "messages", `${locale}.json`), "utf8")
  return JSON.parse(raw).pedigree
}

/**
 * Every per-tree permission, so the detail panel offers its "add relative"
 * tiles. `mock-api.mjs` keeps an older, narrower set that the landing
 * screenshots are framed around, and widening it there would move them.
 */
const TREE_ACCESS = [
  "view",
  "person_create",
  "person_update",
  "person_delete",
  "marriage_create",
  "marriage_update",
  "marriage_delete",
  "marriage_divorce",
  "upload_photo",
  "view_birth_date",
  "view_marriage_date",
  "view_photo",
]

/**
 * Echoes created people and marriages back, so the canvas can grow on camera,
 * and hands the tree the permissions the add tiles need.
 */
async function installWriteMocks(page, dataset) {
  let serial = 0
  const tree = {
    id: MOCK_IDS.TREE_ID,
    name: dataset.treeName,
    owner_user_id: MOCK_IDS.USER_ID,
    my_permissions: TREE_ACCESS,
  }
  await page.route("**/backend/family-trees", async (route) =>
    route.request().method() === "GET"
      ? route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([tree]),
        })
      : route.fallback(),
  )
  await page.route("**/backend/family-trees/**", async (route) => {
    const request = route.request()
    const method = request.method()
    const p = new URL(request.url()).pathname
    const payload = request.postData() ? JSON.parse(request.postData()) : {}
    const json = (data) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) })

    if (/\/persons$/.test(p) && method === "POST") {
      serial += 1
      return json({ ...payload, id: `p-new-${serial}`, photo_object_key: null, photo_url: null })
    }
    if (/\/marriages$/.test(p) && method === "POST") {
      serial += 1
      return json({ id: `m-new-${serial}`, divorced_at: null, ...payload })
    }
    if (new RegExp(`/family-trees/${MOCK_IDS.TREE_ID}$`).test(p) && method === "GET") {
      return json(tree)
    }
    return route.fallback()
  })
}

/**
 * Screenshots the page in a loop until `stop()` is called, scaling each frame
 * to the GIF width as it arrives so the whole take never sits in memory at
 * full size.
 *
 * @param page - the page to film
 *
 * @returns `stop` to end the take, and `frames`, a promise of the captured
 * frames with the millisecond each one was taken
 */
function startRecorder(page) {
  const frames = []
  let running = true
  const done = (async () => {
    while (running) {
      const at = Date.now()
      const shot = await page.screenshot({ type: "png" }).catch(() => null)
      if (!shot) break
      frames.push({ at, buffer: await sharp(shot).resize(GIF.width).png().toBuffer() })
    }
    return frames
  })()
  return { stop: () => { running = false; return done } }
}

export async function main() {
  await rm(WORK, { recursive: true, force: true })
  await mkdir(WORK, { recursive: true })
  const t = await messages(LOCALE)
  const dataset = showcaseDataset(LOCALE)
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
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
  })
  const page = await context.newPage()
  const unmatched = await installMockApi(page, { dataset })
  await installWriteMocks(page, dataset)
  await page.goto(`${BASE}/${LOCALE}/dashboard/trees/${MOCK_IDS.TREE_ID}`, {
    waitUntil: "networkidle",
  })
  await page.waitForTimeout(1500)

  await page.getByRole("button", { name: t.fullscreen, exact: true }).click()
  await page.getByRole("button", { name: t.layoutDensityCompact, exact: true }).click()
  await page.getByRole("button", { name: t.fitView, exact: true }).click()
  await page.waitForTimeout(1200)

  const recorder = startRecorder(page)

  // 1. add a child to the youngest couple
  const father = dataset.persons.find((p) => p.id === dataset.relation.fromId)
  await page.locator(`.react-flow__node[data-id="${father.id}"]`).click()
  await page.waitForTimeout(900)
  await page.getByRole("button", { name: t.addChild, exact: true }).click()
  await page.waitForTimeout(700)
  // A required field's label carries a trailing " *", and in Persian نام is also
  // the start of نام خانوادگی, so ask for the whole label, not a prefix.
  const labelled = (label, required = false) =>
    page.getByLabel(required ? `${label} *` : label, { exact: true })
  const givenName = labelled(t.fields.name, true)
  await givenName.pressSequentially(GIVEN_NAME[LOCALE] ?? GIVEN_NAME.en, { delay: 110 })
  await labelled(t.fields.familyName).fill(FAMILY_NAME[LOCALE] ?? FAMILY_NAME.en)
  // Gender is a listbox button, not a native <select>.
  await labelled(t.fields.gender).click()
  await page.getByRole("option", { name: t.gender.female, exact: true }).click()
  await page.waitForTimeout(500)
  await page.getByRole("button", { name: t.save, exact: true }).click()
  await page.waitForTimeout(1600)
  await page.getByRole("button", { name: t.fitView, exact: true }).click()
  await page.waitForTimeout(1200)

  // 2. ask how two cousins are related. Saving selects the new person, and the
  // panel searches from whoever is selected, so put the father back in focus.
  const to = dataset.persons.find((p) => p.id === dataset.relation.toId)
  // Close the panel first: it follows reading direction, so in RTL it sits
  // over the very node that has to be clicked next.
  await page.getByRole("button", { name: t.close, exact: true }).first().click()
  await page.waitForTimeout(500)
  await page.getByRole("button", { name: t.fitView, exact: true }).click()
  await page.waitForTimeout(800)
  await page.locator(`.react-flow__node[data-id="${father.id}"]`).click()
  await page.waitForTimeout(800)
  await page.getByRole("button", { name: t.findRelation }).click()
  await page.waitForTimeout(600)
  await page.getByPlaceholder(t.relateSearchPlaceholder).pressSequentially(to.name, { delay: 110 })
  await page.waitForTimeout(600)
  await page.getByRole("option", { name: new RegExp(to.name) }).first().click()
  await page.waitForTimeout(500)
  await page.getByRole("button", { name: t.runRelation, exact: true }).click()
  await page.waitForTimeout(2000)
  await page.getByRole("button", { name: t.pathViewActive, exact: true }).click()
  await page.waitForTimeout(900)
  // The path is framed on the whole canvas, so the panel covers its far end;
  // drag the canvas out from under it for the closing beat.
  const pane = await page.locator(".react-flow__pane").boundingBox()
  await page.mouse.move(pane.x + pane.width / 2, pane.y + pane.height - 12)
  await page.mouse.down()
  await page.mouse.move(
    pane.x + pane.width / 2 + (LOCALE === "fa" ? 170 : -170),
    pane.y + pane.height - 12,
    { steps: 12 },
  )
  await page.mouse.up()
  await page.waitForTimeout(2000)

  const frames = await recorder.stop()
  if (unmatched.length) console.warn("unmocked:", unmatched)
  await context.close()
  await browser.close()

  // Each frame is shown for the time until the next one, so the GIF keeps the
  // pace of the take; the last frame holds a beat before the loop restarts.
  const delays = frames.map((frame, i) => {
    const span = i + 1 < frames.length ? frames[i + 1].at - frame.at : GIF.maxDelayMs
    return Math.min(GIF.maxDelayMs, Math.max(GIF.minDelayMs, Math.round(span)))
  })
  const gif = path.join(OUT, `demo-${LOCALE}.gif`)
  await sharp(
    frames.map((frame) => frame.buffer),
    { join: { animated: true } },
  )
    .gif({ delay: delays, loop: 0, colours: GIF.colours, effort: 10 })
    .toFile(gif)
  const seconds = (delays.reduce((sum, d) => sum + d, 0) / 1000).toFixed(1)
  console.log(`${frames.length} frames, ${seconds}s -> ${path.relative(ROOT, gif)}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
