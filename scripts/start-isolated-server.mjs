import http from "node:http";
import path from "node:path";
import next from "next";

if (process.env.NODE_ENV !== "production") {
  process.stderr.write("The isolated production server requires NODE_ENV=production.\n");
  process.exit(1);
}
if (process.env.APP_ENV !== "demo" || process.env.DATABASE_MODE !== "pglite") {
  process.stderr.write("The isolated server requires explicit demo PGlite configuration.\n");
  process.exit(1);
}

const isolatedProject = process.env.E2E_PROJECT_DIR;
if (!isolatedProject || !path.isAbsolute(isolatedProject)) {
  process.stderr.write("The isolated server requires an absolute sanitized project directory.\n");
  process.exit(1);
}
const databaseDir = process.env.PGLITE_DATA_DIR;
if (
  !databaseDir ||
  !path.isAbsolute(databaseDir) ||
  !path.resolve(databaseDir).startsWith(`${path.resolve(isolatedProject)}${path.sep}`)
) {
  process.stderr.write("The isolated server requires a database inside its sanitized project directory.\n");
  process.exit(1);
}
const app = next({ dev: false, dir: isolatedProject, customServer: true });
const handler = app.getRequestHandler();
await app.prepare();

const server = http.createServer((request, response) => handler(request, response));
server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  if (!address || typeof address === "string") {
    process.stderr.write("Unable to resolve the isolated server address.\n");
    process.exit(1);
  }
  process.stdout.write(`ISOLATED_SERVER_READY http://127.0.0.1:${address.port}\n`);
});

async function shutdown() {
  await new Promise((resolve) => server.close(resolve));
  if (typeof app.close === "function") await app.close();
  process.exit(0);
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
