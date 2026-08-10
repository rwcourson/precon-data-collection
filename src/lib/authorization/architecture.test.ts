import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  LEGACY_DIRECT_ID_LOADERS,
  LEGACY_POLICY_CALLERS,
} from "./legacy-inventory";

function sourceFiles(root: string): string[] {
  const output: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) output.push(...sourceFiles(absolute));
    else if (/\.(?:ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts")) {
      output.push(path.relative(process.cwd(), absolute));
    }
  }
  return output;
}

describe("authorization architecture boundary", () => {
  const files = sourceFiles(path.join(process.cwd(), "src"));

  it("prevents new legacy permission-helper callers", () => {
    const callers = files.filter((file) => {
      const source = fs.readFileSync(file, "utf8");
      const oldPolicyImport = /@\/lib\/(?:permissions|policy)/.test(source);
      const oldSheetPolicyImport =
        /(?:@\/lib\/sheets|from ["']\.\/sheets["'])/.test(source) &&
        /\b(?:canManageSheet|canEditRows|canCreateSheet)\b/.test(source);
      return oldPolicyImport || oldSheetPolicyImport;
    });
    expect(callers.sort()).toEqual([...LEGACY_POLICY_CALLERS].sort());
  });

  it("prevents new direct-by-ID database loaders outside the scoped-loader boundary", () => {
    const callers = files.filter((file) => {
      if (!/^(?:src\/app|src\/actions|src\/lib)\//.test(file)) return false;
      if (file.startsWith("src/lib/authorization/")) return false;
      if (file === "src/lib/api-safety.ts") return false;
      const source = fs.readFileSync(file, "utf8");
      return /\.where\(eq\([^,]+\.id/.test(source);
    });
    expect(callers.sort()).toEqual([...LEGACY_DIRECT_ID_LOADERS].sort());
  });

  it("keeps application services free of ambient transport identity", () => {
    const serviceFiles = files.filter((file) => file.startsWith("src/services/"));
    expect(serviceFiles.length).toBeGreaterThan(0);
    for (const file of serviceFiles) {
      const source = fs.readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/next\/(?:headers|navigation)|getCurrentUser|getWorkspace|mobileContext/);
      expect(source, file).toMatch(/Principal/);
    }
  });
});
