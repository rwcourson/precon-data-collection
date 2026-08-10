#!/usr/bin/env node
/**
 * Deterministic OpenAPI 3.1 generator for mobile v1 endpoints.
 * Scans route files for operation metadata comments and known paths.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mobileRoot = path.join(root, "src/app/api/v1/mobile");

const SCOPE_MAP = {
  me: ["profile:read"],
  overview: ["read:pursuits"],
  pursuits: ["write:pursuits"],
  jobs: ["read:pursuits"],
  rounds: ["read:pursuits", "write:pursuits"],
  sheets: ["read:sheets", "write:sheets"],
  dashboards: ["read:dashboards", "write:dashboards"],
  reports: ["read:reports"],
  admin: ["read:admin", "write:admin"],
  trash: ["read:trash", "write:trash"],
  notifications: ["read:notifications"],
  search: ["read:pursuits"],
  workspace: ["profile:read"],
  forecast: ["read:reports"],
  reconciliation: ["read:reports"],
  copilot: ["read:dashboards"],
  salesforce: ["integrate:connect"],
  bid: ["read:pursuits"],
};

function walk(dir, base = "") {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.join(base, entry.name);
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(abs, rel));
    else if (entry.name === "route.ts") out.push(rel);
  }
  return out;
}

function methodsOf(source) {
  const methods = [];
  for (const m of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
    if (new RegExp(`export async function ${m}\\b`).test(source)) methods.push(m);
  }
  return methods;
}

function operationId(method, routePath) {
  const cleaned = routePath
    .replace(/\[([^\]]+)\]/g, "By$1")
    .replace(/\//g, "_")
    .replace(/[^A-Za-z0-9_]/g, "");
  return `${method.toLowerCase()}_${cleaned}`;
}

function pathFromFile(rel) {
  const without = rel.replace(/\/route\.ts$/, "").replace(/\\/g, "/");
  return `/api/v1/mobile/${without}`
    .replace(/\/index$/, "")
    .replace(/\[([^\]]+)\]/g, "{$1}");
}

function topSegment(routePath) {
  return routePath.replace(/^\/api\/v1\/mobile\/?/, "").split("/")[0] || "me";
}

const paths = {};
for (const file of walk(mobileRoot).sort()) {
  const source = fs.readFileSync(path.join(mobileRoot, file), "utf8");
  const routePath = pathFromFile(file);
  const methods = methodsOf(source);
  if (methods.length === 0) continue;
  const segment = topSegment(routePath);
  const scopes = SCOPE_MAP[segment] ?? ["profile:read"];
  paths[routePath] ??= {};
  for (const method of methods) {
    paths[routePath][method.toLowerCase()] = {
      operationId: operationId(method, routePath),
      summary: `${method} ${routePath}`,
      security: [{ bearerAuth: scopes }],
      parameters:
        routePath.includes("{")
          ? [
              {
                name: routePath.match(/\{([^}]+)\}/)[1],
                in: "path",
                required: true,
                schema: { type: "string" },
              },
            ]
          : [],
      responses: {
        "200": {
          description: "Success",
          content: {
            "application/json": {
              schema: { type: "object", additionalProperties: true },
            },
          },
        },
        "401": { description: "Unauthorized" },
        "403": { description: "Forbidden" },
        "404": { description: "Not found" },
      },
    };
    if (method !== "GET") {
      paths[routePath][method.toLowerCase()].requestBody = {
        required: false,
        content: {
          "application/json": {
            schema: { type: "object", additionalProperties: true },
          },
        },
      };
    }
  }
}

const doc = {
  openapi: "3.1.0",
  info: {
    title: "B&G Precon Mobile API",
    version: "1.0.0",
    description: "Generated contract for Expo and Swift clients.",
  },
  servers: [{ url: "https://api.example.invalid" }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "API token",
        description: "Scoped expiring API token or demo session.",
      },
    },
  },
  paths,
};

const json = `${JSON.stringify(doc, null, 2)}\n`;
const outDir = path.join(root, "contracts");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "openapi.json");
fs.writeFileSync(outFile, json);
const hash = createHash("sha256").update(json).digest("hex");
fs.writeFileSync(path.join(outDir, "openapi.sha256"), `${hash}\n`);

// Expo client types stub generated from operation IDs
const ops = [];
for (const [p, methods] of Object.entries(paths)) {
  for (const [m, op] of Object.entries(methods)) {
    ops.push({ method: m.toUpperCase(), path: p, operationId: op.operationId, scopes: op.security[0].bearerAuth });
  }
}
const clientTs = `/* AUTO-GENERATED — do not edit. Run: node scripts/generate-openapi.mjs */
export type MobileOperation = {
  method: string;
  path: string;
  operationId: string;
  scopes: string[];
};

export const MOBILE_OPERATIONS: MobileOperation[] = ${JSON.stringify(ops, null, 2)} as const;

export type GeneratedMobileClient = {
  baseUrl: string;
  operations: typeof MOBILE_OPERATIONS;
};

export function createGeneratedMobileClient(baseUrl: string): GeneratedMobileClient {
  if (process.env.NODE_ENV === "production" && !baseUrl.startsWith("https://")) {
    throw new Error("Release builds require HTTPS API base URLs.");
  }
  return { baseUrl, operations: MOBILE_OPERATIONS };
}
`;
fs.mkdirSync(path.join(root, "apps/mobile/src/generated"), { recursive: true });
fs.writeFileSync(path.join(root, "apps/mobile/src/generated/mobile-api.ts"), clientTs);
fs.mkdirSync(path.join(root, "src/generated"), { recursive: true });
fs.writeFileSync(path.join(root, "src/generated/mobile-api.ts"), clientTs);

process.stdout.write(
  `OpenAPI generated: ${Object.keys(paths).length} paths, ${ops.length} operations, sha256=${hash.slice(0, 12)}…\n`,
);
