import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const srcRoot = path.join(root, "src");

const SKIP = new Set(["type-scale.contract.test.ts"]);

const FORBIDDEN = [
  "text-2xs",
  "text-[11px]",
  "text-[13px]",
  "text-lg",
  "text-2xl",
];

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walk(full, acc);
    } else if (/\.(ts|tsx|css)$/.test(name)) {
      acc.push(full);
    }
  }
  return acc;
}

describe("type scale", () => {
  it("stays on xs / sm / base / xl with a 12px floor", () => {
    const hits: string[] = [];
    for (const file of walk(srcRoot)) {
      const text = readFileSync(file, "utf8");
      for (const token of FORBIDDEN) {
        if (text.includes(token)) {
          hits.push(`${path.relative(root, file)}: ${token}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
