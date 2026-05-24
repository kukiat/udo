"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { MenuCard } from "@/components/menu/MenuCard";
import { MenuItemDetail } from "@/components/menu/MenuItemDetail";
import { Tabs } from "@/components/ui/Tabs";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { useCart } from "@/contexts/CartContext";
import { api } from "@/lib/fetcher";
import { formatPrice } from "@/lib/utils";
import type { CategoryWithItemsDTO, MenuItemDTO } from "@/types";

type MenuResponse = { branchId: string; categories: CategoryWithItemsDTO[] };

export default function MenuPage() {
  const { branchId, tableNo } = useParams<{
    branchId: string;
    tableNo: string;
  }>();
  const cart = useCart();

  const [categories, setCategories] = useState<CategoryWithItemsDTO[]>([]);
  const [active, setActive] = useState<string>("all");
  const [selected, setSelected] = useState<MenuItemDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    api<MenuResponse>(`/api/storefront/menu?branchId=${branchId}`)
      .then((d) => setCategories(d.categories))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [branchId]);

  const visible =
    active === "all"
      ? categories
      : categories.filter((c) => c.id === active);

  return (
    <div>
      <header className="sticky top-0 z-10 border-b border-line bg-cream/90 px-4 py-4 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-ink-muted">Table {tableNo}</p>
            <h1 className="text-xl font-semibold text-ink">Menu</h1>
          </div>
          <Link
            href={`/order/${branchId}/${tableNo}/status`}
            className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-medium text-clay-600 shadow-card hover:text-clay-800"
          >
            Order Status
          </Link>
        </div>
        <div className="mt-3">
          <Tabs
            value={active}
            onChange={setActive}
            options={[
              { id: "all", label: "All" },
              ...categories.map((c) => ({ id: c.id, label: c.name })),
            ]}
          />
        </div>
      </header>

      <main className="px-4 py-4">
        {loading ? (
          <Loading label="Loading menu…" />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : visible.length === 0 ? (
          <EmptyState
            title="No items available"
            description="This branch has no items on the menu yet."
          />
        ) : (
          visible.map((c) => (
            <section key={c.id} className="mb-6">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">
                {c.name}
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {c.items.map((item) => (
                  <MenuCard key={item.id} item={item} onSelect={setSelected} />
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      <MenuItemDetail item={selected} onClose={() => setSelected(null)} />

      {cart.itemCount > 0 && (
        <Link
          href={`/order/${branchId}/${tableNo}/cart`}
          className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-2xl items-center justify-between bg-clay-500 px-5 py-4 text-white shadow-lg"
        >
          <span className="flex items-center gap-2 font-medium">
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-sm">
              {cart.itemCount}
            </span>
            View cart
          </span>
          <span className="font-semibold">{formatPrice(cart.subtotal)}</span>
        </Link>
      )}
    </div>
  );
}
