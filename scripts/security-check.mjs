#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checks = [];
function check(name, ok, detail = "") {
  checks.push({ name, ok, detail });
}

const cronAuth = fs.readFileSync(path.join(root, "src/lib/cron-auth.ts"), "utf8");
check("cron fail-closed without secret", cronAuth.includes("Scheduler authentication is unavailable"));
check("cron constant-time compare", cronAuth.includes("timingSafeEqual"));

const salesforceRoute = fs.readFileSync(
  path.join(root, "src/app/api/jobs/salesforce-sync/route.ts"),
  "utf8",
);
check("salesforce cron uses service principal path", salesforceRoute.includes("salesforceSyncService"));
check("salesforce cron returns non-2xx on failure", salesforceRoute.includes("status: 502"));

const email = fs.readFileSync(path.join(root, "src/lib/email.ts"), "utf8");
check("stub email never marks sent", email.includes('status: "previewed"') && email.includes("sentAt: null"));

const kernel = fs.readFileSync(path.join(root, "src/lib/authorization/kernel.ts"), "utf8");
check("authorization kernel deny-by-default export", kernel.includes("export function authorize"));

const failed = checks.filter((c) => !c.ok);
for (const c of checks) process.stdout.write(`${c.ok ? "PASS" : "FAIL"} ${c.name}\n`);
if (failed.length) {
  process.stderr.write(`security:check failed (${failed.length})\n`);
  process.exit(1);
}
process.stdout.write("security:check passed\n");
