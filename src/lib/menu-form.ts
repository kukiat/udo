import type { MenuItemFormValues } from "@/components/dashboard/MenuItemForm";

/** Convert form values into the menu API payload (sans restaurantId). */
export function toMenuItemPayload(values: MenuItemFormValues) {
  return {
    name: values.name.trim(),
    description: values.description.trim() || null,
    price: values.price,
    image: values.image.trim() || null,
    categoryId: values.categoryId,
    kdsStationId: values.kdsStationId || null,
    status: values.status,
    optionGroups: values.optionGroups.map((g, gi) => ({
      name: g.name.trim(),
      required: g.required,
      minSelect: Number(g.minSelect) || 0,
      maxSelect: Number(g.maxSelect) || 1,
      sortOrder: gi,
      optionItems: g.optionItems.map((o, oi) => ({
        name: o.name.trim(),
        price: o.price || "0",
        sortOrder: oi,
      })),
    })),
  };
}
