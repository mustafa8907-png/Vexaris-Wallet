import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSettingsStore, type Theme } from "@/stores/settingsStore";

export type KitTheme = "dark" | "light";
export type ThemeMode = Theme;

type ThemeContextValue = {
  theme: KitTheme;
  themeMode: ThemeMode;
  setTheme: (theme: KitTheme) => void;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  radius: number;
  setRadius: (radius: number) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): KitTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function syncThemeColor(theme: KitTheme) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#0b0b0c" : "#f4f4f6");
}

type ProviderProps = {
  children: ReactNode;
};

export function ThemeProvider({ children }: ProviderProps) {
  const themeMode = useSettingsStore((s) => s.theme);
  const storeSetTheme = useSettingsStore((s) => s.setTheme);
  const radius = useSettingsStore((s) => s.radius);
  const storeSetRadius = useSettingsStore((s) => s.setRadius);
  const [systemTheme, setSystemTheme] = useState<KitTheme>(() => getSystemTheme());

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? "dark" : "light");
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const theme: KitTheme = themeMode === "system" ? systemTheme : themeMode;

  const flash = useCallback((cls: string, ms = 220) => {
    const root = document.documentElement;
    root.classList.add(cls);
    window.setTimeout(() => root.classList.remove(cls), ms);
  }, []);

  const setThemeMode = useCallback(
    (next: ThemeMode) => {
      if (useSettingsStore.getState().theme !== next) {
        flash("theming");
        storeSetTheme(next);
      }
    },
    [flash, storeSetTheme],
  );

  const setTheme = useCallback(
    (next: KitTheme) => {
      setThemeMode(next);
    },
    [setThemeMode],
  );

  const toggleTheme = useCallback(
    () => setThemeMode(theme === "dark" ? "light" : "dark"),
    [setThemeMode, theme],
  );

  const setRadius = useCallback(
    (next: number) => {
      storeSetRadius(next);
      flash("morphing", 200);
    },
    [flash, storeSetRadius],
  );

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
    syncThemeColor(theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty("--r", `${radius}px`);
  }, [radius]);

  const value = useMemo(
    () => ({ theme, themeMode, setTheme, setThemeMode, toggleTheme, radius, setRadius }),
    [theme, themeMode, setTheme, setThemeMode, toggleTheme, radius, setRadius],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme, ThemeProvider içinde kullanılmalıdır.");
  return ctx;
}
