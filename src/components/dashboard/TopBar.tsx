"use client";

import { AccountMenu } from "@/components/ui/AccountMenu";
import { Select } from "@/components/ui/Select";
import { useRestaurant } from "@/contexts/RestaurantContext";

// Shared topbar shell: optional left content, account menu pinned right.
export function TopBar({ left }: { left?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line bg-white px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-3">{left}</div>
      <AccountMenu />
    </header>
  );
}

// Topbar for the per-restaurant area: restaurant + branch picker on the left.
export function RestaurantTopBar() {
  const { restaurantName, branches, branchId, setBranch } = useRestaurant();
  return (
    <TopBar
      left={
        <>
          <span className="truncate text-sm font-semibold text-ink">
            {restaurantName ?? "…"}
          </span>
          <span aria-hidden className="h-5 w-px bg-line" />
          <Select
            className="min-w-[9rem]"
            options={branches.map((b) => ({ id: b.id, label: b.name }))}
            selectedKey={branchId}
            onSelectionChange={(k) => k && setBranch(k)}
            placeholder="No branches"
          />
        </>
      }
    />
  );
}
