"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";

import {
  MenuItemForm,
  type MenuItemFormValues,
} from "@/components/dashboard/MenuItemForm";
import { DashboardTableFooter } from "@/components/dashboard/TableFooter";
import { useDashboardTheme } from "@/components/dashboard/DashboardShell";
import { ItemSwatch } from "@/components/menu/ItemSwatch";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { TextInput } from "@/components/ui/TextInput";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { usePageTitle } from "@/hooks/usePageTitle";
import { api } from "@/lib/fetcher";
import { toMenuItemPayload } from "@/lib/menu-form";
import { formatPrice } from "@/lib/utils";
import type { MenuItemStatus } from "@/types";
import { PillButton } from "@/components/ui/PillButton";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";

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

const PAGE_SIZE = 12;

const CREATE_FORM_ID = "menu-item-create-form";
const EDIT_FORM_ID = "menu-item-edit-form";

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
  width: 28,
  height: 28,
  padding: 0,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
} satisfies CSSProperties;

const STATUSES: MenuItemStatus[] = ["available", "sold_out", "hidden"];

const statusLabel: Record<MenuItemStatus, string> = {
  available: "Available",
  sold_out: "Sold out",
  hidden: "Hidden",
};

// Solid backgrounds for the badge overlaid on card photos (translucent
// pills are unreadable over imagery).
const statusOverlayStyle: Record<MenuItemStatus, CSSProperties> = {
  available: {
    background: "var(--olive-soft)",
    borderColor: "var(--olive)",
    color: "var(--olive)",
  },
  sold_out: {
    background: "var(--amber-soft)",
    borderColor: "var(--amber)",
    color: "#9a5b14",
  },
  hidden: {
    background: "var(--bg-elev)",
    borderColor: "var(--line)",
    color: "var(--text-3)",
  },
};

const STATUS_OPTIONS = STATUSES.map((s) => ({ id: s, label: statusLabel[s] }));

