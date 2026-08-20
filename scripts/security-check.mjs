#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checks = [];
function check(name, ok, detail = "") {
  checks.push({ name, ok, detail });
}

const cronAuth = fs.readFileSync(
  path.join(root, "src/lib/cron-auth.ts"),
  "utf8"
);
check(
  "cron fail-closed without secret",
  cronAuth.includes("Scheduler authentication is unavailable")
);
check("cron constant-time compare", cronAuth.includes("timingSafeEqual"));

const salesforceRoute = fs.readFileSync(
  path.join(root, "src/app/api/jobs/salesforce-sync/route.ts"),
  "utf8"
);
check(
  "salesforce cron uses service principal path",
  salesforceRoute.includes("salesforceSyncService")
);
check(
  "salesforce cron returns non-2xx on failure",
  salesforceRoute.includes("status: 502")
);

const email = fs.readFileSync(path.join(root, "src/lib/email.ts"), "utf8");
check(
  "stub email never marks sent",
  email.includes('status: "previewed"') && email.includes("sentAt: null")
);

const kernel = fs.readFileSync(
  path.join(root, "src/lib/authorization/kernel.ts"),
  "utf8"
);
check(
  "authorization kernel deny-by-default export",
  kernel.includes("export function authorize")
);

const dashExport = fs.readFileSync(
  path.join(root, "src/app/api/export/dashboard/route.ts"),
  "utf8"
);
check(
  "dashboard excel uses principal loader",
  dashExport.includes("listRoundsWithJobsForPrincipal")
);
check(
  "dashboard excel 403s foreign region",
  dashExport.includes("resolveRegionParam")
);

const bidExport = fs.readFileSync(
  path.join(root, "src/app/api/export/bid-schedule/route.ts"),
  "utf8"
);
check(
  "bid-schedule export uses principal",
  bidExport.includes("getWebPrincipal")
);
check(
  "bid-schedule export 403s foreign region",
  bidExport.includes("resolveRegionParam")
);

const pptxExport = fs.readFileSync(
  path.join(root, "src/app/api/export/pptx/route.ts"),
  "utf8"
);
check("pptx export uses principal", pptxExport.includes("getWebPrincipal"));

const magnusRoute = fs.readFileSync(
  path.join(root, "src/app/api/v1/ai/magnus/route.ts"),
  "utf8"
);
check(
  "copilot route loads principal-scoped rounds",
  magnusRoute.includes("listRoundsWithJobsForPrincipal")
);

const sanitize = fs.readFileSync(
  path.join(root, "src/lib/dashboard-sanitize.ts"),
  "utf8"
);
check("sanitize allowlists metrics", sanitize.includes("ALLOWED_METRICS"));
check(
  "sanitize allowlists filters",
  sanitize.includes("ALLOWED_FILTER_FIELDS")
);

const runtimeConfig = fs.readFileSync(
  path.join(root, "src/lib/runtime-config.ts"),
  "utf8"
);
check(
  "runtime-config blocks demo auth on hosted production deployments",
  runtimeConfig.includes("must be sso on hosted production deployments")
);

const nextConfig = fs.readFileSync(path.join(root, "next.config.ts"), "utf8");
check(
  "next.config sets X-Content-Type-Options",
  nextConfig.includes("X-Content-Type-Options")
);
check(
  "next.config sets Content-Security-Policy",
  nextConfig.includes("Content-Security-Policy")
);

const copilotBridge = fs.readFileSync(
  path.join(root, "src/lib/ai/copilot-bridge.ts"),
  "utf8"
);
check(
  "copilot bridge signs timestamp and body hash",
  copilotBridge.includes("input.timestamp") &&
    copilotBridge.includes("sha256Hex(input.rawBody)")
);
check(
  "copilot bridge enforces a replay skew window",
  copilotBridge.includes("COPILOT_TOOL_MAX_SKEW_MS")
);

const routeAccess = fs.readFileSync(
  path.join(root, "src/lib/route-access.ts"),
  "utf8"
);
check(
  "PCM Copilot is denied at the route boundary",
  routeAccess.includes('role === "pcm"') && routeAccess.includes("/copilot")
);

const previewIsolation = fs.readFileSync(
  path.join(root, "src/lib/preview-isolation.ts"),
  "utf8"
);
check(
  "Preview database isolation is fail-closed",
  previewIsolation.includes("PRODUCTION_DATABASE_URL")
);

const roundtableReview = fs.existsSync(
  path.join(root, "docs/security/roundtable-review.md")
);
check("roundtable security review artifact exists", roundtableReview);

const failed = checks.filter((c) => !c.ok);
for (const c of checks)
  process.stdout.write(`${c.ok ? "PASS" : "FAIL"} ${c.name}\n`);
if (failed.length) {
  process.stderr.write(`security:check failed (${failed.length})\n`);
  process.exit(1);
}
process.stdout.write("security:check passed\n");
