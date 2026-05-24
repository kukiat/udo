"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { TD, TH, THead, TR, Table } from "@/components/ui/Table";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { api } from "@/lib/fetcher";
import { formatPrice } from "@/lib/utils";
import type { MenuItemStatus } from "@/types";

type MenuItem = {
  id: string;
  name: string;
  price: string;
  status: MenuItemStatus;
  category: { id: string; name: string } | null;
};

const STATUS_OPTIONS = [
  { id: "available", label: "Available" },
  { id: "sold_out", label: "Sold out" },
  { id: "hidden", label: "Hidden" },
];

const statusTone: Record<MenuItemStatus, "green" | "amber" | "neutral"> = {
  available: "green",
  sold_out: "amber",
  hidden: "neutral",
};

export default function MenuListPage() {
  const { restaurantId, loading: ctxLoading } = useRestaurant();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    if (!restaurantId) return;
    setLoading(true);
    api<{ items: MenuItem[] }>(`/api/menu?restaurantId=${restaurantId}`)
      .then((d) => setItems(d.items))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [restaurantId]);

  const changeStatus = async (id: string, status: string | null) => {
    if (!status) return;
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: status as MenuItemStatus } : i)),
    );
    try {
      await api(`/api/menu/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update status");
      load();
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this menu item?")) return;
    try {
      await api(`/api/menu/${id}`, { method: "DELETE" });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete item");
    }
  };

  if (ctxLoading || loading) return <Loading />;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Menu Items</h1>
        <Link href={`/dashboard/${restaurantId}/menu/create`}>
          <Button>Create new item</Button>
        </Link>
      </div>

      {error && (
        <div className="mt-4">
          <ErrorState message={error} onRetry={load} />
        </div>
      )}

      <div className="mt-4">
        {items.length === 0 ? (
          <EmptyState
            title="No menu items"
            description="Create your first menu item to get started."
            action={
              <Link href={`/dashboard/${restaurantId}/menu/create`}>
                <Button>Create new item</Button>
              </Link>
            }
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Category</TH>
                <TH className="w-28">Price</TH>
                <TH className="w-44">Status</TH>
                <TH className="w-40 text-right">Actions</TH>
              </TR>
            </THead>
            <tbody>
              {items.map((it) => (
                <TR key={it.id}>
                  <TD className="font-medium text-ink">{it.name}</TD>
                  <TD className="text-ink-muted">{it.category?.name ?? "—"}</TD>
                  <TD>{formatPrice(it.price)}</TD>
                  <TD>
                    <div className="flex items-center gap-2">
                      <Badge tone={statusTone[it.status]}>{it.status}</Badge>
                      <Select
                        options={STATUS_OPTIONS}
                        selectedKey={it.status}
                        onSelectionChange={(k) => changeStatus(it.id, k)}
                        className="w-32"
                      />
                    </div>
                  </TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/dashboard/${restaurantId}/menu/${it.id}/edit`}>
                        <Button size="sm" variant="secondary">
                          Edit
                        </Button>
                      </Link>
                      <Button size="sm" variant="danger" onPress={() => remove(it.id)}>
                        Delete
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </div>
  );
}
