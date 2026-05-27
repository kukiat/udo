"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  MenuItemForm,
  type MenuItemFormValues,
} from "@/components/dashboard/MenuItemForm";
import { ItemSwatch } from "@/components/menu/ItemSwatch";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { TD, TH, THead, TR, Table } from "@/components/ui/Table";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { api } from "@/lib/fetcher";
import { toMenuItemPayload } from "@/lib/menu-form";
import { formatPrice } from "@/lib/utils";
import type { MenuItemStatus } from "@/types";

type MenuItem = {
  id: string;
  name: string;
  price: string;
  image: string | null;
  status: MenuItemStatus;
  category: { id: string; name: string } | null;
};

type Category = { id: string; name: string };

type MenuItemDetail = {
  id: string;
  name: string;
  description: string | null;
  price: string;
  image: string | null;
  categoryId: string;
  kdsStationId: string | null;
  status: MenuItemStatus;
  optionGroups: {
    name: string;
    required: boolean;
    minSelect: number;
    maxSelect: number;
    optionItems: { name: string; price: string }[];
  }[];
};

const PAGE_SIZE = 10;

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
  const { restaurantId, stations, loading: ctxLoading } = useRestaurant();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editId, setEditId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<MenuItemFormValues | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [deleteItem, setDeleteItem] = useState<MenuItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    if (!restaurantId) return;
    setLoading(true);
    Promise.all([
      api<{ items: MenuItem[]; total: number }>(
        `/api/menu?restaurantId=${restaurantId}&offset=${offset}&limit=${PAGE_SIZE}`,
      ),
      api<{ categories: Category[] }>(
        `/api/categories?restaurantId=${restaurantId}`,
      ),
    ])
      .then(([m, c]) => {
        setItems(m.items);
        setTotal(m.total);
        setCategories(c.categories);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [restaurantId, offset]);

  const openEdit = (id: string) => {
    setEditId(id);
    setEditValues(null);
    setEditLoading(true);
    setError(null);
    api<{ item: MenuItemDetail }>(`/api/menu/${id}`)
      .then(({ item: it }) => {
        setEditValues({
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
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load item"))
      .finally(() => setEditLoading(false));
  };

  const closeEdit = () => {
    setEditId(null);
    setEditValues(null);
  };

  const submitEdit = async (v: MenuItemFormValues) => {
    if (!editId) return;
    setSubmitting(true);
    setError(null);
    try {
      await api(`/api/menu/${editId}`, {
        method: "PUT",
        body: JSON.stringify(toMenuItemPayload(v)),
      });
      closeEdit();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update item");
    } finally {
      setSubmitting(false);
    }
  };

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

  const confirmRemove = async () => {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      await api(`/api/menu/${deleteItem.id}`, { method: "DELETE" });
      setDeleteItem(null);
      if (items.length === 1 && offset > 0) {
        setOffset((o) => Math.max(0, o - PAGE_SIZE));
      } else {
        load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete item");
    } finally {
      setDeleting(false);
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
                <TH className="w-16">Image</TH>
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
                  <TD>
                    <ItemSwatch
                      id={it.id}
                      name={it.name}
                      image={it.image}
                      size="xs"
                      className="rounded-lg"
                    />
                  </TD>
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
                      <Button
                        size="sm"
                        variant="secondary"
                        onPress={() => openEdit(it.id)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onPress={() => setDeleteItem(it)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}

        {total > 0 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-ink-muted">
              {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                isDisabled={offset === 0}
                onPress={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="secondary"
                isDisabled={offset + PAGE_SIZE >= total}
                onPress={() => setOffset((o) => o + PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={editId !== null}
        onOpenChange={(open) => !open && closeEdit()}
        className="sm:max-w-2xl"
      >
        <div className="p-5">
          <h2 className="sticky top-0 z-10 -mx-5 -mt-5 mb-4 border-b border-line bg-white px-5 py-4 text-xl font-bold text-ink">
            Edit Menu Item
          </h2>
          {editLoading || !editValues ? (
            <Loading />
          ) : (
            <MenuItemForm
              defaultValues={editValues}
              categories={categories}
              stations={stations}
              submitting={submitting}
              onSubmit={submitEdit}
              stickyFooter
            />
          )}
        </div>
      </Modal>

      <Modal
        isOpen={deleteItem !== null}
        onOpenChange={(open) => !open && setDeleteItem(null)}
      >
        <div className="flex flex-col gap-4 p-5">
          <div>
            <h2 className="text-lg font-semibold text-ink">Delete menu item?</h2>
            <p className="mt-1 text-sm text-ink-muted">
              {deleteItem
                ? `“${deleteItem.name}” will be deleted. This can't be undone.`
                : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              isDisabled={deleting}
              onPress={() => setDeleteItem(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              isDisabled={deleting}
              onPress={confirmRemove}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
