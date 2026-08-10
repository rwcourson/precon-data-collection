import { spawnSync } from "node:child_process";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const mobileRoot = path.join(repoRoot, "apps", "mobile");
const expectedConfig = path.join(mobileRoot, "tsconfig.json");

const normal = spawnSync("npm", ["run", "typecheck"], {
  cwd: mobileRoot,
  encoding: "utf8",
  stdio: "pipe",
});

process.stdout.write(`Mobile typecheck cwd: ${mobileRoot}\n`);
process.stdout.write(`Mobile typecheck config: ${expectedConfig}\n`);
process.stdout.write(normal.stdout ?? "");
process.stderr.write(normal.stderr ?? "");
if (normal.status !== 0) process.exit(normal.status ?? 1);

const sentinel = spawnSync(
  "npm",
  ["run", "typecheck", "--", "--project", "tsconfig.verifier.json"],
  { cwd: mobileRoot, encoding: "utf8", stdio: "pipe" },
);
const sentinelOutput = `${sentinel.stdout ?? ""}${sentinel.stderr ?? ""}`;
if (sentinel.status === 0 || !sentinelOutput.includes("intentional-error.ts")) {
  process.stderr.write("Mobile typecheck sentinel was not rejected as expected.\n");
  process.stderr.write(sentinelOutput);
  process.exit(1);
}

process.stdout.write("Mobile typecheck sentinel: rejected as expected\n");
