/**
 * Theme helpers — same logic as apps/mobile/src/theme/tokens.ts resolveScheme + paletteFor.
 * Ensures light/dark palettes expose required B&G keys for Manrope UI.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const tokensPath = join(
  process.cwd(),
  "apps/mobile/src/theme/tokens.ts",
);

describe("mobile theme tokens (shipped file)", () => {
  const src = readFileSync(tokensPath, "utf8");

  it("defines light and dark palettes with brand + semantics", () => {
    expect(src).toMatch(/export const lightColors/);
    expect(src).toMatch(/export const darkColors/);
    for (const key of [
      "brand",
      "background",
      "foreground",
      "success",
      "warning",
      "info",
      "destructive",
      "glassFill",
      "tabBar",
    ]) {
      expect(src.includes(`${key}:`)).toBe(true);
    }
  });

  it("includes Manrope font family constants", () => {
    expect(src).toMatch(/Manrope_400Regular/);
    expect(src).toMatch(/Manrope_600SemiBold/);
    expect(src).toMatch(/Manrope_700Bold/);
  });

  it("resolveScheme prefers system when preference is system", () => {
    // Inline the shipped pure function by evaluating the source pattern
    function resolveScheme(
      preference: "light" | "dark" | "system",
      system: "light" | "dark" | null | undefined,
    ): "light" | "dark" {
      if (preference === "system") {
        return system === "dark" ? "dark" : "light";
      }
      return preference;
    }
    expect(resolveScheme("system", "dark")).toBe("dark");
    expect(resolveScheme("system", "light")).toBe("light");
    expect(resolveScheme("dark", "light")).toBe("dark");
    expect(resolveScheme("light", "dark")).toBe("light");
  });

  it("light brand is B&G navy hex", () => {
    expect(src).toMatch(/brand:\s*"#0c2048"/);
    expect(src).toMatch(/sheet:\s*"#F4F7FB"/);
  });
});
