"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { Select } from "@/components/ui/Select";
import { ErrorState, Loading } from "@/components/ui/States";
import { TD, TH, THead, TR, Table } from "@/components/ui/Table";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { api } from "@/lib/fetcher";

type Category = {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  image: string | null;
};

export default function CategoriesPage() {
  const { restaurantId, loading: ctxLoading } = useRestaurant();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // inline form state
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
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-ink">Categories</h1>

      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-card border border-line bg-white p-4 shadow-card">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink-soft">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Category name"
            className="w-56 rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-clay-300 focus:ring-2 focus:ring-clay-100"
          />
        </label>
        <Select
          label="Parent (optional)"
          className="w-48"
          options={[
            { id: "", label: "— Top level —" },
            ...parentOptions.map((c) => ({ id: c.id, label: c.name })),
          ]}
          selectedKey={parentId ?? ""}
          onSelectionChange={(k) => setParentId(k ? k : null)}
          placeholder="Top level"
        />
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink-soft">Sort order</span>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="w-24 rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-clay-300 focus:ring-2 focus:ring-clay-100"
          />
        </label>
        <ImageUpload
          label="Image (optional)"
          className="w-full"
          value={image}
          onChange={setImage}
        />
        <Button onPress={submit} isDisabled={saving || !name.trim()}>
          {editingId ? "Update" : "Add"}
        </Button>
        {editingId && (
          <Button variant="ghost" onPress={resetForm}>
            Cancel
          </Button>
        )}
      </div>

      {error && (
        <div className="mt-4">
          <ErrorState message={error} />
        </div>
      )}

      <div className="mt-4">
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH className="w-40">Parent</TH>
              <TH className="w-20">Sort</TH>
              <TH className="w-40 text-right">Actions</TH>
            </TR>
          </THead>
          <tbody>
            {ordered.map((c) => (
              <TR key={c.id}>
                <TD className="font-medium text-ink">
                  {c.parentId && <span className="text-ink-muted">↳ </span>}
                  {c.name}
                </TD>
                <TD className="text-ink-soft">
                  {c.parentId ? nameById.get(c.parentId) ?? "—" : "—"}
                </TD>
                <TD>{c.sortOrder}</TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="secondary" onPress={() => startEdit(c)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="danger" onPress={() => remove(c.id)}>
                      Delete
                    </Button>
                  </div>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
