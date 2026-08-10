import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";

const repoRoot = path.resolve(import.meta.dirname, "..");
if (!fs.existsSync(path.join(repoRoot, ".next", "BUILD_ID"))) {
  process.stderr.write("Isolated UI audit requires a completed production build.\n");
  process.exit(1);
}

const retainedEnvironment = ["HOME", "LANG", "LC_ALL", "PATH", "SHELL", "TMPDIR", "USER"];
const env = Object.fromEntries(
  retainedEnvironment
    .filter((key) => process.env[key] != null)
    .map((key) => [key, process.env[key]]),
);
const isolatedProject = fs.mkdtempSync(path.join(os.tmpdir(), "precon-ui-audit-"));
const databaseDir = path.join(isolatedProject, "database");
for (const entry of [".next", "node_modules", "public", "package.json", "next.config.ts"]) {
  const source = path.join(repoRoot, entry);
  const target = path.join(isolatedProject, entry);
  fs.symlinkSync(source, target, fs.statSync(source).isDirectory() ? "dir" : "file");
}

Object.assign(env, {
  ALLOWED_ORIGINS: "http://127.0.0.1",
  API_TOKEN_MAX_TTL_DAYS: "90",
  APP_ENV: "demo",
  APP_ORIGIN: "http://127.0.0.1",
  AUTH_MODE: "demo",
  CONNECT_MODE: "mock",
  DATABASE_MODE: "pglite",
  DATABRICKS_MODE: "disabled",
  EMAIL_MODE: "stub",
  E2E_PROJECT_DIR: isolatedProject,
  NODE_ENV: "production",
  NEXT_TELEMETRY_DISABLED: "1",
  PGLITE_DATA_DIR: databaseDir,
  PRIVATE_STORAGE_MODE: "local",
  SMARTSHEET_MODE: "disabled",
});

await new Promise((resolve, reject) => {
  const bootstrap = spawn(path.join(repoRoot, "node_modules", ".bin", "tsx"), ["src/db/bootstrap-demo.ts"], {
    cwd: repoRoot,
    env,
    stdio: "inherit",
  });
  bootstrap.once("exit", (code) => {
    if (code === 0) resolve();
    else reject(new Error(`Isolated database bootstrap failed with code ${code}.`));
  });
});

const server = spawn(process.execPath, ["scripts/start-isolated-server.mjs"], {
  cwd: repoRoot,
  env,
  stdio: ["ignore", "pipe", "pipe"],
});
server.stderr.pipe(process.stderr);
const lines = readline.createInterface({ input: server.stdout });
let readyUrl;
const ready = new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error("Isolated server startup timed out.")), 60_000);
  lines.on("line", (line) => {
    process.stdout.write(`${line}\n`);
    const match = /^ISOLATED_SERVER_READY (http:\/\/127\.0\.0\.1:\d+)$/.exec(line);
    if (match && !readyUrl) {
      readyUrl = match[1];
      clearTimeout(timeout);
      resolve();
    }
  });
  server.once("exit", (code) => {
    if (!readyUrl) {
      clearTimeout(timeout);
      reject(new Error(`Isolated server exited before readiness (code ${code}).`));
    }
  });
});

try {
  await ready;
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/ui-audit.mjs"], {
      cwd: repoRoot,
      env: { ...env, BASE_URL: readyUrl, UI_AUDIT_SOFT: "1" },
      stdio: "inherit",
    });
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ui-audit failed with code ${code}`));
    });
  });
  process.stdout.write("Isolated UI audit: passed\n");
} finally {
  lines.close();
  if (server.exitCode == null) {
    server.kill("SIGTERM");
    await new Promise((resolve) => server.once("exit", resolve));
  }
  fs.rmSync(isolatedProject, { recursive: true, force: true });
}
