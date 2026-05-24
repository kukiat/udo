"use client";

import { Badge } from "@/components/ui/Badge";
import { formatPrice } from "@/lib/utils";
import type { MenuItemDTO } from "@/types";

export function MenuCard({
  item,
  onSelect,
}: {
  item: MenuItemDTO;
  onSelect: (item: MenuItemDTO) => void;
}) {
  const soldOut = item.status === "sold_out";
  return (
    <button
      type="button"
      disabled={soldOut}
      onClick={() => onSelect(item)}
      className="group flex flex-col overflow-hidden rounded-card border border-line bg-white text-left shadow-card transition-shadow hover:shadow-md disabled:opacity-60"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-sand">
        {item.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image}
            alt={item.name}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        )}
        {soldOut && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60">
            <Badge tone="red">Sold out</Badge>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="font-medium text-ink line-clamp-1">{item.name}</p>
        {item.description && (
          <p className="text-xs text-ink-muted line-clamp-2">
            {item.description}
          </p>
        )}
        <p className="mt-auto pt-1 font-semibold text-clay-700">
          {formatPrice(item.price)}
        </p>
      </div>
    </button>
  );
}
