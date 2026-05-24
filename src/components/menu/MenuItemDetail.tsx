"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useCart } from "@/contexts/CartContext";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/utils";
import type { MenuItemDTO, OptionItemDTO } from "@/types";

export function MenuItemDetail({
  item,
  onClose,
}: {
  item: MenuItemDTO | null;
  onClose: () => void;
}) {
  const { addLine } = useCart();
  // selected option item ids per group
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");

  // Reset transient state whenever a different item opens.
  const itemId = item?.id;
  useEffect(() => {
    setSelected({});
    setQuantity(1);
    setNote("");
  }, [itemId]);

  if (!item) return null;

  const toggle = (groupId: string, optionId: string, maxSelect: number) => {
    setSelected((prev) => {
      const current = prev[groupId] ?? [];
      if (maxSelect <= 1) return { ...prev, [groupId]: [optionId] };
      if (current.includes(optionId)) {
        return { ...prev, [groupId]: current.filter((id) => id !== optionId) };
      }
      if (current.length >= maxSelect) return prev;
      return { ...prev, [groupId]: [...current, optionId] };
    });
  };

  const optionById = new Map<string, OptionItemDTO>();
  for (const g of item.optionGroups) {
    for (const o of g.optionItems) optionById.set(o.id, o);
  }

  const chosenOptions = Object.values(selected)
    .flat()
    .map((id) => optionById.get(id))
    .filter((o): o is OptionItemDTO => Boolean(o));

  const unit =
    parseFloat(item.price) +
    chosenOptions.reduce((s, o) => s + parseFloat(o.price), 0);

  const missingRequired = item.optionGroups.filter(
    (g) => g.required && (selected[g.id]?.length ?? 0) < Math.max(1, g.minSelect),
  );
  const canAdd = missingRequired.length === 0;

  const handleAdd = () => {
    if (!canAdd) return;
    addLine({
      menuItemId: item.id,
      name: item.name,
      unitPrice: item.price,
      image: item.image,
      quantity,
      note,
      options: chosenOptions.map((o) => {
        const groupId = item.optionGroups.find((g) =>
          g.optionItems.some((oi) => oi.id === o.id),
        )!.id;
        return {
          optionGroupId: groupId,
          optionItemId: o.id,
          name: o.name,
          price: o.price,
        };
      }),
    });
    onClose();
  };

  return (
    <Modal isOpen={Boolean(item)} onOpenChange={(o) => !o && onClose()}>
      {item.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.image}
          alt={item.name}
          className="h-48 w-full object-cover"
        />
      )}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">{item.name}</h2>
            {item.description && (
              <p className="mt-1 text-sm text-ink-muted">{item.description}</p>
            )}
          </div>
          <p className="font-semibold text-clay-700">
            {formatPrice(item.price)}
          </p>
        </div>

        <div className="mt-4 space-y-4">
          {item.optionGroups.map((g) => (
            <fieldset key={g.id}>
              <legend className="flex items-center gap-2 text-sm font-medium text-ink-soft">
                {g.name}
                {g.required ? (
                  <Badge tone="clay">Required</Badge>
                ) : (
                  <span className="text-xs text-ink-muted">
                    {g.maxSelect > 1 ? `Choose up to ${g.maxSelect}` : "Optional"}
                  </span>
                )}
              </legend>
              <div className="mt-2 space-y-1.5">
                {g.optionItems.map((o) => {
                  const checked = (selected[g.id] ?? []).includes(o.id);
                  return (
                    <label
                      key={o.id}
                      className={cn(
                        "flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2 text-sm",
                        checked
                          ? "border-clay-300 bg-clay-50"
                          : "border-line bg-white hover:bg-sand",
                      )}
                    >
                      <span className="flex items-center gap-2 text-ink">
                        <input
                          type={g.maxSelect > 1 ? "checkbox" : "radio"}
                          name={g.id}
                          checked={checked}
                          onChange={() => toggle(g.id, o.id, g.maxSelect)}
                          className="accent-clay-500"
                        />
                        {o.name}
                      </span>
                      {parseFloat(o.price) > 0 && (
                        <span className="text-ink-muted">
                          +{formatPrice(o.price)}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}

          <label className="block">
            <span className="text-sm font-medium text-ink-soft">Note</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. no peanuts"
              className="mt-1 w-full resize-y rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-clay-300 focus:ring-2 focus:ring-clay-100"
            />
          </label>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="inline-flex items-center rounded-xl border border-line">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="px-3 py-2 text-ink-muted hover:bg-sand"
            >
              −
            </button>
            <span className="w-10 text-center text-sm font-medium">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="px-3 py-2 text-ink-muted hover:bg-sand"
            >
              +
            </button>
          </div>
          <Button size="lg" className="flex-1" isDisabled={!canAdd} onPress={handleAdd}>
            Add · {formatPrice(unit * quantity)}
          </Button>
        </div>
        {!canAdd && (
          <p className="mt-2 text-center text-xs text-red-600">
            Please choose: {missingRequired.map((g) => g.name).join(", ")}
          </p>
        )}
      </div>
    </Modal>
  );
}
