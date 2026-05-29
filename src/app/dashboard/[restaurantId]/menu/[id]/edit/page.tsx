"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  MenuItemForm,
  type MenuItemFormValues,
} from "@/components/dashboard/MenuItemForm";
import { ErrorState, Loading } from "@/components/ui/States";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { api } from "@/lib/fetcher";
import { toMenuItemPayload } from "@/lib/menu-form";

type Category = { id: string; name: string };
type MenuItemDetail = {
  id: string;
  name: string;
  description: string | null;
  price: string;
  image: string | null;
  categoryId: string;
  kdsStationId: string | null;
  status: "available" | "sold_out" | "hidden";
  optionGroups: {
    name: string;
    required: boolean;
    minSelect: number;
    maxSelect: number;
    optionItems: { name: string; price: string }[];
  }[];
};

export default function EditMenuItemPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { restaurantId, stations, loading: ctxLoading } = useRestaurant();

  const [categories, setCategories] = useState<Category[]>([]);
  const [values, setValues] = useState<MenuItemFormValues | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const menuHref = `/dashboard/${restaurantId}/menu`;

  useEffect(() => {
    if (!restaurantId) return;
    Promise.all([
      api<{ categories: Category[] }>(
        `/api/categories?restaurantId=${restaurantId}`,
      ),
      api<{ item: MenuItemDetail }>(`/api/menu/${id}`),
    ])
      .then(([c, m]) => {
        setCategories(c.categories);
        const it = m.item;
        setValues({
          name: it.name,
          description: it.description ?? "",
          price: it.price,
          image: it.image ?? "",
          categoryId: it.categoryId,
          kdsStationId: it.kdsStationId ?? "",
          status: it.status,
          optionGroups: it.optionGroups.map((g) => ({
            name: g.name,
            required: g.required,
            minSelect: g.minSelect,
            maxSelect: g.maxSelect,
            optionItems: g.optionItems.map((o) => ({
              name: o.name,
              price: o.price,
            })),
          })),
        });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [restaurantId, id]);

  const submit = async (v: MenuItemFormValues) => {
    setSubmitting(true);
    setError(null);
    try {
      await api(`/api/menu/${id}`, {
        method: "PUT",
        body: JSON.stringify(toMenuItemPayload(v)),
      });
      router.push(menuHref);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update item");
      setSubmitting(false);
    }
  };

  if (ctxLoading || loading) return <Loading />;
  if (error && !values)
    return (
      <div className="max-w-2xl">
        <ErrorState message={error} />
      </div>
    );
  if (!values) return null;

  return (
    <div className="max-w-3xl">
      <Link href={menuHref} style={{ fontSize: 12, color: "var(--text-3)" }}>
        ← กลับเมนู · BACK TO MENU
      </Link>
      <div className="h-display" style={{ fontSize: 44, marginTop: 6 }}>
        แก้ไขเมนู
      </div>
      <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4, marginBottom: 20 }}>
        EDIT MENU ITEM
      </div>
      {error && (
        <div className="mb-4">
          <ErrorState message={error} />
        </div>
      )}
      <MenuItemForm
        defaultValues={values}
        categories={categories}
        stations={stations}
        submitting={submitting}
        onSubmit={submit}
      />
    </div>
  );
}
