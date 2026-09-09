/**
 * Responsive regression checks across every route, locale, theme, and a
 * representative set of widths. Catches the failures that are cheap to assert
 * but tedious to eyeball: horizontal overflow, text clipped by its own box,
 * touch targets under the WCAG minimum, and controls that spill their row.
 *
 * Authenticated screens run against scripts/mock-api.mjs, so no backend is
 * needed. Fixtures use deliberately long names, because layout only breaks on
 * the long strings.
 *
 * Usage: node scripts/check-layout.mjs [baseUrl] [...routeFilters]
 */
import { chromium } from "playwright";
import { installMockApi, MOCK_IDS } from "./mock-api.mjs";

const BASE = process.argv[2]?.startsWith("http")
  ? process.argv[2]
  : "http://localhost:5199";
const FILTERS = process.argv.slice(BASE === process.argv[2] ? 3 : 2);

const { TREE_ID, USER_ID, ROLE_ID, TICKET_ID } = MOCK_IDS;

const ROUTES = [
  { path: "", auth: false, name: "landing" },
  { path: "/login", auth: false, name: "login" },
  { path: "/this-route-does-not-exist", auth: false, name: "404" },
  { path: "/dashboard", auth: true, name: "dashboard" },
  { path: "/dashboard/profile", auth: true, name: "profile" },
  { path: "/dashboard/profile/password", auth: true, name: "profile-password" },
  { path: "/dashboard/profile/sessions", auth: true, name: "profile-sessions" },
  {
    path: "/dashboard/profile/permissions",
    auth: true,
    name: "profile-permissions",
  },
  { path: "/dashboard/users", auth: true, name: "users" },
  { path: "/dashboard/users/new", auth: true, name: "user-new" },
  { path: `/dashboard/users/${USER_ID}`, auth: true, name: "user-detail" },
  { path: "/dashboard/roles", auth: true, name: "roles" },
  { path: "/dashboard/roles/new", auth: true, name: "role-new" },
  { path: `/dashboard/roles/${ROLE_ID}`, auth: true, name: "role-detail" },
  { path: "/dashboard/tickets", auth: true, name: "tickets" },
  { path: "/dashboard/tickets/new", auth: true, name: "ticket-new" },
  { path: `/dashboard/tickets/${TICKET_ID}`, auth: true, name: "ticket-detail" },
  { path: "/dashboard/trees", auth: true, name: "trees" },
  { path: "/dashboard/trees/new", auth: true, name: "tree-new" },
  {
    path: `/dashboard/trees/${TREE_ID}/settings`,
    auth: true,
    name: "tree-settings",
  },
  { path: `/dashboard/trees/${TREE_ID}`, auth: true, name: "tree-pedigree" },
];

/**
 * 320 is the narrowest width worth supporting (iPhone SE in portrait).
 * 768 and 1024 straddle the tablet breakpoints. 1440 is the common desktop.
 */
const VIEWPORTS = [
  { name: "320", width: 320, height: 720 },
  { name: "768", width: 768, height: 1024 },
  { name: "1440", width: 1440, height: 900 },
];

const LOCALES = ["en", "fa"];
const THEMES = ["light", "dark"];

const TOKENS = [
  { name: "ft.access_token", value: "mock-access" },
  { name: "ft.refresh_token", value: "mock-refresh" },
  { name: "ft.token_type", value: "bearer" },
];

