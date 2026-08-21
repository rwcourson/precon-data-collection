import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL;
assert.match(
  baseUrl ?? "",
  /^http:\/\/127\.0\.0\.1:\d+$/,
  "BASE_URL must target the isolated local server"
);

const shots = ".smoke-shots";
fs.mkdirSync(shots, { recursive: true });
const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (error) =>
  errors.push(`${page.url()} pageerror: ${error.message}`)
);
page.on("console", (message) => {
  const text = message.text();
  if (message.type() !== "error") return;
  // Chromium logs HTTP 4xx/5xx as console errors; those are not page crashes.
  if (/Failed to load resource:/.test(text)) return;
  errors.push(`${page.url()} console: ${text}`);
});

const report = (message) => process.stdout.write(`PASS ${message}\n`);
const shot = (name) =>
  page.screenshot({ path: `${shots}/${name}.png`, fullPage: false });

async function pickPersona(name) {
  const trigger = page.locator('header [data-slot="dropdown-menu-trigger"]');
  await trigger.click();
  const item = page.getByRole("menuitem").filter({ hasText: name });
  await item.waitFor({ state: "visible" });
  await item.click();
  await trigger.getByText(name, { exact: true }).waitFor({ state: "visible" });
}

try {
  await page.goto(`${baseUrl}/`);
  await page.waitForLoadState("networkidle");
  assert.ok(
    await page.locator("h1").first().textContent(),
    "Home must render a heading"
  );
  await shot("01-home");
  report("home renders");

  await pickPersona("Sarah Chen");
  await page.goto(`${baseUrl}/`);
  await page.waitForLoadState("networkidle");
  assert.equal(
    await page.getByRole("link", { name: "AI Copilot" }).count(),
    0,
    "PCM chrome must not expose Copilot"
  );
  assert.equal(
    await page.getByRole("link", { name: "Dashboards" }).count(),
    0,
    "PCM chrome must not expose Dashboards"
  );
  await page.goto(`${baseUrl}/copilot`);
  await page.waitForLoadState("networkidle");
  assert.notEqual(
    new URL(page.url()).pathname,
    "/copilot",
    "PCM Copilot URL must be denied"
  );
  report("PCM chrome and Copilot route denial");

  assert.equal(
    await page.getByRole("link", { name: "Admin" }).count(),
    0,
    "PCM chrome must not expose Admin"
  );
  const pcmNav = await page.locator("aside a, nav a").allTextContents();
  assert.equal(
    pcmNav.some((text) => /AI Copilot|Dashboards|Reports/.test(text)),
    false,
    "PCM desktop chrome must stay on Overview, Bid Schedule, and Post-Bid"
  );

  await pickPersona("Brian Meyers");
  await page.goto(`${baseUrl}/`);
  await page.waitForLoadState("networkidle");
  assert.ok(
    (await page.getByRole("link", { name: "AI Copilot" }).count()) > 0,
    "RPD chrome must keep Copilot"
  );
  report("Brian Meyers retains Tools and Copilot");

  await page.goto(`${baseUrl}/bid-schedule`);
  await page.waitForLoadState("networkidle");
  const rowCount = await page.locator("table tbody tr").count();
  assert.ok(rowCount > 0, "Bid Schedule must contain seeded rows");
  await shot("02-bid-schedule");
  report(`bid schedule renders ${rowCount} rows`);

  for (const label of ["Group by", "Sort", "Density", "View"]) {
    assert.ok(
      (await page.getByText(label, { exact: true }).count()) > 0,
      `Bid Schedule must label ${label}`
    );
  }
  assert.ok(
    (await page.getByText("Upcoming + Active").count()) > 0,
    "Upcoming + Active section must be present"
  );
  assert.ok(
    (await page.getByRole("link", { name: "Excel" }).count()) > 0,
    "One-click Excel must be present"
  );
  const tableIds = await page
    .locator("[data-schedule-job-id]")
    .evaluateAll((els) =>
      [
        ...new Set(els.map((el) => el.getAttribute("data-schedule-job-id"))),
      ].sort()
    );
  assert.ok(tableIds.length > 0, "Table jobs must expose schedule job ids");
  await page.getByRole("link", { name: "Cards" }).click();
  await page.waitForLoadState("networkidle");
  const cardIds = await page
    .locator("[data-schedule-job-id]")
    .evaluateAll((els) =>
      [
        ...new Set(els.map((el) => el.getAttribute("data-schedule-job-id"))),
      ].sort()
    );
  assert.deepEqual(
    cardIds,
    tableIds,
    "Cards must show the same jobs as the table"
  );
  await page.getByRole("link", { name: "Gantt" }).click();
  await page.waitForLoadState("networkidle");
  const ganttIds = await page
    .locator("[data-schedule-job-id]")
    .evaluateAll((els) =>
      [
        ...new Set(els.map((el) => el.getAttribute("data-schedule-job-id"))),
      ].sort()
    );
  assert.deepEqual(
    ganttIds,
    tableIds,
    "Gantt must show the same jobs as the table"
  );
  await page.getByRole("link", { name: "Table" }).click();
  await page.waitForLoadState("networkidle");
  report("table, cards, and gantt share job ids");

  await page.getByRole("button", { name: "New Pursuit" }).click();
  await page
    .getByPlaceholder(/Riverside Medical/)
    .fill("Isolated Smoke Test ROM");
  async function pickDialogSelect(label, option) {
    const field = page.locator('[role="dialog"] div.space-y-1\\.5', {
      has: page.getByText(label, { exact: false }),
    });
    const combo = field.locator('[role="combobox"]');
    if ((await combo.count()) === 0) return;
    await combo.click();
    await page
      .getByRole("option", { name: option, exact: true })
      .first()
      .click();
  }
  await pickDialogSelect("Region", "Central");
  await pickDialogSelect("Precon Department", "Central Heavy Civil");
  await pickDialogSelect("Estimate Phase", "Budget – Quick ROM");
  await page.getByRole("button", { name: "Create Pursuit" }).click();
  const created = page.getByText("Isolated Smoke Test ROM").first();
  await created.waitFor({ state: "visible" });
  await shot("03-created-pursuit");
  report("manual pursuit mutation is visible");
  assert.ok(
    (await page.getByText("Pending job number").count()) > 0,
    "Stored TBD identifiers must render as Pending job number"
  );

  await pickPersona("Marcus Webb");
  await page.goto(`${baseUrl}/post-bid`);
  await page.waitForLoadState("networkidle");
  const firstRound = page.locator("table tbody tr td a").first();
  await firstRound.waitFor({ state: "visible" });
  await firstRound.click();
  await page.waitForLoadState("networkidle");
  const feeField = page
    .locator("div.space-y-1", {
      has: page.getByText("Fee – Expected $", { exact: false }),
    })
    .locator("input")
    .first();
  await feeField.waitFor({ state: "visible" });
  await feeField.fill("1234567");
  await page.getByRole("button", { name: /Save Changes/ }).click();
  await page
    .locator("[data-sonner-toast]")
    .last()
    .waitFor({ state: "visible" });
  await shot("04-round-saved");
  report("post-bid field mutation saves");

  await pickPersona("Brian Meyers");
  await page.goto(`${baseUrl}/post-bid`);
  await page.waitForLoadState("networkidle");
  const postBidRows = await page
    .locator("table")
    .first()
    .locator("tbody tr")
    .evaluateAll((elements) =>
      elements
        .map((row) => {
          const link = row.querySelector("td a");
          const progress =
            row.querySelector("td:nth-child(6)")?.textContent ?? "";
          const match = progress.match(/(\d+)\/(\d+)/);
          return link
            ? {
                href: link.getAttribute("href"),
                incomplete: Boolean(
                  match && Number(match[1]) < Number(match[2])
                ),
              }
            : null;
        })
        .filter(Boolean)
    );
  const incompleteHref =
    postBidRows.find((row) => row.incomplete)?.href ?? postBidRows[0]?.href;
  assert.ok(incompleteHref, "Post-bid queue must include a round");
  await page.goto(`${baseUrl}${incompleteHref}`);
  await page.waitForLoadState("networkidle");
  const approveButton = page.getByRole("button", { name: /Approve/ });
  await approveButton.waitFor({ state: "visible" });
  await approveButton.click();
  await page
    .locator("[data-sonner-toast]")
    .last()
    .waitFor({ state: "visible" });
  report("RPD approval path responds");

  await page.goto(`${baseUrl}/dashboards?level=corporate`);
  await page.waitForLoadState("networkidle");
  assert.ok(
    await page.locator("main").isVisible(),
    "Dashboard surface must render"
  );
  await shot("05-dashboards");
  report("corporate dashboard renders");

  await pickPersona("Tom Reeves");
  await page.goto(`${baseUrl}/reports`);
  await page.waitForLoadState("networkidle");
  const savedReport = page
    .getByRole("button", { name: /Fee % by Region \(Locked Rounds\)/ })
    .first();
  await savedReport.waitFor({ state: "visible" });
  await savedReport.click();
  await page.getByRole("button", { name: "Run Report" }).click();
  await page.locator("table").last().waitFor({ state: "visible" });
  await shot("06-report-run");
  report("saved report runs");

  await page.goto(`${baseUrl}/admin`);
  await page.waitForLoadState("networkidle");
  const addColumnButtons = page.getByRole("button", { name: "Add Column" });
  await addColumnButtons.last().click();
  await page
    .getByPlaceholder("e.g. River Mile Marker")
    .fill("Isolated Smoke Column");
  await page.getByRole("button", { name: "Add Column" }).last().click();
  const column = page.getByText("Isolated Smoke Column").first();
  await column.waitFor({ state: "visible" });
  await shot("07-admin-column-added");
  report("RPD admin column mutation is visible");

  await page.setViewportSize({ width: 834, height: 1112 });
  await page.goto(`${baseUrl}/bid-schedule`);
  await page.waitForLoadState("networkidle");
  assert.ok(
    (await page.getByText("Group by", { exact: true }).count()) > 0,
    "iPad viewport must keep Group by visible"
  );
  await shot("08-ipad-bid-schedule");
  report("iPad viewport renders schedule labels");

  await pickPersona("Sarah Chen");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/bid-schedule`);
  await page.waitForLoadState("networkidle");
  assert.ok(
    await page.locator("main").isVisible(),
    "Mobile viewport must render the app"
  );
  assert.equal(
    await page.getByRole("link", { name: "AI Copilot" }).count(),
    0,
    "PCM mobile chrome must not expose Copilot"
  );
  await shot("09-mobile-bid-schedule");
  report("mobile viewport renders");

  assert.deepEqual(
    errors,
    [],
    `Browser errors detected:\n${errors.join("\n")}`
  );
} finally {
  await browser.close();
}
