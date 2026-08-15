import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL;
assert.match(baseUrl ?? "", /^http:\/\/127\.0\.0\.1:\d+$/, "BASE_URL must target the isolated local server");

const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (error) => errors.push(`${page.url()} pageerror: ${error.message}`));
page.on("console", (message) => {
  const text = message.text();
  if (message.type() !== "error") return;
  if (/Failed to load resource:/.test(text)) return;
  errors.push(`${page.url()} console: ${text}`);
});
const report = (message) => process.stdout.write(`PASS ${message}\n`);

async function pickPersona(name) {
  const trigger = page.locator('header [data-slot="dropdown-menu-trigger"]');
  await trigger.click();
  const item = page.getByRole("menuitem").filter({ hasText: name });
  await item.waitFor({ state: "visible" });
  await item.click();
  await trigger.getByText(name, { exact: true }).waitFor({ state: "visible" });
}

try {
  await page.goto(`${baseUrl}/post-bid`);
  await page.waitForLoadState("networkidle");
  await pickPersona("Brian Meyers");
  await page.goto(`${baseUrl}/post-bid`);
  await page.waitForLoadState("networkidle");

  const rows = await page.$$eval("table tbody tr", (elements) =>
    elements
      .map((row) => {
        const link = row.querySelector("td a");
        return link
          ? {
              href: link.getAttribute("href"),
              progress: row.querySelector("td:nth-child(6)")?.textContent ?? "",
              status: row.querySelector("td:nth-child(7)")?.textContent ?? "",
            }
          : null;
      })
      .filter(Boolean),
  );
  const postBidRows = rows.filter((row) => row.status.includes("Post-Bid"));
  const incomplete = postBidRows.find((row) => {
    const progress = row.progress.match(/(\d+)\/(\d+)/);
    return progress && Number(progress[1]) < Number(progress[2]);
  });
  const complete = postBidRows.find((row) => {
    const progress = row.progress.match(/(\d+)\/(\d+)/);
    return progress && Number(progress[1]) === Number(progress[2]);
  });
  assert.ok(incomplete?.href, "Seeded post-bid queue must include an incomplete round");
  assert.ok(complete?.href, "Seeded post-bid queue must include a complete round");

  await page.goto(`${baseUrl}${incomplete.href}`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /Approve/ }).click();
  const blockedToast = page.locator("[data-sonner-toast]").last();
  await blockedToast.waitFor({ state: "visible" });
  assert.match((await blockedToast.textContent()) ?? "", /Cannot lock/);
  report("incomplete approval is blocked");

  await page.goto(`${baseUrl}${complete.href}`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /Approve/ }).click();
  await page.getByText(/RPD \/ SPD Approved \/ Locked/).first().waitFor({ state: "visible" });
  report("complete approval locks the round");

  const estimateValue = page
    .locator("div.space-y-1", { has: page.getByText("Estimate Value $") })
    .locator("input")
    .first();
  const current = await estimateValue.inputValue();
  await estimateValue.fill(String(Number(current || "1000000") + 5000));
  await page.getByRole("button", { name: /Save Correction/ }).click();
  await page.locator("[data-sonner-toast]").last().waitFor({ state: "visible" });
  await page.getByRole("tab", { name: /History/ }).click();
  await page.getByText("Post-lock audit log").waitFor({ state: "visible" });
  report("post-lock correction creates visible audit history");

  await pickPersona("Marcus Webb");
  await page.goto(`${baseUrl}${complete.href}`);
  await page.waitForLoadState("networkidle");
  assert.equal(await page.getByRole("button", { name: /Save/ }).count(), 0);
  report("estimate lead cannot edit the locked round");

  assert.deepEqual(errors, [], `Browser errors detected:\n${errors.join("\n")}`);
} finally {
  await browser.close();
}