const ALL_CATEGORIES = "__all__";

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
  const loadedOnce = useRef(false);

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<MenuItemStatus | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<MenuItemFormValues | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [deleteItem, setDeleteItem] = useState<MenuItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [statusSaving, setStatusSaving] = useState<string | null>(null);

  const hasFilters = query !== "" || categoryFilter !== null || statusFilter !== null;

  const load = () => {
    if (!restaurantId) return;
    if (!loadedOnce.current) setLoading(true);
    const params = new URLSearchParams({
      restaurantId,
      offset: String(offset),
      limit: String(PAGE_SIZE),
    });
    if (query) params.set("q", query);
    if (categoryFilter) params.set("categoryId", categoryFilter);
    if (statusFilter) params.set("status", statusFilter);
    Promise.all([
      api<{ items: MenuItem[]; total: number }>(`/api/menu?${params}`),
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
      .finally(() => {
        loadedOnce.current = true;
        setLoading(false);
      });
  };

  useEffect(load, [restaurantId, offset, query, categoryFilter, statusFilter]);

  // Debounce the search box into the query that hits the API.
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setOffset(0);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const setFilters = (category: string | null, status: MenuItemStatus | null) => {
    setCategoryFilter(category);
    setStatusFilter(status);
    setOffset(0);
  };

  const clearFilters = () => {
    setSearch("");
    setQuery("");
    setFilters(null, null);
  };

  const quickStatus = async (item: MenuItem, status: MenuItemStatus) => {
    if (status === item.status) return;
    const prev = items;
    setStatusSaving(item.id);
    setItems((list) =>
      list.map((it) => (it.id === item.id ? { ...it, status } : it)),
    );
    try {
      await api(`/api/menu/${item.id}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      // Re-sync so items falling out of an active status filter drop off.
      if (statusFilter) load();
    } catch (e) {
      setItems(prev);
      setError(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setStatusSaving(null);
    }
  };

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

      <div
        className="row"
        style={{ gap: 10, marginBottom: 18, flexWrap: "wrap" }}
      >
        <div style={{ flex: "1 1 220px", maxWidth: 320 }}>
          <TextInput
            value={search}
            onChange={setSearch}
            placeholder="Search menu items..."
            ariaLabel="Search menu items"
            width="100%"
          />
        </div>
        <Select
          aria-label="Filter by category"
          options={[
            { id: ALL_CATEGORIES, label: "All categories" },
            ...categories.map((c) => ({ id: c.id, label: c.name })),
          ]}
          selectedKey={categoryFilter ?? ALL_CATEGORIES}
          onSelectionChange={(k) =>
            setFilters(k === ALL_CATEGORIES ? null : k, statusFilter)
          }
          dark={isDark}
        />
        <div className="row" style={{ gap: 6 }}>
          <button
            className={`pill${statusFilter === null ? " pill-on" : ""}`}
            style={{ height: 30, cursor: "pointer" }}
            onClick={() => setFilters(categoryFilter, null)}
          >
            All
          </button>
          {STATUSES.map((s) => (
            <button
              key={s}
              className={`pill${statusFilter === s ? " pill-on" : ""}`}
              style={{ height: 30, cursor: "pointer" }}
              onClick={() => setFilters(categoryFilter, s)}
            >
              {statusLabel[s]}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 16 }}>
          <ErrorState message={error} onRetry={load} />
        </div>
      )}

      {items.length === 0 ? (
        hasFilters ? (
          <EmptyState
            title="No matching items"
            description="No menu items match your search or filters."
            action={
              <button className="btn btn-ghost" onClick={clearFilters}>
                Clear filters
              </button>
            }
          />
        ) : (
          <EmptyState
            title="No menu items"
            description="Create your first menu item to get started."
            action={
              <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>
                Create new
              </button>
            }
          />
        )
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((it) => (
              <div
                key={it.id}
                className="card col"
                style={{ overflow: "hidden" }}
              >
                <div
                  style={{
                    position: "relative",
                    aspectRatio: "4 / 3",
                    background: "var(--bg-sunken)",
                    opacity: it.status === "hidden" ? 0.55 : 1,
                    filter: it.status === "sold_out" ? "grayscale(0.6)" : undefined,
                  }}
                >
                  <ItemSwatch
                    id={it.id}
                    name={it.name}
                    image={it.image}
                    size="lg"
                    className="absolute inset-0"
                  />
                  <span
                    className="pill"
                    style={{
                      ...statusOverlayStyle[it.status],
                      position: "absolute",
                      top: 8,
                      left: 8,
                      fontSize: 10,
                    }}
                  >
                    {statusLabel[it.status]}
                  </span>
                </div>
                <div className="col grow" style={{ gap: 8, padding: 10 }}>
                  <div className="row" style={{ justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                    <div style={{ minWidth: 0, fontSize: 14, fontWeight: 600, lineHeight: 1.25 }}>
                      {it.name}
                    </div>
                    <div
                      className="mono"
                      style={{ fontSize: 13, fontWeight: 700, color: "var(--olive)", whiteSpace: "nowrap" }}
                    >
                      {formatPrice(it.price)}
                    </div>
                  </div>
                  <div>
                    <span className="pill" style={{ fontSize: 10 }}>
                      {it.category?.name ?? "—"}
                    </span>
                  </div>
                  <div
                    className="row"
                    style={{ justifyContent: "space-between", gap: 8, marginTop: "auto" }}
                  >
                    <div style={{ opacity: statusSaving === it.id ? 0.5 : 1 }}>
                      <Select
                        aria-label={`Status of ${it.name}`}
                        options={STATUS_OPTIONS}
                        selectedKey={it.status}
                        onSelectionChange={(k) =>
                          k && quickStatus(it, k as MenuItemStatus)
                        }
                        dark={isDark}
                      />
                    </div>
                    <div className="row" style={{ gap: 6 }}>
                      <button
                        className="pill"
                        style={iconButtonStyle}
                        onClick={() => openEdit(it.id)}
                        aria-label={`Edit menu item ${it.name}`}
                        title="Edit"
                      >
                        <PencilIcon style={{ width: 13, height: 13 }} />
                      </button>
                      <button
                        className="pill pill-danger"
                        style={iconButtonStyle}
                        onClick={() => setDeleteItem(it)}
                        aria-label={`Delete menu item ${it.name}`}
                        title="Delete"
                      >
                        <Trash2Icon style={{ width: 13, height: 13 }} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="card" style={{ overflow: "hidden", marginTop: 16 }}>
            <div style={{ marginTop: -1 }}>
              <DashboardTableFooter
                page={page}
                pageCount={pageCount}
                total={total}
                pageSize={PAGE_SIZE}
                noun="menu items"
                onChange={(next) => setOffset((next - 1) * PAGE_SIZE)}
              />
            </div>
          </div>
        </>
      )}

      <Modal
        isOpen={createOpen}
        onOpenChange={(open) => !open && setCreateOpen(false)}
        theme={isDark ? "dark" : "light"}
        className="sm:max-w-2xl dir-a"
        header={
          <ItemModalHeader eyebrow="Menu items" heading="New menu item">
            Add details, pricing and option groups
          </ItemModalHeader>
        }
        footer={
          <ItemModalFooter
            formId={CREATE_FORM_ID}
            submitting={submitting}
            submitLabel={submitting ? "Creating..." : "Create item"}
            onCancel={() => setCreateOpen(false)}
          />
        }
      >
        <div style={{ padding: "18px 20px", background: "var(--surface)" }}>
          <MenuItemForm
            formId={CREATE_FORM_ID}
            variant="flat"
            hideSubmit
            dark={isDark}
            defaultValues={EMPTY}
            categories={categories}
            stations={stations}
            submitting={submitting}
            onSubmit={submitCreate}
          />
        </div>
      </Modal>

      <Modal
        isOpen={editId !== null}
        onOpenChange={(open) => !open && closeEdit()}
        theme={isDark ? "dark" : "light"}
        className="sm:max-w-2xl dir-a"
        header={
          <ItemModalHeader
            eyebrow="Edit menu item"
            heading={editValues?.name || "Loading..."}
          >
            Changes apply to all branches unless overridden
          </ItemModalHeader>
        }
        footer={
          <ItemModalFooter
            formId={EDIT_FORM_ID}
            submitting={submitting}
            disabled={editLoading || !editValues}
            submitLabel={submitting ? "Saving..." : "Save changes"}
            onCancel={closeEdit}
          />
        }
      >
        <div style={{ padding: "18px 20px", background: "var(--surface)" }}>
          {editLoading || !editValues ? (
            <div style={{ padding: "48px 0" }}>
              <Loading />
            </div>
          ) : (
            <MenuItemForm
              formId={EDIT_FORM_ID}
              variant="flat"
              hideSubmit
              dark={isDark}
              defaultValues={editValues}
              categories={categories}
              stations={stations}
              submitting={submitting}
              onSubmit={submitEdit}
            />
          )}
        </div>
      </Modal>

      <Modal
        isOpen={deleteItem !== null}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        theme={isDark ? "dark" : "light"}
        className="dir-a"
        header={
          <div>
            <h2 className="h-2">Delete menu item?</h2>
            <p style={{ marginTop: 4, fontSize: 13, color: "var(--text-3)" }}>
              {deleteItem
                ? `“${deleteItem.name}” will be deleted. This can't be undone.`
                : ""}
            </p>
          </div>
        }
        footer={
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
        }
      >
        <span className="sr-only">
          Confirm deleting this menu item. This can&apos;t be undone.
        </span>
      </Modal>
    </div>
  );
}

// Eyebrow + heading + one-line hint for the create/edit item modals, matching
// the RestaurantFormModal header look.
function ItemModalHeader({
  eyebrow,
  heading,
  children,
}: {
  eyebrow: string;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="eyebrow">{eyebrow}</div>
      <h2
        style={{
          fontSize: 20,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          marginTop: 2,
          color: "var(--text)",
        }}
      >
        {heading}
      </h2>
      <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 2 }}>
        {children}
      </div>
    </div>
  );
}

// Pinned modal footer: Cancel + a native submit button targeting the form by
// id, so it works while the form itself scrolls in the modal body.
function ItemModalFooter({
  formId,
  submitting,
  disabled = false,
  submitLabel,
  onCancel,
}: {
  formId: string;
  submitting: boolean;
  disabled?: boolean;
  submitLabel: string;
  onCancel: () => void;
}) {
  const blocked = submitting || disabled;
  return (
    <div className="row" style={{ gap: 8 }}>
      <button
        type="button"
        className="btn btn-ghost"
        style={{
          flex: 1,
          opacity: submitting ? 0.5 : 1,
          cursor: submitting ? "not-allowed" : "pointer",
        }}
        disabled={submitting}
        onClick={onCancel}
      >
        Cancel
      </button>
      <button
        type="submit"
        form={formId}
        className="btn btn-primary"
        style={{
          flex: 2,
          opacity: blocked ? 0.6 : 1,
          cursor: blocked ? "not-allowed" : "pointer",
        }}
        disabled={blocked}
      >
        {submitLabel}
      </button>
    </div>
  );
}
