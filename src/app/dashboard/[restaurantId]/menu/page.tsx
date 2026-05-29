"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  MenuItemForm,
  type MenuItemFormValues,
} from "@/components/dashboard/MenuItemForm";
import { ItemSwatch } from "@/components/menu/ItemSwatch";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
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

const STATUS_OPTIONS: { id: MenuItemStatus; label: string }[] = [
  { id: "available", label: "พร้อม · Available" },
  { id: "sold_out", label: "หมด · Sold out" },
  { id: "hidden", label: "ซ่อน · Hidden" },
];

const statusPill: Record<MenuItemStatus, string> = {
  available: "pill-lime",
  sold_out: "pill-danger",
  hidden: "pill-muted",
};
const statusLabel: Record<MenuItemStatus, string> = {
  available: "● พร้อม",
  sold_out: "● หมด",
  hidden: "● ซ่อน",
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
    <div className="max-w-5xl">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div className="h-display" style={{ fontSize: 44 }}>
            รายการเมนู
          </div>
          <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>
            MENU ITEMS · {total} รายการ
          </div>
        </div>
        <Link href={`/dashboard/${restaurantId}/menu/create`}>
          <button className="btn btn-primary">＋ เพิ่มเมนู · CREATE NEW</button>
        </Link>
      </div>

      {error && (
        <div style={{ marginBottom: 16 }}>
          <ErrorState message={error} onRetry={load} />
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          title="No menu items"
          description="Create your first menu item to get started."
          action={
            <Link href={`/dashboard/${restaurantId}/menu/create`}>
              <button className="btn btn-primary">＋ เพิ่มเมนู · CREATE NEW</button>
            </Link>
          }
        />
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 60 }} />
                <th>เมนู · ITEM</th>
                <th>หมวด · CAT</th>
                <th style={{ textAlign: "right" }}>ราคา · PRICE</th>
                <th>สถานะ · STATUS</th>
                <th style={{ textAlign: "right" }} />
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td>
                    <ItemSwatch
                      id={it.id}
                      name={it.name}
                      image={it.image}
                      size="xs"
                      className="rounded-lg"
                    />
                  </td>
                  <td style={{ fontWeight: 700 }}>{it.name}</td>
                  <td>
                    <span className="pill" style={{ fontSize: 11 }}>
                      {it.category?.name ?? "—"}
                    </span>
                  </td>
                  <td
                    className="mono"
                    style={{ textAlign: "right", fontWeight: 700, color: "var(--lime)" }}
                  >
                    {formatPrice(it.price)}
                  </td>
                  <td>
                    <div className="row" style={{ gap: 8 }}>
                      <span className={`pill ${statusPill[it.status]}`} style={{ fontSize: 10 }}>
                        {statusLabel[it.status]}
                      </span>
                      <Select
                        dark
                        className="w-36"
                        options={STATUS_OPTIONS.map((o) => ({ id: o.id, label: o.label }))}
                        selectedKey={it.status}
                        onSelectionChange={(k) => changeStatus(it.id, k)}
                      />
                    </div>
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      className="pill"
                      style={{ marginRight: 6, cursor: "pointer" }}
                      onClick={() => openEdit(it.id)}
                    >
                      แก้
                    </button>
                    <button
                      className="pill pill-danger"
                      style={{ cursor: "pointer" }}
                      onClick={() => setDeleteItem(it)}
                    >
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 0 && (
        <div className="row" style={{ justifyContent: "space-between", marginTop: 16 }}>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>
            แสดง {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} จาก {total}
          </span>
          <div className="row" style={{ gap: 6 }}>
            <button
              className="pill"
              style={{ cursor: "pointer", opacity: offset === 0 ? 0.5 : 1 }}
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            >
              ← ก่อนหน้า
            </button>
            <button
              className="pill"
              style={{
                cursor: "pointer",
                opacity: offset + PAGE_SIZE >= total ? 0.5 : 1,
              }}
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
            >
              ถัดไป →
            </button>
          </div>
        </div>
      )}

      <Modal
        isOpen={editId !== null}
        onOpenChange={(open) => !open && closeEdit()}
        className="sm:max-w-2xl !border-[oklch(0.34_0.025_270)] !bg-[oklch(0.24_0.02_270)]"
      >
        <div className="dir-a" style={{ padding: 20, background: "var(--surface)" }}>
          <h2
            className="eyebrow"
            style={{ marginBottom: 14, fontSize: 13, color: "var(--text)" }}
          >
            แก้ไขเมนู · EDIT MENU ITEM
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
        className="!border-[oklch(0.34_0.025_270)] !bg-[oklch(0.24_0.02_270)]"
      >
        <div className="dir-a col" style={{ gap: 16, padding: 20, background: "var(--surface)" }}>
          <div>
            <h2 className="h-2">ลบเมนู? · Delete menu item?</h2>
            <p style={{ marginTop: 4, fontSize: 13, color: "var(--text-3)" }}>
              {deleteItem
                ? `“${deleteItem.name}” will be deleted. This can't be undone.`
                : ""}
            </p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button
              className="btn btn-ghost grow"
              disabled={deleting}
              onClick={() => setDeleteItem(null)}
            >
              ยกเลิก
            </button>
            <button
              className="btn btn-danger grow"
              disabled={deleting}
              onClick={confirmRemove}
            >
              {deleting ? "กำลังลบ…" : "ลบ · Delete"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
