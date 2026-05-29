"use client";

import { useEffect, useState } from "react";

import { ImageUpload } from "@/components/ui/ImageUpload";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { ErrorState, Loading } from "@/components/ui/States";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { api } from "@/lib/fetcher";

type Category = {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  image: string | null;
};

const HUES = [38, 110, 32, 18, 75, 50, 200, 300];
const MODAL_DARK = "!border-[oklch(0.34_0.025_270)] !bg-[oklch(0.24_0.02_270)]";

export default function CategoriesPage() {
  const { restaurantId, loading: ctxLoading } = useRestaurant();
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
    setError(null);
    setFormOpen(true);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this category?")) return;
    try {
      await api(`/api/categories/${id}`, { method: "DELETE" });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete category");
    }
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
    <div className="max-w-5xl">
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
        className={`sm:max-w-xl ${MODAL_DARK}`}
      >
        <div className="dir-a" style={{ padding: 24, background: "var(--surface)" }}>
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
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ชื่อหมวดหมู่"
              />
            </div>
            <div>
              <span className="label">ลำดับ · SORT</span>
              <input
                className="input mono"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <Select
              dark
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

      <div
        className="grid gap-3.5"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}
      >
        {ordered.map((c, i) => {
          const hue = HUES[i % HUES.length];
          return (
            <div
              key={c.id}
              className="card"
              style={{ padding: 18, position: "relative", overflow: "hidden" }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 4,
                  background: `oklch(0.7 0.18 ${hue})`,
                }}
              />
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
                <span className="eyebrow" style={{ color: `oklch(0.75 0.16 ${hue})` }}>
                  {c.parentId ? "หมวดย่อย" : `หมวด #${String(i + 1).padStart(2, "0")}`}
                </span>
              </div>
              <div className="h-2">
                {c.parentId && <span style={{ color: "var(--text-3)" }}>↳ </span>}
                {c.name}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-3)",
                  marginTop: 2,
                  marginBottom: 14,
                }}
              >
                {c.parentId
                  ? `ใน ${nameById.get(c.parentId) ?? "—"}`
                  : `ลำดับ ${c.sortOrder}`}
              </div>
              <div className="row" style={{ justifyContent: "flex-end", gap: 6 }}>
                <button
                  className="pill"
                  style={{ cursor: "pointer" }}
                  onClick={() => startEdit(c)}
                >
                  แก้ไข
                </button>
                <button
                  className="pill pill-danger"
                  style={{ cursor: "pointer" }}
                  onClick={() => remove(c.id)}
                >
                  ลบ
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="row"
        style={{
          justifyContent: "flex-end",
          marginTop: 16,
          fontSize: 12,
          color: "var(--text-3)",
        }}
      >
        {ordered.length} หมวดทั้งหมด · {ordered.length} categories total
      </div>
    </div>
  );
}
