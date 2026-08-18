import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";

const repoRoot = path.resolve(import.meta.dirname, "..");
if (!fs.existsSync(path.join(repoRoot, ".next", "BUILD_ID"))) {
  process.stderr.write(
    "Isolated smoke requires a completed production build.\n"
  );
  process.exit(1);
}

const retainedEnvironment = [
  "HOME",
  "LANG",
  "LC_ALL",
  "PATH",
  "SHELL",
  "TMPDIR",
  "USER",
];
const env = Object.fromEntries(
  retainedEnvironment
    .filter((key) => process.env[key] != null)
    .map((key) => [key, process.env[key]])
);
const isolatedProject = fs.mkdtempSync(
  path.join(os.tmpdir(), "precon-e2e-project-")
);
const databaseDir = path.join(isolatedProject, "database");
for (const entry of [
  ".next",
  "node_modules",
  "public",
  "package.json",
  "next.config.ts",
]) {
  const source = path.join(repoRoot, entry);
  const target = path.join(isolatedProject, entry);
  fs.symlinkSync(
    source,
    target,
    fs.statSync(source).isDirectory() ? "dir" : "file"
  );
}
if (fs.readdirSync(isolatedProject).some((entry) => entry.startsWith(".env"))) {
  throw new Error(
    "The sanitized E2E project unexpectedly contains an environment file."
  );
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

process.stdout.write(`Smoke database: isolated PGlite at ${databaseDir}\n`);
process.stdout.write(`Smoke project directory: ${isolatedProject}\n`);
process.stdout.write(
  "Smoke environment files: none (sanitized project root)\n"
);

await new Promise((resolve, reject) => {
  const bootstrap = spawn(
    path.join(repoRoot, "node_modules", ".bin", "tsx"),
    ["src/db/bootstrap-demo.ts"],
    {
      cwd: repoRoot,
      env,
      stdio: "inherit",
    }
  );
  bootstrap.once("exit", (code) => {
    if (code === 0) resolve();
    else
      reject(
        new Error(`Isolated database bootstrap failed with code ${code}.`)
      );
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
  const timeout = setTimeout(
    () => reject(new Error("Isolated server startup timed out.")),
    60_000
  );
  lines.on("line", (line) => {
    process.stdout.write(`${line}\n`);
    const match = /^ISOLATED_SERVER_READY (http:\/\/127\.0\.0\.1:\d+)$/.exec(
      line
    );
    if (match && !readyUrl) {
      readyUrl = match[1];
      clearTimeout(timeout);
      resolve();
    }
  });
  server.once("exit", (code) => {
    if (!readyUrl) {
      clearTimeout(timeout);
      reject(
        new Error(`Isolated server exited before readiness (code ${code}).`)
      );
    }
  });
});

function runFlow(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      cwd: repoRoot,
      env: { ...env, BASE_URL: readyUrl },
      stdio: "inherit",
    });
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} failed with code ${code}.`));
    });
  });
}

try {
  await ready;
  const liveResponse = await fetch(`${readyUrl}/api/health/live`);
  const readyResponse = await fetch(`${readyUrl}/api/health/ready`);
  const readyBody = await readyResponse.text();
  if (!liveResponse.ok || !readyResponse.ok) {
    throw new Error(
      `Health checks failed (live=${liveResponse.status}, ready=${readyResponse.status}).`
    );
  }
  if (/token|secret|password|postgres(?:ql)?:\/\//i.test(readyBody)) {
    throw new Error("Readiness response exposed a sensitive field or value.");
  }
  process.stdout.write(
    `Readiness healthy response: ${readyResponse.status} ${readyBody}\n`
  );
  await runFlow("scripts/smoke.mjs");
  await runFlow("scripts/verify-approval.mjs");
} finally {
  lines.close();
  if (server.exitCode == null) {
    server.kill("SIGTERM");
    await new Promise((resolve) => server.once("exit", resolve));
  }
  const tempRoot = path.resolve(os.tmpdir()) + path.sep;
  const resolvedProject = path.resolve(isolatedProject);
  const projectStat = fs.lstatSync(resolvedProject);
  if (!resolvedProject.startsWith(tempRoot) || projectStat.isSymbolicLink()) {
    process.stderr.write(
      "Refusing to clean an invalid isolated project directory.\n"
    );
  } else {
    fs.rmSync(resolvedProject, { recursive: true });
  }
}

process.stdout.write("Isolated smoke flows: passed\n");
