"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { CreateRestaurantModal } from "@/components/dashboard/CreateRestaurantModal";
import { TopBar } from "@/components/dashboard/TopBar";
import { Button } from "@/components/ui/Button";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { TD, TH, THead, TR, Table } from "@/components/ui/Table";
import { api } from "@/lib/fetcher";

type Restaurant = {
  id: string;
  name: string;
  logo: string | null;
  branches: { id: string }[];
};

export default function DashboardHome() {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [logo, setLogo] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<Restaurant | null>(null);
  const [removing, setRemoving] = useState(false);

  const load = () => {
    setLoading(true);
    api<{ restaurants: Restaurant[] }>("/api/restaurants?withBranches=true")
      .then((d) => setRestaurants(d.restaurants))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setLogo("");
  };

  const saveEdit = async () => {
    if (!editingId || !name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api(`/api/restaurants/${editingId}`, {
        method: "PUT",
        body: JSON.stringify({ name, logo: logo.trim() || null }),
      });
      resetForm();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save restaurant");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (r: Restaurant) => {
    setEditingId(r.id);
    setName(r.name);
    setLogo(r.logo ?? "");
  };

  const confirmRemove = async () => {
    if (!deleting) return;
    setRemoving(true);
    setError(null);
    try {
      await api(`/api/restaurants/${deleting.id}`, { method: "DELETE" });
      setDeleting(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete restaurant");
    } finally {
      setRemoving(false);
    }
  };

  const topBar = (
    <TopBar
      left={<span className="text-sm font-semibold text-ink">Restaurants</span>}
    />
  );

  if (loading) {
    return (
      <>
        {topBar}
        <Loading />
      </>
    );
  }

  return (
    <>
      {topBar}
      <div className="mx-auto max-w-3xl p-5 md:p-8">
        <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Restaurants</h1>
          <p className="text-ink-muted">
            Create a restaurant, then open it to manage branches, categories,
            and menu.
          </p>
        </div>
        <Button onPress={() => setCreating(true)}>New restaurant</Button>
      </div>

      <CreateRestaurantModal
        isOpen={creating}
        onOpenChange={setCreating}
        onCreated={(id) => {
          setCreating(false);
          router.push(`/dashboard/${id}`);
        }}
      />

      <Modal
        isOpen={editingId !== null}
        onOpenChange={(open) => {
          if (!open) resetForm();
        }}
      >
        <div className="p-5">
          <h2 className="text-lg font-bold text-ink">Edit restaurant</h2>
          <label className="mt-4 flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-soft">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Restaurant name"
              className="rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-clay-300 focus:ring-2 focus:ring-clay-100"
            />
          </label>
          <div className="mt-4">
            <ImageUpload
              label="Logo"
              value={logo || null}
              onChange={(u) => setLogo(u ?? "")}
            />
          </div>
          <div className="mt-6 flex gap-2">
            <Button
              variant="ghost"
              className="flex-1 border border-gray-300 bg-gray-200 hover:bg-gray-300"
              onPress={resetForm}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onPress={saveEdit}
              isDisabled={saving || !name.trim()}
            >
              Update
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <div className="p-5">
          <h2 className="text-lg font-bold text-ink">Delete restaurant</h2>
          <p className="mt-3 text-sm text-ink-soft">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-ink">{deleting?.name}</span>?
            This cannot be undone.
          </p>
          <div className="mt-6 flex gap-2">
            <Button
              variant="ghost"
              className="flex-1 border border-gray-300 bg-gray-200 hover:bg-gray-300"
              onPress={() => setDeleting(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onPress={confirmRemove}
              isDisabled={removing}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      {error && (
        <div className="mt-4">
          <ErrorState message={error} />
        </div>
      )}

      <div className="mt-4">
        {restaurants.length === 0 ? (
          <EmptyState
            title="No restaurants yet"
            description="Create your first restaurant to get started."
            action={
              <Button onPress={() => setCreating(true)}>New restaurant</Button>
            }
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH className="w-24">Branches</TH>
                <TH className="w-56 text-right">Actions</TH>
              </TR>
            </THead>
            <tbody>
              {restaurants.map((r) => (
                <TR key={r.id}>
                  <TD className="font-medium text-ink">
                    <Link
                      href={`/dashboard/${r.id}`}
                      className="hover:text-clay-700 hover:underline"
                    >
                      {r.name}
                    </Link>
                  </TD>
                  <TD>{r.branches.length}</TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/dashboard/${r.id}`}>
                        <Button size="sm">Manage</Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="secondary"
                        onPress={() => startEdit(r)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onPress={() => setDeleting(r)}
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
      </div>
      </div>
    </>
  );
}
