/*
 * Design-system audit. Walks the app in both themes and reports every control
 * that sits outside the shared tokens, so "standardized" is a measurement
 * rather than an opinion.
 *
 *   BASE_URL=http://localhost:3000 node scripts/ui-audit.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

/*
 * Tokens are declared in rem. The app's root is 13px/14px rather than the
 * browser default, so the expected pixel values are derived at runtime — a
 * hardcoded px table would flag the whole app as off-token.
 */
const BUTTON_HEIGHT_REM = [1.5, 1.75, 2, 2.25]; // xs, sm, default, lg
const BUTTON_FONT_REM = [0.75, 0.875]; // text-xs, text-sm
const BADGE_HEIGHT_REM = [1.125, 1.25]; // sm, default
const BADGE_FONT_REM = [0.6875, 0.75]; // text-2xs, text-xs

let ROOT_PX = 14;
/** Tolerant of sub-pixel layout: a token match within half a pixel. */
const onScale = (value, remScale) =>
  remScale.some((rem) => Math.abs(rem * ROOT_PX - value) <= 0.51);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push(String(e.message)));
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});

/** Everything the audit collects, keyed so duplicates across routes collapse. */
const findings = new Map();
const record = (kind, detail, where) => {
  const key = `${kind}\u0000${detail}`;
  const hit = findings.get(key) ?? { kind, detail, routes: new Set() };
  hit.routes.add(where);
  findings.set(key, hit);
};

const collect = () =>
  page.evaluate(() => {
    const out = {
      root: parseFloat(getComputedStyle(document.documentElement).fontSize),
      badges: [],
      buttons: [],
      unnamed: [],
      noType: [],
      noFocus: [],
    };

    for (const el of document.querySelectorAll("[data-slot=badge]")) {
      const c = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (r.height === 0) continue;
      out.badges.push({
        h: r.height,
        font: parseFloat(c.fontSize),
        radius: parseFloat(c.borderTopLeftRadius),
        text: (el.textContent || "").trim().slice(0, 24),
      });
    }

    for (const el of document.querySelectorAll("[data-slot=button]")) {
      const c = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (r.height === 0) continue;
      out.buttons.push({
        h: r.height,
        font: parseFloat(c.fontSize),
        text: (el.textContent || "").trim().slice(0, 24) || "(icon)",
      });
    }

    /* Controls the design system does not own yet. */
    for (const el of document.querySelectorAll("button")) {
      const r = el.getBoundingClientRect();
      if (r.height === 0) continue;
      const name = (
        el.getAttribute("aria-label") ||
        el.getAttribute("title") ||
        el.textContent ||
        ""
      ).trim();
      const label = `${el.className || ""}`.slice(0, 70);
      if (!name) out.unnamed.push(label);
      if (!el.hasAttribute("type")) out.noType.push(label);
      /* A control with no focus-visible rule is unreachable-looking by keyboard.
         The Button primitive bakes one in; hand-rolled ones often do not. */
      if (!el.dataset.slot && !/focus-visible:/.test(el.className || "")) {
        out.noFocus.push(label);
      }
    }
    return out;
  });

async function auditRoute(route, theme) {
  const where = `${route} [${theme}]`;
  await page.goto(BASE + route, { waitUntil: "networkidle" });
  await page.waitForTimeout(250);

  const r = await collect();
  ROOT_PX = r.root;

  for (const b of r.badges) {
    if (!onScale(b.h, BADGE_HEIGHT_REM) || !onScale(b.font, BADGE_FONT_REM))
      record(
        "badge off-token",
        `h=${b.h}px font=${b.font}px · “${b.text}”`,
        where
      );
    /* Every badge is a pill; a rounded rectangle means a local override. */
    if (b.radius < b.h / 2 - 0.51)
      record(
        "badge not a pill",
        `radius=${b.radius}px h=${b.h}px · “${b.text}”`,
        where
      );
  }
  for (const b of r.buttons) {
    if (!onScale(b.h, BUTTON_HEIGHT_REM) || !onScale(b.font, BUTTON_FONT_REM))
      record(
        "button off-token",
        `h=${b.h}px font=${b.font}px · “${b.text}”`,
        where
      );
  }
  for (const c of r.unnamed) record("button has no accessible name", c, where);
  for (const c of r.noType) record("button missing type=", c, where);
  for (const c of r.noFocus) record("no focus-visible style", c, where);
}

const ROUTES = [
  "/",
  "/bid-schedule",
  "/post-bid",
  "/sheets",
  "/dashboards?level=corporate",
  "/dashboards?level=region",
  "/reports",
  "/admin",
  "/admin?tab=review",
  "/admin?tab=notifications",
  "/admin?tab=access",
  "/admin?tab=integrations",
  "/admin?tab=migration",
];

/* Detail pages carry the alerts and status pills, so resolve one of each. */
async function firstHref(selector) {
  const loc = page.locator(selector).first();
  if ((await loc.count()) === 0) return null;
  try {
    return await loc.getAttribute("href", { timeout: 3_000 });
  } catch {
    return null;
  }
}

async function detailRoutes() {
  const extra = [];
  await page.goto(`${BASE}/post-bid`, { waitUntil: "domcontentloaded" });
  const round = await firstHref('a[href^="/rounds/"]');
  if (round) extra.push(round);
  await page.goto(`${BASE}/sheets`, { waitUntil: "domcontentloaded" });
  const sheet = await firstHref('a[href^="/sheets/"]');
  if (sheet) extra.push(sheet);
  await page.goto(`${BASE}/bid-schedule`, { waitUntil: "domcontentloaded" });
  const job = await firstHref('a[href^="/jobs/"]');
  if (job) extra.push(job);
  return extra;
}

const routes = [...ROUTES, ...(await detailRoutes())];

for (const theme of ["light", "dark"]) {
  await page.emulateMedia({ colorScheme: theme });
  await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
  for (const route of routes) await auditRoute(route, theme);
}

await browser.close();

const grouped = new Map();
for (const f of findings.values()) {
  const list = grouped.get(f.kind) ?? [];
  list.push(f);
  grouped.set(f.kind, list);
}

console.log(`\nAudited ${routes.length} routes × 2 themes\n`);
if (grouped.size === 0) console.log("No off-token controls found.");
for (const [kind, list] of grouped) {
  console.log(`\n${kind} — ${list.length} distinct`);
  for (const f of list.slice(0, 12)) {
    const routes = [...f.routes];
    console.log(
      `  · ${f.detail}\n      ${routes.slice(0, 3).join(", ")}${routes.length > 3 ? ` +${routes.length - 3} more` : ""}`
    );
  }
  if (list.length > 12) console.log(`  … ${list.length - 12} more`);
}

const noisy = consoleErrors.filter(
  (e) =>
    !/favicon|hydrat|Minified React error #418|status of 404|Failed to load resource/i.test(
      e
    )
);
console.log(
  `\nConsole errors (excluding hydration/favicon/404): ${noisy.length}`
);
for (const e of noisy.slice(0, 5)) console.log("  ✗", e.slice(0, 160));

// Soft mode (isolated CI wrapper): report token findings but fail only on hard console errors.
const soft = process.env.UI_AUDIT_SOFT === "1";
if (noisy.length > 0) process.exit(1);
if (!soft && findings.size > 0) process.exit(1);
process.exit(0);
