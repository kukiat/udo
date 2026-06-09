export type ThemePreference = "light" | "dark";

export function readThemePreference(
  key: string,
  fallback: ThemePreference = "light",
): ThemePreference {
  if (typeof window === "undefined") return fallback;

  try {
    const stored = window.localStorage.getItem(key);
    return stored === "light" || stored === "dark" ? stored : fallback;
  } catch {
    return fallback;
  }
}

export function writeThemePreference(key: string, value: ThemePreference) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}
