import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = path.dirname(fileURLToPath(import.meta.url));

describe("sign-in compile isolation", () => {
  it("does not import Better Auth server or the Drizzle identity seam", () => {
    const source = readFileSync(path.join(dir, "page.tsx"), "utf8");
    expect(source).not.toMatch("@/lib/auth-server");
    expect(source).not.toMatch('@/lib/auth"');
    expect(source).not.toMatch("@/db");
  });

  it("does not bounce to the app on cookie presence alone", () => {
    const source = readFileSync(path.join(dir, "page.tsx"), "utf8");
    expect(source).not.toMatch("cookiesLookLikeBetterAuthSession");
    expect(source).not.toMatch("redirect(");
  });
});
