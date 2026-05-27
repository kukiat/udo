"use client";

import { useEffect, useState } from "react";

import { ItemSwatch } from "@/components/menu/ItemSwatch";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { TD, TH, THead, TR, Table } from "@/components/ui/Table";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { api } from "@/lib/fetcher";
import { formatPrice } from "@/lib/utils";

type Row = {
  menuItemId: string;
  name: string;
  image: string | null;
  categoryName: string | null;
  basePrice: string;
  isAvailable: boolean;
  overridePrice: string | null;
};

export default function BranchMenuPage() {
  const { branchId, branchName, loading: ctxLoading } = useRestaurant();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = () => {
    if (!branchId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    api<{ items: Row[] }>(`/api/branch-menu?branchId=${branchId}`)
      .then((d) => setRows(d.items))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [branchId]);

  const update = (menuItemId: string, patch: Partial<Row>) => {
    setSaved(false);
    setRows((prev) =>
      prev.map((r) => (r.menuItemId === menuItemId ? { ...r, ...patch } : r)),
    );
  };

  const save = async () => {
    if (!branchId) return;
    setSaving(true);
    setError(null);
    try {
      await api("/api/branch-menu", {
        method: "PUT",
        body: JSON.stringify({
          branchId,
          items: rows.map((r) => ({
            menuItemId: r.menuItemId,
            isAvailable: r.isAvailable,
            price: r.overridePrice ?? "",
          })),
        }),
      });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save overrides");
    } finally {
      setSaving(false);
    }
  };

  if (ctxLoading || loading) return <Loading />;

  if (!branchId) {
    return (
      <div className="max-w-4xl">
        <h1 className="text-2xl font-bold text-ink">Branch Menu Overrides</h1>
        <div className="mt-4">
          <EmptyState
            title="No branch selected"
            description="Create a branch for this restaurant, then pick it from the sidebar."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Branch Menu Overrides</h1>
          <p className="text-sm text-ink-muted">
            {branchName} · toggle availability and set branch-specific prices.
            Leave price blank to use the master price.
          </p>
        </div>
        <Button onPress={save} isDisabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>

      {saved && <p className="mt-3 text-sm text-green-700">Overrides saved.</p>}
      {error && (
        <div className="mt-3">
          <ErrorState message={error} onRetry={load} />
        </div>
      )}

      <div className="mt-4">
        {rows.length === 0 ? (
          <EmptyState title="No menu items" description="Create menu items first." />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH className="w-16">Image</TH>
                <TH>Item</TH>
                <TH>Category</TH>
                <TH className="w-28">Base price</TH>
                <TH className="w-36">Available</TH>
                <TH className="w-40">Override price</TH>
              </TR>
            </THead>
            <tbody>
              {rows.map((r) => (
                <TR key={r.menuItemId}>
                  <TD>
                    <ItemSwatch
                      id={r.menuItemId}
                      name={r.name}
                      image={r.image}
                      size="xs"
                      className="rounded-lg"
                    />
                  </TD>
                  <TD className="font-medium text-ink">{r.name}</TD>
                  <TD className="text-ink-muted">{r.categoryName ?? "—"}</TD>
                  <TD>{formatPrice(r.basePrice)}</TD>
                  <TD>
                    <Switch
                      isSelected={r.isAvailable}
                      onChange={(v) => update(r.menuItemId, { isAvailable: v })}
                    >
                      {r.isAvailable ? "On" : "Off"}
                    </Switch>
                  </TD>
                  <TD>
                    <input
                      value={r.overridePrice ?? ""}
                      onChange={(e) =>
                        update(r.menuItemId, {
                          overridePrice: e.target.value || null,
                        })
                      }
                      placeholder={r.basePrice}
                      inputMode="decimal"
                      className="w-28 rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-clay-300"
                    />
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
