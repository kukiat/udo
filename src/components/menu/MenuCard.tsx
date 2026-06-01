"use client";

import { ItemSwatch } from "@/components/menu/ItemSwatch";
import { useCart } from "@/contexts/CartContext";
import { formatPrice } from "@/lib/utils";
import type { MenuItemDTO } from "@/types";

export function MenuCard({
  item,
  onSelect,
}: {
  item: MenuItemDTO;
  onSelect: (item: MenuItemDTO) => void;
}) {
  const { lines } = useCart();
  const soldOut = item.status === "sold_out";
  const count = lines
    .filter((l) => l.menuItemId === item.id)
    .reduce((s, l) => s + l.quantity, 0);
  return (
    <button
      type="button"
      disabled={soldOut}
      onClick={() => onSelect(item)}
      className="group relative flex w-full overflow-hidden rounded-card border border-line bg-white text-left transition-all hover:-translate-y-px hover:border-line-strong hover:shadow-elev disabled:opacity-60 lg:flex-col"
    >
      {/* Image: horizontal thumb on mobile, top-banner on tablet+ */}
      <div className="relative h-[88px] w-[88px] flex-shrink-0 lg:h-[140px] lg:w-full">
        <ItemSwatch
          id={item.id}
          name={item.name}
          image={item.image}
          className="lg:rounded-none"
        />
        {count > 0 && (
          <span className="absolute right-1.5 top-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-clay-500 px-1.5 text-xs font-bold text-white shadow-card">
            {count}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3 lg:p-3.5">
        <div className="flex items-baseline justify-between gap-2">
          <div className="font-semibold tracking-tight text-ink">{item.name}</div>
          <div className="mono text-[13px] font-semibold tabular-nums text-ink">
            {soldOut ? "" : formatPrice(item.price)}
          </div>
        </div>
        {item.description && (
          <div className="line-clamp-2 text-xs leading-snug text-ink-muted">
            {item.description}
          </div>
        )}
        <div className="mt-auto flex items-center justify-between pt-1">
          {soldOut ? (
            <span className="inline-flex items-center rounded-full bg-rose-soft px-2 py-0.5 text-[11px] font-semibold text-rose">
              Sold out
            </span>
          ) : (
            <span className="text-[11px] uppercase tracking-wider text-ink-dim">
              Tap to customize
            </span>
          )}
          {!soldOut && (
            <span
              aria-hidden
              className="grid h-7 w-7 place-items-center rounded-full border border-line-strong bg-white text-ink transition-colors group-hover:border-ink group-hover:bg-ink group-hover:text-white"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
