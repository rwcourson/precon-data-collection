import { describe, expect, it } from "vitest";
import {
  darkColors,
  fonts,
  lightColors,
  paletteFor,
  resolveScheme,
} from "../../apps/mobile/src/theme/tokens";

describe("mobile theme tokens", () => {
  it("defines light and dark palettes with brand + semantics", () => {
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
      expect(lightColors).toHaveProperty(key);
      expect(darkColors).toHaveProperty(key);
    }
  });

  it("includes Manrope font family constants", () => {
    expect(fonts.regular).toBe("Manrope_400Regular");
    expect(fonts.semiBold).toBe("Manrope_600SemiBold");
    expect(fonts.bold).toBe("Manrope_700Bold");
  });

  it("resolveScheme prefers system when preference is system", () => {
    expect(resolveScheme("system", "dark")).toBe("dark");
    expect(resolveScheme("system", "light")).toBe("light");
    expect(resolveScheme("dark", "light")).toBe("dark");
    expect(resolveScheme("light", "dark")).toBe("light");
  });

  it("light brand is B&G navy hex", () => {
    expect(lightColors.brand).toBe("#0c2048");
    expect(lightColors.sheet).toBe("#f4f4f5");
    expect(paletteFor("light")).toBe(lightColors);
    expect(paletteFor("dark")).toBe(darkColors);
  });
});
