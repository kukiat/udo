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
      className="grid grid-cols-[76px_1fr] gap-3 rounded-2xl border border-line bg-white p-2.5 text-left transition-colors hover:border-ink/20 hover:bg-sand/60 disabled:opacity-60"
    >
      <div className="relative">
        <ItemSwatch
          id={item.id}
          name={item.name}
          image={item.image}
          className="rounded-xl shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)]"
        />
        {count > 0 && (
          <span className="absolute -right-1.5 -top-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-clay-500 px-1.5 text-xs font-bold text-white shadow">
            {count}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="font-medium tracking-tight text-ink">{item.name}</div>
        {item.description && (
          <div className="line-clamp-2 text-xs leading-snug text-ink-muted">
            {item.description}
          </div>
        )}
        <div className="mt-0.5 flex items-center justify-between">
          <span className="text-[13px] font-bold tabular-nums text-ink">
            {soldOut ? "Sold out" : formatPrice(item.price)}
          </span>
        </div>
      </div>
    </button>
  );
}
