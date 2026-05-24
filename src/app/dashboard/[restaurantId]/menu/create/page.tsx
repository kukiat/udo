"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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

const EMPTY: MenuItemFormValues = {
  name: "",
  description: "",
  price: "",
  image: "",
  categoryId: "",
  kdsStationId: "",
  status: "available",
  optionGroups: [],
};

export default function CreateMenuItemPage() {
  const router = useRouter();
  const { restaurantId, stations, loading: ctxLoading } = useRestaurant();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const menuHref = `/dashboard/${restaurantId}/menu`;

  useEffect(() => {
    if (!restaurantId) return;
    api<{ categories: Category[] }>(
      `/api/categories?restaurantId=${restaurantId}`,
    )
      .then((d) => setCategories(d.categories))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [restaurantId]);

  const submit = async (values: MenuItemFormValues) => {
    if (!restaurantId) return;
    setSubmitting(true);
    setError(null);
    try {
      await api("/api/menu", {
        method: "POST",
        body: JSON.stringify({
          restaurantId,
          ...toMenuItemPayload(values),
        }),
      });
      router.push(menuHref);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create item");
      setSubmitting(false);
    }
  };

  if (ctxLoading || loading) return <Loading />;

  return (
    <div className="max-w-2xl">
      <Link href={menuHref} className="text-sm text-ink-muted hover:text-ink">
        ← Back to menu
      </Link>
      <h1 className="mb-5 mt-2 text-2xl font-bold text-ink">Create Menu Item</h1>
      {error && (
        <div className="mb-4">
          <ErrorState message={error} />
        </div>
      )}
      <MenuItemForm
        defaultValues={EMPTY}
        categories={categories}
        stations={stations}
        submitting={submitting}
        onSubmit={submit}
      />
    </div>
  );
}
