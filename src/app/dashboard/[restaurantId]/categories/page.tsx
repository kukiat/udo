"use client";

import { useEffect, useState, type CSSProperties } from "react";

import { DashboardTableFooter } from "@/components/dashboard/TableFooter";
import { useDashboardTheme } from "@/components/dashboard/DashboardShell";
import { ItemSwatch } from "@/components/menu/ItemSwatch";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { TextInput } from "@/components/ui/TextInput";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { api } from "@/lib/fetcher";

type Category = {
  id: string;
  name: string;
  parentId: string | null;
  isActive: boolean;
  sortOrder: number;
  image: string | null;
};

export default function CategoriesPage() {
  const { restaurantId, loading: ctxLoading } = useRestaurant();
  const theme = useDashboardTheme();
  const isDark = theme === "dark";
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [parentId, setParentId] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = () => {
    if (!restaurantId) return;
    setLoading(true);
    api<{ categories: Category[] }>(
      `/api/categories?restaurantId=${restaurantId}`,
    )
      .then((d) => setCategories(d.categories))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [restaurantId]);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setSortOrder("0");
    setParentId(null);
    setImage(null);
    setIsActive(true);
  };

  const openCreate = () => {
    resetForm();
    setError(null);
    setFormOpen(true);
  };

  const submit = async () => {
    if (!restaurantId || !name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await api(`/api/categories/${editingId}`, {
          method: "PUT",
          body: JSON.stringify({
            name,
            isActive,
            sortOrder: Number(sortOrder),
            parentId,
            image,
          }),
        });
      } else {
        await api("/api/categories", {
          method: "POST",
          body: JSON.stringify({
            restaurantId,
            name,
            sortOrder: Number(sortOrder),
            parentId,
            image,
          }),
        });
      }
      resetForm();
      setFormOpen(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save category");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (c: Category) => {
    setEditingId(c.id);
    setName(c.name);
    setSortOrder(String(c.sortOrder));
    setParentId(c.parentId);
    setImage(c.image);
    setIsActive(c.isActive);
    setError(null);
    setFormOpen(true);
  };

  if (ctxLoading || loading) return <Loading />;

  // Eligible parents: top-level categories other than the one being edited.
  const parentOptions = categories.filter(
    (c) => !c.parentId && c.id !== editingId,
  );
  const nameById = new Map(categories.map((c) => [c.id, c.name]));

  // Display order: each top-level category followed by its sub-categories.
  const bySort = (a: Category, b: Category) =>
    a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
  const ordered: Category[] = [];
  for (const top of categories.filter((c) => !c.parentId).sort(bySort)) {
    ordered.push(top);
    for (const child of categories
      .filter((c) => c.parentId === top.id)
      .sort(bySort)) {
      ordered.push(child);
    }
  }

  return (
    <div className={`max-w-5xl dir-a kds-theme${isDark ? " kds-dark" : ""}`}>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div className="h-display" style={{ fontSize: 44 }}>
            หมวดหมู่
          </div>
          <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>
            CATEGORIES · ใช้กับเมนู และจัดเรียงในลูกค้า
          </div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          ＋ หมวดใหม่ · NEW CATEGORY
        </button>
      </div>

      <Modal
        isOpen={formOpen}
        onOpenChange={(open) => {
          if (!open) {
            resetForm();
            setFormOpen(false);
          }
        }}
        className={"sm:max-w-xl" + (isDark ? " !border-[#23262E] !bg-[#15171C]" : "")}
      >
        <div
          className={`dir-a kds-theme${isDark ? " kds-dark" : ""}`}
          style={{ padding: 24, background: "var(--surface)" }}
        >
          <div className="eyebrow" style={{ marginBottom: 16, fontSize: 13, color: "var(--text)" }}>
            {editingId ? "แก้ไขหมวด · EDIT CATEGORY" : "เพิ่มหมวด · NEW CATEGORY"}
          </div>
          {error && (
            <div style={{ marginBottom: 16 }}>
              <ErrorState message={error} />
            </div>
          )}
          <div className="grid gap-3" style={{ gridTemplateColumns: "1.6fr 100px" }}>
            <div>
              <span className="label">ชื่อ · NAME</span>
              <TextInput
                value={name}
                onChange={setName}
                placeholder="ชื่อหมวดหมู่"
                icon={null}
                type="text"
                width="100%"
                ariaLabel="ชื่อหมวดหมู่"
              />
            </div>
            <div>
              <span className="label">ลำดับ · SORT</span>
              <TextInput
                value={sortOrder}
                onChange={setSortOrder}
                type="number"
                mono
                icon={null}
                width="100%"
                ariaLabel="ลำดับ"
              />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <Select
              dark={isDark}
              label="หมวดแม่ · PARENT"
              options={[
                { id: "", label: "— Top level —" },
                ...parentOptions.map((c) => ({ id: c.id, label: c.name })),
              ]}
              selectedKey={parentId ?? ""}
              onSelectionChange={(k) => setParentId(k ? k : null)}
              placeholder="Top level"
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <ImageUpload
              label="รูปภาพ · IMAGE (optional)"
              value={image}
              onChange={setImage}
            />
          </div>
          {editingId && (
            <div style={{ marginTop: 12 }}>
              <span className="label">STATUS</span>
              <div className="row" style={{ gap: 8 }}>
                <StatusRadio
                  label="Active"
                  selected={isActive}
                  onSelect={() => setIsActive(true)}
                  accent="var(--olive)"
                />
                <StatusRadio
                  label="Inactive"
                  selected={!isActive}
                  onSelect={() => setIsActive(false)}
                  accent="var(--rose)"
                />
              </div>
            </div>
          )}
          <div className="row" style={{ gap: 8, marginTop: 24 }}>
            <button
              className="btn btn-ghost grow"
              onClick={() => {
                resetForm();
                setFormOpen(false);
              }}
            >
              ยกเลิก
            </button>
            <button
              className="btn btn-primary grow"
              onClick={submit}
              disabled={saving || !name.trim()}
            >
              {saving ? "กำลังบันทึก…" : editingId ? "บันทึก · UPDATE" : "＋ เพิ่ม · ADD"}
            </button>
          </div>
        </div>
      </Modal>

      {error && !formOpen && (
        <div style={{ marginBottom: 16 }}>
          <ErrorState message={error} />
        </div>
      )}

      {ordered.length === 0 ? (
        <EmptyState
          title="No categories"
          description="Create your first category to get started."
          action={
            <button className="btn btn-primary" onClick={openCreate}>
              ＋ หมวดใหม่ · NEW CATEGORY
            </button>
          }
        />
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 60 }} />
                <th>หมวด · CATEGORY</th>
                <th>หมวดแม่ · PARENT</th>
                <th style={{ textAlign: "center" }}>ACTIVE</th>
                <th style={{ textAlign: "right" }}>ลำดับ · SORT</th>
                <th style={{ textAlign: "right" }} />
              </tr>
            </thead>
            <tbody>
              {ordered.map((c) => (
                <tr key={c.id} style={{ opacity: c.isActive ? 1 : 0.55 }}>
                  <td>
                    <ItemSwatch
                      id={c.id}
                      name={c.name}
                      image={c.image}
                      size="xs"
                      className="rounded-lg"
                    />
                  </td>
                  <td style={{ fontWeight: 700 }}>
                    {c.parentId && <span style={{ color: "var(--text-3)" }}>↳ </span>}
                    {c.name}
                  </td>
                  <td>
                    <span className="pill" style={{ fontSize: 11 }}>
                      {c.parentId ? (nameById.get(c.parentId) ?? "—") : "หมวดหลัก"}
                    </span>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <span
                      className="pill"
                      style={{
                        fontSize: 11,
                        color: c.isActive ? "var(--olive)" : "var(--text-3)",
                        background: c.isActive ? "var(--olive-soft)" : "var(--line)",
                      }}
                    >
                      {c.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="mono" style={{ textAlign: "right", fontWeight: 700 }}>
                    {c.sortOrder}
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      className="pill"
                      style={iconButtonStyle}
                      onClick={() => startEdit(c)}
                      aria-label="Edit category"
                      title="Edit category"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <DashboardTableFooter
            total={ordered.length}
            noun={ordered.length === 1 ? "category" : "categories"}
          />
        </div>
      )}
    </div>
  );
}

function StatusRadio({
  label,
  selected,
  onSelect,
  accent,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
  accent: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className="
        flex items-center gap-2 pr-0 pl-0 py-2
        border-none bg-transparent
        font-semibold text-[13px] font-sans
        cursor-pointer
        outline-none
      "
      style={{
        color: "var(--ink-2)",
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 10,
        paddingBottom: 10,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 16,
          height: 16,
          borderRadius: 999,
          flexShrink: 0,
          border: `2px solid ${selected ? accent : "var(--line-strong)"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {selected && (
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: accent,
            }}
          />
        )}
      </span>
      {label}
    </button>
  );
}

const iconButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  padding: 0,
  borderRadius: 999,
  border: "1px solid var(--line-strong)",
  background: "transparent",
  color: "var(--ink-2)",
  fontSize: 0,
  cursor: "pointer",
  fontFamily: "inherit",
};
