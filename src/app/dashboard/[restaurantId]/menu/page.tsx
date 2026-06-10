"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

import {
  MenuItemForm,
  type MenuItemFormValues,
} from "@/components/dashboard/MenuItemForm";
import { DashboardTableFooter } from "@/components/dashboard/TableFooter";
import { useDashboardTheme } from "@/components/dashboard/DashboardShell";
import { ItemSwatch } from "@/components/menu/ItemSwatch";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { usePageTitle } from "@/hooks/usePageTitle";
import { api } from "@/lib/fetcher";
import { toMenuItemPayload } from "@/lib/menu-form";
import { formatPrice } from "@/lib/utils";
import type { MenuItemStatus } from "@/types";
import { PillButton } from "@/components/ui/PillButton";
import { PlusIcon } from "lucide-react";

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

const iconButtonStyle = {
  width: 34,
  height: 34,
  padding: 0,
  marginRight: 6,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
} satisfies CSSProperties;

const iconDangerButtonStyle = {
  ...iconButtonStyle,
  marginRight: 0,
} satisfies CSSProperties;

const statusLabel: Record<MenuItemStatus, string> = {
  available: "Available",
  sold_out: "Sold out",
  hidden: "Hidden",
};

const statusStyle: Record<MenuItemStatus, CSSProperties> = {
  available: {
    background: "rgba(124, 138, 78, 0.16)",
    borderColor: "rgba(124, 138, 78, 0.32)",
    color: "var(--olive)",
  },
  sold_out: {
    background: "rgba(201, 138, 60, 0.16)",
    borderColor: "rgba(201, 138, 60, 0.36)",
    color: "#9a5b14",
  },
  hidden: {
    background: "var(--bg-elev)",
    borderColor: "var(--line)",
    color: "var(--text-3)",
  },
};

function EditIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  );
}

export default function MenuListPage() {
  usePageTitle("Menu items");
  const { restaurantId, stations, loading: ctxLoading } = useRestaurant();
  const theme = useDashboardTheme();
  const isDark = theme === "dark";
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
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

  const submitCreate = async (v: MenuItemFormValues) => {
    if (!restaurantId) return;
    setSubmitting(true);
    setError(null);
    try {
      await api("/api/menu", {
        method: "POST",
        body: JSON.stringify({
          restaurantId,
          ...toMenuItemPayload(v),
        }),
      });
      setCreateOpen(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create item");
    } finally {
      setSubmitting(false);
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

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className={`max-w-5xl dir-a kds-theme${isDark ? " kds-dark" : ""}`}>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div className="h-display" style={{ fontSize: 44 }}>
            Menu Items
          </div>
          <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>
            MENU ITEMS - {total} items
          </div>
        </div>
        <PillButton tone="accent" onClick={() => setCreateOpen(true)}>
          <PlusIcon className="w-4 h-4" />
          New menu
        </PillButton>
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
            <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>
              Create new
            </button>
          }
        />
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 96 }} />
                <th>Item</th>
                <th>Category</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Price</th>
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
                      size="sm"
                      className="rounded-xl"
                    />
                  </td>
                  <td style={{ fontWeight: 700 }}>{it.name}</td>
                  <td>
                    <span className="pill" style={{ fontSize: 11 }}>
                      {it.category?.name ?? "—"}
                    </span>
                  </td>
                  <td>
                    <span
                      className="pill"
                      style={{ ...statusStyle[it.status], fontSize: 11 }}
                    >
                      {statusLabel[it.status]}
                    </span>
                  </td>
                  <td
                    className="mono"
                    style={{ textAlign: "right", fontWeight: 700, color: "var(--olive)" }}
                  >
                    {formatPrice(it.price)}
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      className="pill"
                      style={iconButtonStyle}
                      onClick={() => openEdit(it.id)}
                      aria-label={`Edit menu item ${it.name}`}
                      title="Edit"
                    >
                      <EditIcon />
                    </button>
                    <button
                      className="pill pill-danger"
                      style={iconDangerButtonStyle}
                      onClick={() => setDeleteItem(it)}
                      aria-label={`Delete menu item ${it.name}`}
                      title="Delete"
                    >
                      <TrashIcon />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <DashboardTableFooter
            page={page}
            pageCount={pageCount}
            total={total}
            pageSize={PAGE_SIZE}
            noun="menu items"
            onChange={(next) => setOffset((next - 1) * PAGE_SIZE)}
          />
        </div>
      )}

      <Modal
        isOpen={createOpen}
        onOpenChange={(open) => !open && setCreateOpen(false)}
        className={`sm:max-w-2xl dir-a kds-theme${isDark ? " kds-dark" : ""}`}
        header={
          <h2 className="eyebrow" style={{ fontSize: 13, color: "var(--text)" }}>
            New menu item
          </h2>
        }
      >
        <div
          className={`dir-a kds-theme${isDark ? " kds-dark" : ""}`}
          style={{ padding: 20, background: "var(--surface)" }}
        >
          <MenuItemForm
            defaultValues={EMPTY}
            categories={categories}
            stations={stations}
            submitting={submitting}
            onSubmit={submitCreate}
            stickyFooter
          />
        </div>
      </Modal>

      <Modal
        isOpen={editId !== null}
        onOpenChange={(open) => !open && closeEdit()}
        className={`sm:max-w-2xl dir-a kds-theme${isDark ? " kds-dark" : ""}`}
        header={
          <h2
            className="eyebrow"
            style={{ fontSize: 13, color: "var(--text)" }}
          >
            Edit menu item
          </h2>
        }
      >
        <div
          className={`dir-a kds-theme${isDark ? " kds-dark" : ""}`}
          style={{ padding: 20, background: "var(--surface)" }}
        >
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
        className={isDark ? "!border-[#23262E] !bg-[#15171C]" : undefined}
      >
        <div
          className={`dir-a col kds-theme${isDark ? " kds-dark" : ""}`}
          style={{ gap: 16, padding: 20, background: "var(--surface)" }}
        >
          <div>
            <h2 className="h-2">Delete menu item?</h2>
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
              Cancel
            </button>
            <button
              className="btn btn-danger grow"
              disabled={deleting}
              onClick={confirmRemove}
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
