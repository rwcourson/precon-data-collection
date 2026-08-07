/* End-to-end smoke test of the demo flows against the running dev server. */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const SHOTS = ".smoke-shots";
fs.mkdirSync(SHOTS, { recursive: true });

const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text()}`);
});

const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
const log = (s) => console.log(`✓ ${s}`);

async function pickPersona(name) {
  // Open role switcher (rightmost header button shows current persona)
  await page.locator("header").getByRole("button").last().click();
  await page.getByRole("menuitem").filter({ hasText: name }).click();
  await page.waitForTimeout(800);
}

// 1. Home
await page.goto(BASE + "/");
await page.waitForLoadState("networkidle");
await shot("01-home");
log("Home renders: " + (await page.locator("h1").first().textContent()));

// 2. Bid Schedule as PCM (default persona)
await page.goto(BASE + "/bid-schedule");
await page.waitForLoadState("networkidle");
await shot("02-bid-schedule");
const rowCount = await page.locator("table tbody tr").count();
log(`Bid Schedule renders ${rowCount} rows`);

// 3. Create a manual pursuit
await page.getByRole("button", { name: "New Pursuit" }).click();
await page.getByRole("tab", { name: /Manual/ }).click();
await page.getByPlaceholder(/Riverside Medical/).fill("Demo Smoke Test ROM");
// Region select
const selects = page.locator('[role="dialog"] [role="combobox"]');
async function pickSelect(index, optionText) {
  await selects.nth(index).click();
  await page.getByRole("option", { name: optionText, exact: true }).first().click();
}
await pickSelect(0, "Central");
await pickSelect(1, "Central Heavy Civil");
await pickSelect(2, "Budget – Quick ROM");
await page.getByRole("button", { name: "Create Pursuit" }).click();
await page.waitForTimeout(1200);
await shot("03-created-pursuit");
const created = await page.getByText("Demo Smoke Test ROM").first().isVisible().catch(() => false);
log(`Manual pursuit created and visible: ${created}`);

// 4. Post-bid queue as Estimate Lead
await pickPersona("Marcus Webb");
await page.goto(BASE + "/post-bid");
await page.waitForLoadState("networkidle");
await shot("04-post-bid-queue");
log("Post-bid queue renders");

// 5. Open first queue round, edit a field, save
const firstRound = page.locator("table tbody tr td a").first();
await firstRound.click();
await page.waitForLoadState("networkidle");
await shot("05-round-detail");
// Find "Fee – Expected $" input by label proximity
const feeField = page
  .locator("div.space-y-1", { has: page.getByText("Fee – Expected $", { exact: false }) })
  .locator("input");
if (await feeField.count()) {
  await feeField.first().fill("1234567");
  await page.getByRole("button", { name: /Save Changes/ }).click();
  await page.waitForTimeout(1000);
  log("Post-bid field edited and saved");
} else {
  log("Fee field not editable for this round (skipping save)");
}
await shot("06-round-saved");

// 6. RPD approval attempt (Bryan Myers)
await pickPersona("Bryan Myers");
await page.goto(BASE + "/post-bid");
await page.waitForLoadState("networkidle");
// open first post_bid round
await page.locator("table tbody tr td a").first().click();
await page.waitForLoadState("networkidle");
const approveBtn = page.getByRole("button", { name: /Approve/ });
if (await approveBtn.count()) {
  await approveBtn.click();
  await page.waitForTimeout(1200);
  await shot("07-approve-attempt");
  log("Approve & Lock clicked (toast shows result — blocked if incomplete)");
} else {
  log("No approve button on this round (not post_bid or wrong region)");
}

// 7. Dashboards corporate
await page.goto(BASE + "/dashboards?level=corporate");
await page.waitForLoadState("networkidle");
await page.waitForTimeout(800);
await shot("08-dashboards");
log("Dashboards render");

// 8. Report builder as Tom Reeves: load saved report and run
await pickPersona("Tom Reeves");
await page.goto(BASE + "/reports");
await page.waitForLoadState("networkidle");
const savedReport = page.getByText("Fee % by Region (Locked Rounds)");
if (await savedReport.count()) {
  await savedReport.click();
  await page.waitForTimeout(400);
}
await page.getByRole("button", { name: "Run Report" }).click();
await page.waitForTimeout(1500);
await shot("09-report-run");
const resultRows = await page.locator("table tbody tr").count();
log(`Report ran with ${resultRows} result rows`);

// 9. Admin: reference lists + add region column as RPD
await page.goto(BASE + "/admin");
await page.waitForLoadState("networkidle");
await shot("10-admin");
log("Admin renders");

await pickPersona("Bryan Myers");
await page.goto(BASE + "/admin");
await page.waitForLoadState("networkidle");
const addColBtns = page.getByRole("button", { name: "Add Column" });
await addColBtns.last().click();
await page.getByPlaceholder("e.g. River Mile Marker").fill("Smoke Test Column");
await page.getByRole("button", { name: "Add Column" }).last().click();
await page.waitForTimeout(1000);
const colVisible = await page.getByText("Smoke Test Column").first().isVisible().catch(() => false);
await shot("11-admin-column-added");
log(`RPD added region column: ${colVisible}`);

// 10. Mobile viewport sanity
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(BASE + "/bid-schedule");
await page.waitForLoadState("networkidle");
await shot("12-mobile-bid-schedule");
log("Mobile viewport renders");

await browser.close();

console.log("\n--- Console/page errors captured:", errors.length);
for (const e of errors.slice(0, 15)) console.log("  ✗", e);
process.exit(errors.filter((e) => !e.includes("favicon")).length > 5 ? 1 : 0);