function auditPage() {
  const docWidth = document.documentElement.clientWidth;
  const overflow = [];
  const clipped = [];
  const small = [];

  // Decorative art is deliberately bled past the edge and clipped by an
  // ancestor; only overflow the reader can actually see is a defect.
  const decorative = (el) =>
    el.closest("[aria-hidden='true'], svg, .react-flow__renderer") !== null;

  // A closed off-canvas drawer is parked outside the viewport on purpose. It
  // is only correct to skip it when it is also `inert` — a drawer that is
  // merely translated away is still focusable, which is a real defect, so
  // leave that one to be reported.
  const parked = (el) => el.closest("[inert]") !== null;

  const label = (el) => {
    const cls = el.className?.toString?.() ?? "";
    const short = cls.replace(/[\w-]*module__\w+__/g, "").slice(0, 44);
    return `<${el.tagName.toLowerCase()}${short ? ` class="${short}"` : ""}>`;
  };

  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") continue;
    if (decorative(el) || parked(el)) continue;

    // A cell that sticks out of the viewport is fine if an ancestor scrolls
    // it — that is the intended pattern for a wide table on a phone.
    const inScroller = (() => {
      let node = el.parentElement;
      while (node && node !== document.body) {
        const s = getComputedStyle(node);
        const ox = s.overflowX;
        const oy = s.overflowY;
        if (
          ox === "auto" ||
          ox === "scroll" ||
          oy === "auto" ||
          oy === "scroll"
        ) {
          return true;
        }
        node = node.parentElement;
      }
      return false;
    })();

    if (!inScroller && (r.right > docWidth + 1 || r.left < -1)) {
      overflow.push({
        el: label(el),
        text: (el.textContent ?? "").trim().slice(0, 28),
        left: Math.round(r.left),
        right: Math.round(r.right),
      });
    }

    // `scrollWidth` counts decorative art bled past the edge on purpose, so
    // measure only the descendants a reader is meant to see.
    const scrollable =
      style.overflowY === "auto" ||
      style.overflowY === "scroll" ||
      style.overflowX === "auto" ||
      style.overflowX === "scroll";
    if (style.overflow !== "visible" && !scrollable && r.height > 0) {
      let worst = null;
      for (const child of el.querySelectorAll("*")) {
        if (decorative(child) || parked(child)) continue;
        if (!child.textContent?.trim()) continue;
        const cr = child.getBoundingClientRect();
        if (cr.width === 0 && cr.height === 0) continue;
        const spill = Math.max(
          cr.right - r.right,
          r.left - cr.left,
          cr.bottom - r.bottom,
          r.top - cr.top,
        );
        if (spill > 2 && (!worst || spill > worst.spill)) {
          worst = {
            spill: Math.round(spill),
            text: child.textContent.trim().slice(0, 28),
          };
        }
      }
      if (worst) {
        clipped.push({ el: label(el), by: worst.spill, text: worst.text });
      }
    }

    // WCAG 2.5.8 Target Size (Minimum) is 24x24 CSS px. A checkbox inside a
    // wrapping <label> uses the label as the hit area, so measure that.
    const hit =
      el.tagName === "INPUT" && el.closest("label")
        ? el.closest("label").getBoundingClientRect()
        : r;
    if (
      (el.tagName === "A" || el.tagName === "BUTTON" || el.tagName === "INPUT") &&
      (hit.height < 24 || hit.width < 24)
    ) {
      small.push({
        el: label(el),
        text: (el.textContent ?? el.getAttribute("aria-label") ?? "")
          .trim()
          .slice(0, 24),
        size: `${Math.round(hit.width)}x${Math.round(hit.height)}`,
      });
    }
  }

  const dedupe = (list, key) => {
    const seen = new Set();
    return list.filter((item) => {
      const k = key(item);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };

  return {
    scrollWidth: document.documentElement.scrollWidth,
    docWidth,
    overflow: dedupe(overflow, (o) => o.el + o.text).slice(0, 5),
    clipped: dedupe(clipped, (c) => c.el + c.text).slice(0, 5),
    small: dedupe(small, (s) => s.el + s.text).slice(0, 5),
  };
}

async function main() {
  const routes = FILTERS.length
    ? ROUTES.filter((r) => FILTERS.some((f) => r.name.includes(f)))
    : ROUTES;

  if (routes.length === 0) {
    console.error(`no route matched ${FILTERS.join(", ")}`);
    process.exit(1);
  }

  const browser = await chromium.launch();
  const failures = [];
  let checks = 0;

  for (const route of routes) {
    for (const locale of LOCALES) {
      for (const theme of THEMES) {
        for (const vp of VIEWPORTS) {
          const context = await browser.newContext({
            viewport: { width: vp.width, height: vp.height },
            reducedMotion: "reduce",
            storageState: {
              cookies: [],
              origins: [
                {
                  origin: BASE,
                  localStorage: [
                    { name: "theme", value: theme },
                    ...(route.auth ? TOKENS : []),
                  ],
                },
              ],
            },
          });
          const page = await context.newPage();
          const unmatched = await installMockApi(page);
          const pageErrors = [];
          page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 120)));

          const url = `${BASE}/${locale}${route.path}`;
          await page.goto(url, { waitUntil: "networkidle" });
          await page.waitForTimeout(route.name === "tree-pedigree" ? 2500 : 700);

          const report = await page.evaluate(auditPage);
          checks++;

          const label = `${route.name} ${locale} ${theme} ${vp.name}px`;
          const scrolls = report.scrollWidth > report.docWidth + 1;
          const lines = [];

          if (scrolls)
            lines.push(
              `horizontal scroll: page is ${report.scrollWidth}px wide in a ${report.docWidth}px viewport`,
            );
          for (const o of report.overflow)
            lines.push(`overflow  ${o.el} "${o.text}" spans ${o.left}..${o.right}`);
          for (const c of report.clipped)
            lines.push(`clipped   ${c.el} cuts "${c.text}" by ${c.by}px`);
          for (const s of report.small)
            lines.push(`tiny tap  ${s.el} "${s.text}" is ${s.size}`);
          for (const u of unmatched) lines.push(`unmocked  ${u}`);
          for (const e of pageErrors) lines.push(`js error  ${e}`);

          if (lines.length) {
            failures.push({ label, lines });
            console.log(`FAIL ${label}`);
            for (const l of lines) console.log(`       ${l}`);
          } else {
            console.log(`ok   ${label}`);
          }

          await context.close();
        }
      }
    }
  }

  await browser.close();

  console.log(`\n${checks} combinations checked`);
  if (failures.length) {
    console.log(`${failures.length} failing:\n`);
    // Group by the underlying complaint so one CSS bug reads as one problem.
    const byLine = new Map();
    for (const f of failures) {
      for (const l of f.lines) {
        if (!byLine.has(l)) byLine.set(l, []);
        byLine.get(l).push(f.label);
      }
    }
    for (const [line, where] of [...byLine].sort(
      (a, b) => b[1].length - a[1].length,
    )) {
      console.log(`${line}`);
      console.log(`   in ${where.length}: ${where.slice(0, 4).join(", ")}${where.length > 4 ? ", …" : ""}\n`);
    }
    process.exit(1);
  }
  console.log("all clean");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
