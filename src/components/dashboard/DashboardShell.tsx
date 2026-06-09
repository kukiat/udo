"use client";

import { createContext, useContext, useEffect, useState } from "react";

import { Sidebar } from "@/components/dashboard/Sidebar";
import { RestaurantTopBar } from "@/components/dashboard/TopBar";
import { readThemePreference, writeThemePreference } from "@/lib/theme";

const THEME_KEY = "rms.dashboard.theme";

type DashboardTheme = "light" | "dark";
const DashboardThemeContext = createContext<DashboardTheme>("light");

export const useDashboardTheme = () => useContext(DashboardThemeContext);

export function DashboardShell({
  restaurantId,
  children,
}: {
  restaurantId: string;
  children: React.ReactNode;
}) {
  const [theme, setTheme] = useState<DashboardTheme>(() =>
    readThemePreference(THEME_KEY),
  );

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("kds-theme");
    if (theme === "dark") root.classList.add("kds-dark");
    else root.classList.remove("kds-dark");
    root.style.colorScheme = theme;
    return () => {
      root.classList.remove("kds-theme", "kds-dark");
      root.style.removeProperty("color-scheme");
    };
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      writeThemePreference(THEME_KEY, next);
      return next;
    });
  };

  return (
    <DashboardThemeContext.Provider value={theme}>
      <div
        suppressHydrationWarning
        className={`kds-theme${theme === "dark" ? " kds-dark" : ""}`}
        style={{
          height: "100vh",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "var(--bg)",
          color: "var(--ink)",
          transition: "background .2s ease, color .2s ease",
        }}
      >
        <RestaurantTopBar theme={theme} onToggleTheme={toggleTheme} />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
          <Sidebar restaurantId={restaurantId} />
          <main className="min-w-0 flex-1 overflow-y-auto p-5 md:p-7">
            {children}
          </main>
        </div>
      </div>
    </DashboardThemeContext.Provider>
  );
}
