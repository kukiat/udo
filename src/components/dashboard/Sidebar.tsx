"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AccountMenu } from "@/components/ui/AccountMenu";
import { Select } from "@/components/ui/Select";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { cn } from "@/lib/cn";

export function Sidebar() {
  const pathname = usePathname();
  const { restaurantId, restaurantName, branches, branchId, setBranch } =
    useRestaurant();

  const base = `/dashboard/${restaurantId}`;
  const links = [
    { href: base, label: "Overview", exact: true },
    { href: `${base}/branches`, label: "Branches" },
    { href: `${base}/categories`, label: "Categories" },
    { href: `${base}/menu`, label: "Menu Items" },
    { href: `${base}/branch-menu`, label: "Branch Menu" },
    { href: `${base}/reports`, label: "Reports" },
  ];

  return (
    <aside className="flex w-full shrink-0 flex-col gap-1 border-b border-line bg-white p-4 md:sticky md:top-0 md:h-screen md:w-60 md:self-start md:border-b-0 md:border-r">
      <Link
        href="/dashboard"
        className="mb-2 px-1 text-xs text-ink-muted hover:text-ink"
      >
        ← All restaurants
      </Link>
      <div className="mb-4 px-1">
        <p className="text-sm font-semibold text-ink">
          {restaurantName ?? "…"}
        </p>
        <Select
          label="Branch"
          className="mt-2"
          options={branches.map((b) => ({ id: b.id, label: b.name }))}
          selectedKey={branchId}
          onSelectionChange={(k) => k && setBranch(k)}
          placeholder="No branches"
        />
      </div>
      <nav className="flex flex-wrap gap-1 md:flex-col md:flex-nowrap">
        {links.map((l) => {
          const active = l.exact
            ? pathname === l.href
            : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-clay-50 text-clay-700"
                  : "text-ink-soft hover:bg-sand",
              )}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto hidden border-t border-line pt-3 md:block">
        <AccountMenu className="w-full justify-start" />
      </div>
    </aside>
  );
}
