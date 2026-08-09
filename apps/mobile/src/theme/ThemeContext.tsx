import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useColorScheme as useSystemColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  darkColors,
  lightColors,
  paletteFor,
  resolveScheme,
  type ColorSchemeName,
  type ThemeColors,
} from "./tokens";

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "precon-mobile-theme";

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: ColorSchemeName;
  colors: ThemeColors;
  isDark: boolean;
  setPreference: (p: ThemePreference) => void;
  cyclePreference: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemRaw = useSystemColorScheme();
  const system: ColorSchemeName | null =
    systemRaw === "dark" ? "dark" : systemRaw === "light" ? "light" : null;
  const forced = process.env.EXPO_PUBLIC_FORCE_THEME;
  const initialPref: ThemePreference =
    forced === "dark" || forced === "light" || forced === "system" ? forced : "system";
  const [preference, setPreferenceState] = useState<ThemePreference>(initialPref);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // EXPO_PUBLIC_FORCE_THEME wins over persisted preference (dev screenshots).
        if (
          process.env.EXPO_PUBLIC_FORCE_THEME === "dark" ||
          process.env.EXPO_PUBLIC_FORCE_THEME === "light" ||
          process.env.EXPO_PUBLIC_FORCE_THEME === "system"
        ) {
          setPreferenceState(process.env.EXPO_PUBLIC_FORCE_THEME);
          return;
        }
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === "light" || stored === "dark" || stored === "system") {
          setPreferenceState(stored);
        }
      } catch {
        /* ignore */
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    void AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {});
  }, []);

  const cyclePreference = useCallback(() => {
    setPreference(
      preference === "system" ? "light" : preference === "light" ? "dark" : "system",
    );
  }, [preference, setPreference]);

  const resolved = resolveScheme(preference, system);
  const colors = paletteFor(resolved);

  const value = useMemo(
    () => ({
      preference,
      resolved,
      colors,
      isDark: resolved === "dark",
      setPreference,
      cyclePreference,
    }),
    [preference, resolved, colors, setPreference, cyclePreference],
  );

  // Avoid flash of wrong theme after storage loads
  if (!ready) {
    return (
      <ThemeContext.Provider
        value={{
          preference: "system",
          resolved: system === "dark" ? "dark" : "light",
          colors: system === "dark" ? darkColors : lightColors,
          isDark: system === "dark",
          setPreference,
          cyclePreference,
        }}
      >
        {children}
      </ThemeContext.Provider>
    );
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Safe fallback for tests / stray renders outside provider
    return {
      preference: "light",
      resolved: "light",
      colors: lightColors,
      isDark: false,
      setPreference: () => {},
      cyclePreference: () => {},
    };
  }
  return ctx;
}
