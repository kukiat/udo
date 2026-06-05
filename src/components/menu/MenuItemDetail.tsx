"use client";

import { useEffect, useState } from "react";

import { ItemSwatch } from "@/components/menu/ItemSwatch";
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
  const { addLine, lines, removeLine } = useCart();
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

  const existingLines = lines.filter((l) => l.menuItemId === item.id);

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
    <Modal isOpen={Boolean(item)} onOpenChange={(o) => !o && onClose()} showClose={false}>
      <div className="flex max-h-[92vh] flex-col">
        <div className="relative h-[200px] flex-shrink-0">
          <ItemSwatch
            id={item.id}
            name={item.name}
            image={item.image}
            size="lg"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3.5 top-3.5 grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-[18px] py-4">
          <h2 className="text-[28px] font-semibold leading-tight tracking-tight text-ink">
            {item.name}
          </h2>
          {item.description && (
            <p className="text-[13.5px] leading-relaxed text-ink-muted">
              {item.description}
            </p>
          )}

          {existingLines.length > 0 && (
            <section className="flex flex-col gap-2 rounded-xl border border-line bg-sand/40 p-3">
              <div className="text-[13px] font-bold tracking-tight text-ink">
                In your order
              </div>
              {existingLines.map((l) => (
                <div
                  key={l.lineId}
                  className="flex items-start justify-between gap-2 text-[13px]"
                >
                  <div className="min-w-0">
                    <span className="font-medium text-ink">
                      {l.quantity}× {item.name}
                    </span>
                    {l.options.length > 0 && (
                      <span className="text-ink-muted">
                        {" "}
                        ({l.options.map((o) => o.name).join(", ")})
                      </span>
                    )}
                    {l.note && (
                      <div className="text-[11.5px] italic text-ink-muted">
                        “{l.note}”
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(l.lineId)}
                    className="flex-shrink-0 text-[11.5px] font-semibold text-clay-700 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </section>
          )}

          {item.optionGroups.map((g) => {
            const cur = selected[g.id] ?? [];
            const multi = g.maxSelect > 1;
            const needsMore = g.required && cur.length < Math.max(1, g.minSelect);
            return (
              <section key={g.id} className="flex flex-col gap-2">
                <div className="flex items-end justify-between gap-2.5">
                  <div>
                    <div className="text-[13px] font-bold tracking-tight text-ink">
                      {g.name}
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-ink-muted">
                      {!multi && g.required
                        ? "Choose one · required"
                        : multi && g.required
                          ? `Choose ${g.minSelect}${
                              g.maxSelect !== g.minSelect ? `–${g.maxSelect}` : ""
                            } · required`
                          : multi
                            ? "Optional · choose any"
                            : ""}
                    </div>
                  </div>
                  {needsMore ? (
                    <span className="rounded bg-clay-50 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-clay-700">
                      Required
                    </span>
                  ) : (
                    g.required && (
                      <span className="font-bold text-emerald-600">✓</span>
                    )
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  {g.optionItems.map((o) => {
                    const on = cur.includes(o.id);
                    const price = parseFloat(o.price);
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => toggle(g.id, o.id, g.maxSelect)}
                        className={cn(
                          "grid grid-cols-[20px_1fr_auto] items-center gap-3 rounded-[10px] border px-3 py-2.5 text-left text-[13px] transition-colors",
                          on
                            ? "border-clay-500 bg-white"
                            : "border-line bg-white hover:bg-sand/50",
                        )}
                      >
                        <span
                          className={cn(
                            "grid h-[18px] w-[18px] place-items-center border-[1.5px]",
                            multi ? "rounded-[5px]" : "rounded-full",
                            on ? "border-clay-500 bg-clay-500" : "border-line",
                          )}
                        >
                          {on &&
                            (multi ? (
                              <span className="text-[11px] font-bold leading-none text-white">
                                ✓
                              </span>
                            ) : (
                              <span className="h-2 w-2 rounded-full bg-white" />
                            ))}
                        </span>
                        <span className="min-w-0 font-medium text-ink">
                          {o.name}
                        </span>
                        {price > 0 && (
                          <span className="text-[11.5px] font-semibold text-ink-muted">
                            +{formatPrice(o.price)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}

          <section className="flex flex-col gap-2">
            <div>
              <div className="text-[13px] font-bold tracking-tight text-ink">
                Special instructions
              </div>
              <div className="mt-0.5 text-[11.5px] text-ink-muted">
                Tell the kitchen anything · optional
              </div>
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. nut allergy, well-done, hold the cilantro"
              rows={2}
              className="w-full resize-none rounded-lg border border-line bg-white px-2.5 py-2 text-[13px] text-ink outline-none focus:border-ink"
            />
          </section>
        </div>

        <div className="grid flex-shrink-0 grid-cols-[auto_1fr] items-center gap-3 border-t border-line bg-white px-4 py-3">
          <div className="inline-flex items-center rounded-full border border-line p-0.5">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              aria-label="Decrease"
              className="grid h-9 w-9 place-items-center rounded-full text-lg text-ink hover:bg-sand"
            >
              −
            </button>
            <span className="min-w-7 text-center text-[15px] font-semibold tabular-nums">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              aria-label="Increase"
              className="grid h-9 w-9 place-items-center rounded-full text-lg text-ink hover:bg-sand"
            >
              +
            </button>
          </div>
          <button
            type="button"
            disabled={!canAdd}
            onClick={handleAdd}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-colors",
              canAdd
                ? "bg-clay-500 text-white hover:bg-clay-600"
                : "cursor-not-allowed bg-sand text-ink-muted",
            )}
          >
            {canAdd ? (
              <>
                Add to order ·{" "}
                <b className="font-bold">{formatPrice(unit * quantity)}</b>
              </>
            ) : (
              `Select ${missingRequired[0].name.toLowerCase()}`
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
