#!/usr/bin/env node
/**
 * Read-only Smartsheet pull → data/smartsheet/json
 * Usage: node --env-file=.env.local scripts/pull-smartsheet.mjs
 */
import fs from "node:fs";
import path from "node:path";

const API = "https://api.smartsheet.com/2.0";
const TOKEN = process.env.SMARTSHEET_ACCESS_TOKEN?.trim();
const DATA_DIR = path.join(process.cwd(), "data/smartsheet/json");
const PRECON_RE =
  /(precon|bid schedule|post.?bid|estimate metrics|estimate summary|cost tracking|self.?perform|dashboard)/i;

if (!TOKEN) {
  console.error("SMARTSHEET_ACCESS_TOKEN is required");
  process.exit(1);
}

async function ss(pathname) {
  const res = await fetch(`${API}${pathname}`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`Smartsheet ${res.status}: ${await res.text()}`);
  return res.json();
}

function safeFileName(name, id) {
  const base = name
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
  return `${base}__${id}.json`;
}

const me = await ss("/users/me");
console.log(`Token OK — ${me.email ?? me.firstName ?? "user"}`);

const list = await ss("/sheets?includeAll=true");
const all = list.data ?? [];
const matched = all.filter((s) => PRECON_RE.test(s.name));
console.log(
  `Listed ${all.length} sheets; matched ${matched.length} precon-like.`
);

fs.mkdirSync(DATA_DIR, { recursive: true });
const summary = [];
for (const item of matched) {
  process.stdout.write(`  GET ${item.id} ${item.name}… `);
  const sheet = await ss(`/sheets/${item.id}`);
  const file = path.join(DATA_DIR, safeFileName(item.name, item.id));
  fs.writeFileSync(file, JSON.stringify(sheet));
  summary.push({
    id: item.id,
    name: item.name,
    rows: sheet.rows?.length ?? 0,
    columns: sheet.columns?.length ?? 0,
    pulledAt: new Date().toISOString(),
  });
  console.log(`${sheet.rows?.length ?? 0} rows`);
}

const manifestPath = path.join(process.cwd(), "data/smartsheet/manifest.json");
fs.writeFileSync(manifestPath, JSON.stringify(summary, null, 2));
console.log(`Wrote ${summary.length} files → ${DATA_DIR}`);
console.log(`Manifest → ${manifestPath}`);
