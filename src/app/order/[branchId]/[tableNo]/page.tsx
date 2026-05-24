"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { MenuCard } from "@/components/menu/MenuCard";
import { MenuItemDetail } from "@/components/menu/MenuItemDetail";
import { OrderStatusModal } from "@/components/order/OrderStatusModal";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { useCart } from "@/contexts/CartContext";
import { api } from "@/lib/fetcher";
import { formatPrice } from "@/lib/utils";
import type { CategoryWithItemsDTO, MenuItemDTO } from "@/types";

type MenuResponse = { branchId: string; categories: CategoryWithItemsDTO[] };
type BranchResponse = {
  branch: { name: string; restaurant: { name: string } };
};

export default function MenuPage() {
  const { branchId, tableNo } = useParams<{
    branchId: string;
    tableNo: string;
  }>();
  const cart = useCart();

  const [categories, setCategories] = useState<CategoryWithItemsDTO[]>([]);
  const [brand, setBrand] = useState<{ name: string; branch: string } | null>(
    null,
  );
  const [active, setActive] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<MenuItemDTO | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
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

  useEffect(() => {
    api<BranchResponse>(`/api/branches/${branchId}`)
      .then((d) =>
        setBrand({ name: d.branch.restaurant.name, branch: d.branch.name }),
      )
      .catch(() => setBrand(null));
  }, [branchId]);

  const q = search.trim().toLowerCase();
  const sections = useMemo(() => {
    if (q) {
      const items = categories
        .flatMap((c) => c.items)
        .filter(
          (it) =>
            it.name.toLowerCase().includes(q) ||
            (it.description ?? "").toLowerCase().includes(q),
        );
      return items.length
        ? [{ id: "search", name: "Results", items } as CategoryWithItemsDTO]
        : [];
    }
    // Always render every category; categories act as scroll anchors.
    return categories;
  }, [q, categories]);

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const pendingScroll = useRef<string | null>(null);

  const scrollToSection = (id: string) => {
    sectionRefs.current[id]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  // When picking a category clears an active search, the sections re-render
  // first; scroll once the search has actually been cleared.
  useEffect(() => {
    if (!q && pendingScroll.current) {
      scrollToSection(pendingScroll.current);
      pendingScroll.current = null;
    }
  }, [q]);

  // Scrollspy: highlight the category whose section is currently in view.
  useEffect(() => {
    if (q) return;
    const els = sections
      .map((s) => sectionRefs.current[s.id])
      .filter((el): el is HTMLElement => Boolean(el));
    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const inView = entries.filter((e) => e.isIntersecting);
        if (inView.length === 0) return;
        const topmost = inView.reduce((a, b) =>
          a.boundingClientRect.top < b.boundingClientRect.top ? a : b,
        );
        const id = topmost.target.getAttribute("data-cat-id");
        if (id) setActive(id);
      },
      { rootMargin: "-25% 0px -70% 0px", threshold: 0 },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [q, sections]);

  const pickCategory = (id: string) => {
    setActive(id);
    if (id === "all") {
      setSearch("");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (q) {
      pendingScroll.current = id;
      setSearch("");
    } else {
      scrollToSection(id);
    }
  };

  const catList = [{ id: "all", name: "All" }, ...categories];

  return (
    <div className="lg:-mb-28 lg:grid lg:min-h-screen lg:grid-cols-[240px_1fr]">
      {/* Left category rail — tablet / web only */}
      <aside className="sticky top-0 hidden h-screen flex-col gap-1 border-r border-line bg-white p-4 lg:flex">
        <div className="border-b border-line pb-3">
          <h1 className="truncate text-[17px] font-semibold leading-tight tracking-tight text-ink">
            {brand?.name ?? "Menu"}
          </h1>
          <p className="mt-1 text-[11px] text-ink-muted">
            {brand?.branch ? `${brand.branch} · ` : ""}Table {tableNo}
          </p>
        </div>
        {categories.length > 0 && (
          <>
            <div className="mt-2 px-1 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
              Categories
            </div>
            <nav className="flex flex-col gap-0.5">
              {catList.map((c) => {
                const on = !q && c.id === active;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pickCategory(c.id)}
                    className={`rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors ${
                      on
                        ? "bg-clay-50 text-clay-700"
                        : "text-ink-muted hover:bg-sand"
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </nav>
          </>
        )}
        <div className="mt-auto flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setStatusOpen(true)}
            className="rounded-lg border border-line bg-white px-3 py-2 text-center text-[12.5px] font-semibold text-ink-soft hover:bg-sand"
          >
            Order Status
          </button>
          <Link
            href={`/order/${branchId}/${tableNo}/bill`}
            className="rounded-lg border border-line bg-white px-3 py-2 text-center text-[12.5px] font-semibold text-ink-soft hover:bg-sand"
          >
            Bill
          </Link>
        </div>
      </aside>

      {/* Main column */}
      <div className="min-w-0">
        <header className="sticky top-0 z-10 border-b border-line bg-white px-4 pb-3 pt-4">
          <div className="flex items-start justify-between gap-3 lg:hidden">
            <div className="min-w-0">
              <h1 className="truncate text-[19px] font-semibold leading-tight tracking-tight text-ink">
                {brand?.name ?? "Menu"}
              </h1>
              <p className="mt-1 text-[10px] tracking-wide text-ink-muted">
                {brand?.branch ? `${brand.branch} · ` : ""}Table {tableNo}
              </p>
            </div>
            <div className="flex flex-shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setStatusOpen(true)}
                className="rounded-full border border-line bg-white px-3 py-1.5 text-[11.5px] font-semibold text-ink-soft hover:bg-sand"
              >
                Order Status
              </button>
              <Link
                href={`/order/${branchId}/${tableNo}/bill`}
                className="rounded-full border border-line bg-white px-3 py-1.5 text-[11.5px] font-semibold text-ink-soft hover:bg-sand"
              >
                Bill
              </Link>
            </div>
          </div>

          <label className="mt-3 flex items-center gap-2 rounded-full border border-line bg-white px-3 py-2.5 text-ink-muted lg:mt-0">
            <svg
              viewBox="0 0 16 16"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            >
              <circle cx="7" cy="7" r="4.5" />
              <path d="m11 11 3 3" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Search the menu"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-base text-ink-muted hover:text-ink"
              >
                ×
              </button>
            )}
          </label>

          {!q && categories.length > 0 && (
            <div className="-mb-1 mt-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
              {catList.map((c) => {
                const on = c.id === active;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pickCategory(c.id)}
                    className={`flex-shrink-0 whitespace-nowrap rounded-full border px-3 py-2 text-[12px] font-semibold ${
                      on
                        ? "border-ink bg-ink text-white"
                        : "border-line bg-white text-ink-muted"
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          )}
        </header>

        <main className="px-4 pb-4 pt-4 lg:pb-28">
          {loading ? (
            <Loading label="Loading menu…" />
          ) : error ? (
            <ErrorState message={error} onRetry={load} />
          ) : sections.length === 0 ? (
            <EmptyState
              title={q ? "No matches" : "No items available"}
              description={
                q
                  ? `Nothing matches “${search}”.`
                  : "This branch has no items on the menu yet."
              }
            />
          ) : (
            sections.map((c) => (
              <section
                key={c.id}
                data-cat-id={c.id}
                ref={(el) => {
                  sectionRefs.current[c.id] = el;
                }}
                className="mb-6 scroll-mt-44 lg:scroll-mt-20"
              >
                <h2 className="mb-1 text-2xl font-semibold tracking-tight text-ink">
                  {c.name}
                </h2>
                <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2 lg:gap-3">
                  {c.items.map((item) => (
                    <MenuCard key={item.id} item={item} onSelect={setSelected} />
                  ))}
                </div>
              </section>
            ))
          )}
        </main>
      </div>

      <MenuItemDetail item={selected} onClose={() => setSelected(null)} />

      <OrderStatusModal
        isOpen={statusOpen}
        onOpenChange={setStatusOpen}
        branchId={branchId}
        tableNo={tableNo}
      />

      {cart.itemCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-2xl px-4 pb-5">
          <Link
            href={`/order/${branchId}/${tableNo}/cart`}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-2.5 rounded-2xl bg-clay-500 px-4 py-3 text-white shadow-[0_8px_24px_rgba(0,0,0,0.18)] hover:bg-clay-600"
          >
            <span className="grid h-6 min-w-6 place-items-center rounded-full bg-white/20 text-xs font-bold">
              {cart.itemCount}
            </span>
            <span className="text-sm font-semibold">View order</span>
            <span className="text-sm font-semibold opacity-85">
              {formatPrice(cart.subtotal)}
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
