"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { ErrorState, Loading } from "@/components/ui/States";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { api } from "@/lib/fetcher";

export default function RestaurantOverviewPage() {
  const {
    loading,
    error,
    restaurantId,
    restaurantName,
    restaurantLogo,
    branches,
    branchName,
    settings,
    refresh,
  } = useRestaurant();

  const [name, setName] = useState("");
  const [logo, setLogo] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setName(restaurantName ?? "");
    setLogo(restaurantLogo ?? "");
  }, [restaurantName, restaurantLogo]);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      await api(`/api/restaurants/${restaurantId}`, {
        method: "PUT",
        body: JSON.stringify({ name, logo: logo.trim() || null }),
      });
      await refresh();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-ink">Restaurant settings</h1>

      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-card border border-line bg-white p-4 shadow-card">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink-soft">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-56 rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-clay-300 focus:ring-2 focus:ring-clay-100"
          />
        </label>
        <ImageUpload
          label="Logo"
          className="w-64"
          value={logo || null}
          onChange={(u) => setLogo(u ?? "")}
        />
        <Button onPress={save} isDisabled={saving || !name.trim()}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
      {saveError && (
        <div className="mt-3">
          <ErrorState message={saveError} />
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Branches" value={String(branches.length)} />
        <Stat
          label="Active branch"
          value={branchName ?? "—"}
        />
        <Stat
          label="VAT rate"
          value={`${((settings?.vatRate ?? 0) * 100).toFixed(0)}%`}
        />
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href={`/dashboard/${restaurantId}/branches`}>
          <Button variant="secondary">Manage branches</Button>
        </Link>
        <Link href={`/dashboard/${restaurantId}/categories`}>
          <Button variant="secondary">Manage categories</Button>
        </Link>
        <Link href={`/dashboard/${restaurantId}/menu/create`}>
          <Button>Create menu item</Button>
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-line bg-white p-4 shadow-card">
      <p className="text-xs uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}
