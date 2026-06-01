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
import { useOrderLink } from "@/lib/order-link";
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
  const orderLink = useOrderLink();

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
  const [showTop, setShowTop] = useState(false);

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

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
        // Near the top of the page, keep "All" highlighted.
        if (window.scrollY < 8) {
          setActive("all");
          return;
        }
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

    const onScroll = () => {
      if (window.scrollY < 8) setActive("all");
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
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
    <div className="lg:-mb-28 lg:grid lg:min-h-screen lg:grid-cols-[220px_1fr]">
      {/* Left category rail — tablet / web only */}
      <aside className="sticky top-0 hidden h-screen flex-col gap-1 border-r border-line bg-cream p-5 lg:flex">
        {/* Marrow brand mark + role */}
        <div className="mb-5 flex items-center gap-2.5">
          <span className="relative inline-block h-5 w-5 rounded-full bg-ink">
            <span className="absolute inset-[20%] rounded-full bg-clay-500" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-ink">
            {brand?.name ?? "Menu"}
          </span>
        </div>
        <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
          {brand?.branch ? `${brand.branch} · ` : ""}Table {tableNo}
        </div>
        {categories.length > 0 && (
          <>
            <div className="mt-2 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-dim">
              Menu
            </div>
            <nav className="mt-1 flex flex-col gap-0.5">
              {catList.map((c) => {
                const on = !q && c.id === active;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pickCategory(c.id)}
                    className={`flex items-center justify-between rounded-sm px-2.5 py-2 text-left text-[13px] transition-colors ${
                      on
                        ? "bg-white font-semibold text-ink shadow-card"
                        : "font-medium text-ink-soft hover:bg-white/60"
                    }`}
                  >
                    <span>{c.name}</span>
                    {on && (
                      <span className="h-1.5 w-1.5 rounded-full bg-clay-500" />
                    )}
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
            className="flex items-center justify-center gap-1.5 rounded-sm border border-line-strong bg-white px-3 py-2 text-[12.5px] font-medium text-ink hover:bg-sand"
          >
            <StatusIcon />
            Order Status
          </button>
          <Link
            href={orderLink(`/order/${branchId}/${tableNo}/bill`)}
            className="flex items-center justify-center gap-1.5 rounded-sm border border-line-strong bg-white px-3 py-2 text-[12.5px] font-medium text-ink hover:bg-sand"
          >
            <BillIcon />
            Bill
          </Link>
        </div>
      </aside>

      {/* Main column */}
      <div className="min-w-0">
        <header className="sticky top-0 z-10 border-b border-line bg-white px-4 pb-3 pt-4">
          <div className="flex items-start justify-between gap-3 lg:hidden">
            <div className="min-w-0">
              <h1 className="truncate text-[24px] font-semibold leading-tight text-ink">
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
                className="flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[11.5px] font-semibold text-ink-soft hover:bg-sand"
              >
                <StatusIcon />
                Order Status
              </button>
              <Link
                href={orderLink(`/order/${branchId}/${tableNo}/bill`)}
                className="flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[11.5px] font-semibold text-ink-soft hover:bg-sand"
              >
                <BillIcon />
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

        <main className="px-4 pb-4 pt-4 lg:px-10 lg:pb-28">
          {/* Marrow hero — tablet+ only */}
          {!q && sections.length > 0 && (
            <div className="hidden pt-6 lg:block">
              <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-muted">
                Today's menu · Table {tableNo}
              </div>
              <h1 className="mt-2 text-[40px] font-semibold leading-[1.05] tracking-[-0.03em] text-ink">
                What sounds good?
              </h1>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
                Tap a dish to customize options and add it to your order. Your
                kitchen will see it the moment you send.
              </p>
            </div>
          )}

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
                className="mb-8 scroll-mt-44 lg:mt-8 lg:scroll-mt-20"
              >
                <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-line pb-3 lg:mb-5">
                  <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-ink lg:text-[24px]">
                    {c.name}
                  </h2>
                  <span className="mono text-[10px] uppercase tracking-[0.04em] text-ink-dim">
                    {c.items.length} items
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2 lg:grid-cols-[repeat(auto-fill,minmax(260px,1fr))] lg:gap-4">
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

      {showTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Back to top"
          className={`fixed right-4 z-30 grid h-11 w-11 place-items-center rounded-full border border-line bg-white text-ink shadow-[0_4px_16px_rgba(0,0,0,0.15)] hover:bg-sand ${
            cart.itemCount > 0 ? "bottom-24" : "bottom-5"
          }`}
        >
          <svg
            viewBox="0 0 16 16"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" />
          </svg>
        </button>
      )}

      {cart.itemCount > 0 && (
        <div className="fixed inset-x-0 bottom-5 z-20 flex justify-center px-4 lg:left-[220px] lg:right-0">
          <Link
            href={orderLink(`/order/${branchId}/${tableNo}/cart`)}
            className="inline-flex animate-slide-up items-center gap-3.5 rounded-full bg-ink px-4 py-3 pl-3 text-white shadow-pop transition-colors hover:bg-ink-soft"
          >
            <span className="grid h-7 min-w-7 place-items-center rounded-full bg-clay-500 px-2 text-xs font-semibold text-white">
              {cart.itemCount}
            </span>
            <span className="text-sm font-medium">View order</span>
            <span className="h-4 w-px bg-white/20" />
            <span className="mono text-sm font-medium tabular-nums">
              {formatPrice(cart.subtotal)}
            </span>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      )}
    </div>
  );
}

function StatusIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5V8l2.5 1.5" />
    </svg>
  );
}

function BillIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 1.5h8v13l-2-1.2-2 1.2-2-1.2-2 1.2z" />
      <path d="M6 5.5h4M6 8h4" />
    </svg>
  );
}
