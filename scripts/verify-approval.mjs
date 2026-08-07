/* Focused verification of the RPD approve/lock validation + audit flow. */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const log = (s) => console.log(`✓ ${s}`);

async function pickPersona(name) {
  await page.locator("header").getByRole("button").last().click();
  await page.getByRole("menuitem").filter({ hasText: name }).click();
  await page.waitForTimeout(800);
}

await page.goto(BASE + "/post-bid");
await page.waitForLoadState("networkidle");
await pickPersona("Bryan Myers");
await page.goto(BASE + "/post-bid");
await page.waitForLoadState("networkidle");

// Collect queue rows: href + completion text
const rows = await page.$$eval("table tbody tr", (trs) =>
  trs
    .map((tr) => {
      const a = tr.querySelector("td a");
      const prog = tr.querySelector("td:nth-child(6)")?.textContent ?? "";
      const status = tr.querySelector("td:nth-child(7)")?.textContent ?? "";
      return a ? { href: a.getAttribute("href"), prog, status } : null;
    })
    .filter(Boolean),
);
const postBidRows = rows.filter((r) => r.status.includes("Post-Bid"));
const incomplete = postBidRows.find((r) => {
  const m = r.prog.match(/(\d+)\/(\d+)/);
  return m && Number(m[1]) < Number(m[2]);
});
const complete = postBidRows.find((r) => {
  const m = r.prog.match(/(\d+)\/(\d+)/);
  return m && Number(m[1]) === Number(m[2]);
});
console.log(`Queue: ${rows.length} rows, ${postBidRows.length} in post-bid, incomplete=${incomplete?.href}, complete=${complete?.href}`);

// 1. Approving an incomplete record must be blocked
if (incomplete) {
  await page.goto(BASE + incomplete.href);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /Approve/ }).click();
  await page.waitForTimeout(1500);
  const toast = await page.locator("[data-sonner-toast]").textContent();
  if (toast?.includes("Cannot lock")) log(`Incomplete record BLOCKED with: "${toast.slice(0, 110)}…"`);
  else throw new Error(`Expected block toast, got: ${toast}`);
  await page.screenshot({ path: ".smoke-shots/20-approve-blocked.png" });
}

// 2. Approving a complete record must lock it
if (complete) {
  await page.goto(BASE + complete.href);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /Approve/ }).click();
  await page.waitForTimeout(1500);
  const locked = await page.getByText("RPD Approved / Locked").first().isVisible();
  log(`Complete record locked: ${locked}`);
  await page.screenshot({ path: ".smoke-shots/21-approved-locked.png" });

  // 3. Post-lock correction as RPD → audit entry
  const evField = page
    .locator("div.space-y-1", { has: page.getByText("Estimate Value $") })
    .locator("input")
    .first();
  const current = await evField.inputValue();
  await evField.fill(String(Number(current || "1000000") + 5000));
  await page.getByRole("button", { name: /Save Correction/ }).click();
  await page.waitForTimeout(1500);
  const toast2 = await page.locator("[data-sonner-toast]").last().textContent();
  log(`Post-lock save toast: "${toast2}"`);

  // Check audit tab
  await page.getByRole("tab", { name: /History/ }).click();
  await page.waitForTimeout(500);
  const auditVisible = await page.getByText("Post-lock audit log").isVisible().catch(() => false);
  log(`Audit log visible on round: ${auditVisible}`);
  await page.screenshot({ path: ".smoke-shots/22-audit-trail.png" });
}

// 4. Estimate Lead cannot edit a locked round
if (complete) {
  await pickPersona("Marcus Webb");
  await page.goto(BASE + complete.href);
  await page.waitForLoadState("networkidle");
  const saveBtn = await page.getByRole("button", { name: /Save/ }).count();
  log(`Estimate Lead sees no save button on locked round: ${saveBtn === 0}`);
}

await browser.close();
console.log("Approval flow verification complete.");
