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
      className="group relative flex w-full overflow-hidden rounded-card border border-line bg-white text-left shadow-card transition-all hover:-translate-y-px hover:border-line-strong hover:shadow-elev disabled:opacity-60 lg:flex-col"
    >
      {/* Image: horizontal thumb on mobile, top-banner on tablet+ */}
      <div className="relative min-h-[96px] w-[96px] flex-shrink-0 self-stretch overflow-hidden bg-[var(--bg-sunken)] lg:h-[178px] lg:w-full">
        <ItemSwatch
          id={item.id}
          name={item.name}
          image={item.image}
          size="lg"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-white/5 opacity-80" />
        {count > 0 && (
          <span className="absolute right-2 top-2 grid h-6 min-w-6 place-items-center rounded-full bg-clay-500 px-1.5 text-xs font-bold text-white shadow-card">
            {count}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3.5 lg:min-h-[148px] lg:p-4">
        <div className="flex items-baseline justify-between gap-2">
          <div className="min-w-0 text-[15px] font-semibold leading-snug text-ink">
            {item.name}
          </div>
          <div className="mono flex-shrink-0 text-[13px] font-semibold tabular-nums text-ink">
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
            <span />
          )}
          {!soldOut && (
            <span
              aria-hidden
              className="grid h-7 w-7 place-items-center rounded-full border border-line-strong bg-white text-ink transition-colors group-hover:border-clay-500 group-hover:bg-clay-500 group-hover:text-white"
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
