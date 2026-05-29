"use client";

import { AccountMenu } from "@/components/ui/AccountMenu";
import { Select } from "@/components/ui/Select";
import { useRestaurant } from "@/contexts/RestaurantContext";

function initials(name?: string | null): string {
  if (!name) return "R";
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "R"
  );
}

// Shared Neon Diner topbar: brand mark + optional left content, live pill +
// account menu on the right.
export function TopBar({
  mark = "R",
  left,
}: {
  mark?: string;
  left?: React.ReactNode;
}) {
  return (
    <header className="topbar sticky top-0 z-20">
      <div className="row" style={{ gap: 16 }}>
        <div className="topbar-brand">
          <div className="brand-mark">{mark}</div>
          {left}
        </div>
      </div>
      <div className="row" style={{ gap: 10 }}>
        <span className="pill">
          <span className="dot dot-ready" />
          Live
        </span>
        <span className="pill hidden sm:inline-flex">⌘K · ค้นหา</span>
        <AccountMenu dark />
      </div>
    </header>
  );
}

// Per-restaurant topbar: restaurant name + branch picker on the left.
export function RestaurantTopBar() {
  const { restaurantName, branches, branchId, setBranch } = useRestaurant();
  return (
    <TopBar
      mark={initials(restaurantName)}
      left={
        <>
          <div>
            <div>{restaurantName ?? "…"}</div>
            <div
              style={{
                fontSize: 10,
                color: "var(--text-3)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Admin
            </div>
          </div>
          {branches.length > 0 && (
            <Select
              dark
              className="min-w-[9rem]"
              options={branches.map((b) => ({ id: b.id, label: b.name }))}
              selectedKey={branchId}
              onSelectionChange={(k) => k && setBranch(k)}
            />
          )}
        </>
      }
    />
  );
}
