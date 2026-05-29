"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Bi } from "@/components/dashboard/Bi";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { api } from "@/lib/fetcher";
import { formatPrice } from "@/lib/utils";

type SalesResponse = {
  summary: { totalSales: string; orderCount: number };
};

export function Sidebar() {
  const pathname = usePathname();
  const { restaurantId, branchId } = useRestaurant();
  const [today, setToday] = useState<SalesResponse["summary"] | null>(null);

  useEffect(() => {
    if (!branchId) {
      setToday(null);
      return;
    }
    const day = new Date().toISOString().slice(0, 10);
    let active = true;
    api<SalesResponse>(
      `/api/reports/sales?branchId=${branchId}&from=${day}&to=${day}`,
    )
      .then((d) => active && setToday(d.summary))
      .catch(() => active && setToday(null));
    return () => {
      active = false;
    };
  }, [branchId]);

  const base = `/dashboard/${restaurantId}`;
  const links = [
    { href: base, th: "ภาพรวม", en: "Overview", icon: "◆", exact: true },
    { href: `${base}/branches`, th: "สาขา", en: "Branches", icon: "⌂" },
    { href: `${base}/categories`, th: "หมวดหมู่", en: "Categories", icon: "◧" },
    { href: `${base}/menu`, th: "รายการเมนู", en: "Menu Items", icon: "☱" },
    { href: `${base}/branch-menu`, th: "เมนูสาขา", en: "Branch Menu", icon: "⊞" },
    { href: `${base}/reports`, th: "รายงาน", en: "Reports", icon: "⌗" },
  ];

  return (
    <aside className="sidebar w-full shrink-0 md:sticky md:top-[60px] md:h-[calc(100vh-60px)] md:w-[220px] md:self-start">
      <Link
        href="/dashboard"
        className="mb-2 px-3.5 py-1.5 text-[11px] tracking-wide"
        style={{ color: "var(--text-3)" }}
      >
        ← ทุกร้าน · ALL RESTAURANTS
      </Link>
      <nav className="flex flex-wrap gap-1 md:flex-col md:flex-nowrap">
        {links.map((l) => {
          const active = l.exact
            ? pathname === l.href
            : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`nav-item ${active ? "on" : ""}`}
            >
              <span style={{ fontSize: 14, opacity: 0.7 }}>{l.icon}</span>
              <Bi th={l.th} en={l.en} className="flex-1" />
            </Link>
          );
        })}
      </nav>
      <div className="hidden md:block md:flex-1" />
      <div
        className="card mt-3.5 hidden md:block"
        style={{ padding: 14, borderRadius: 14 }}
      >
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          วันนี้ · TODAY
        </div>
        <div className="h-1 mono" style={{ fontSize: 22, color: "var(--lime)" }}>
          {formatPrice(today?.totalSales ?? 0)}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-2)", marginTop: 4 }}>
          {today?.orderCount ?? 0} คำสั่ง · {today?.orderCount ?? 0} orders
        </div>
      </div>
    </aside>
  );
}
