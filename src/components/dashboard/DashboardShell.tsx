"use client";

import { createContext, useContext, useEffect, useState } from "react";

import { Sidebar } from "@/components/dashboard/Sidebar";
import { RestaurantTopBar } from "@/components/dashboard/TopBar";

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
  const [theme, setTheme] = useState<DashboardTheme>("light");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_KEY);
      if (stored === "light" || stored === "dark") setTheme(stored);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("kds-theme");
    if (theme === "dark") root.classList.add("kds-dark");
    else root.classList.remove("kds-dark");
    return () => {
      root.classList.remove("kds-theme", "kds-dark");
    };
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <DashboardThemeContext.Provider value={theme}>
      <div
        suppressHydrationWarning
        className={`kds-theme${theme === "dark" ? " kds-dark" : ""}`}
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg)",
          color: "var(--ink)",
          transition: "background .2s ease, color .2s ease",
        }}
      >
        <RestaurantTopBar theme={theme} onToggleTheme={toggleTheme} />
        <div className="flex flex-1 flex-col md:flex-row">
          <Sidebar restaurantId={restaurantId} />
          <main className="flex-1 overflow-y-auto p-5 md:p-7">{children}</main>
        </div>
      </div>
    </DashboardThemeContext.Provider>
  );
}
