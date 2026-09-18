"use client";

import * as React from "react";

export type Theme = "light" | "dark" | "system";

export interface ThemeProviderProps {
  children: React.ReactNode;
  attribute?: "class" | `data-${string}` | Array<"class" | `data-${string}`>;
  defaultTheme?: Theme;
  enableSystem?: boolean;
  storageKey?: string;
  themes?: Theme[];
  forcedTheme?: Theme;
  value?: Record<string, string>;
}

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: React.Dispatch<React.SetStateAction<Theme>>;
  themes: Theme[];
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(
  undefined,
);

function getSystemTheme() {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(
  theme: string,
  attribute: ThemeProviderProps["attribute"],
  value?: Record<string, string>,
) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  const themeValue = value?.[theme] ?? theme;

  if (Array.isArray(attribute)) {
    attribute.forEach((attr) => {
      if (attr === "class") {
        html.classList.remove("light", "dark");
        html.classList.add(themeValue);
      } else {
        html.setAttribute(attr, themeValue);
      }
    });
  } else if (attribute === "class") {
    html.classList.remove("light", "dark");
    html.classList.add(themeValue);
  } else {
    html.setAttribute(attribute ?? "class", themeValue);
  }
}

export function ThemeProvider({
  children,
  attribute = "class",
  defaultTheme = "light",
  enableSystem = false,
  storageKey = "theme",
  themes = ["light", "dark", "system"],
  forcedTheme,
  value,
}: ThemeProviderProps) {
  const [theme, setTheme] = React.useState<Theme>(defaultTheme);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const persistedTheme = window.localStorage.getItem(
      storageKey,
    ) as Theme | null;
    const initialTheme = persistedTheme ?? defaultTheme;
    setTheme(initialTheme);
    setMounted(true);
  }, [defaultTheme, storageKey]);

  React.useEffect(() => {
    if (!mounted) return;
    const activeTheme = forcedTheme ?? theme;
    const effectiveTheme =
      activeTheme === "system" && enableSystem ? getSystemTheme() : activeTheme;

    if (typeof window !== "undefined") {
      if (storageKey && activeTheme !== "system") {
        window.localStorage.setItem(storageKey, activeTheme);
      }
    }

    applyTheme(effectiveTheme, attribute, value);
  }, [mounted, theme, forcedTheme, enableSystem, attribute, storageKey, value]);

  const resolvedTheme =
    theme === "system" && enableSystem
      ? getSystemTheme()
      : (theme as "light" | "dark");

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, themes }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) {
    return {
      theme: "light" as Theme,
      resolvedTheme: "light" as "light" | "dark",
      setTheme: () => {},
      themes: ["light", "dark", "system"] as Theme[],
    };
  }
  return context;
}
