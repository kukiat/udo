"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { TD, TH, THead, TR, Table } from "@/components/ui/Table";
import {
  useRestaurant,
  type BranchSummary,
} from "@/contexts/RestaurantContext";
import { api } from "@/lib/fetcher";

const NUM_FIELD =
  "w-28 rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-clay-300 focus:ring-2 focus:ring-clay-100";

export default function BranchesPage() {
  const { restaurantId, branches, loading, refresh } = useRestaurant();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [maxKds, setMaxKds] = useState("3");
  const [vat, setVat] = useState("7");
  const [service, setService] = useState("0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setAddress("");
    setMaxKds("3");
    setVat("7");
    setService("0");
  };

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    const settings = {
      maxKdsScreens: Number(maxKds),
      vatRate: Number(vat) / 100,
      serviceChargeRate: Number(service) / 100,
    };
    try {
      if (editingId) {
        await api(`/api/branches/${editingId}`, {
          method: "PUT",
          body: JSON.stringify({
            name,
            address: address.trim() || null,
            settings,
          }),
        });
      } else {
        await api("/api/branches", {
          method: "POST",
          body: JSON.stringify({
            restaurantId,
            name,
            address: address.trim() || null,
            settings,
          }),
        });
      }
      resetForm();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save branch");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (b: BranchSummary) => {
    setEditingId(b.id);
    setName(b.name);
    setAddress(b.address ?? "");
    setMaxKds(String(b.settings.maxKdsScreens));
    setVat(String(Math.round(b.settings.vatRate * 100)));
    setService(String(Math.round(b.settings.serviceChargeRate * 100)));
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this branch?")) return;
    setError(null);
    try {
      await api(`/api/branches/${id}`, { method: "DELETE" });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete branch");
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-ink">Branches</h1>

      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-card border border-line bg-white p-4 shadow-card">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink-soft">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Branch name"
            className="w-48 rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-clay-300 focus:ring-2 focus:ring-clay-100"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink-soft">Address</span>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Optional"
            className="w-56 rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-clay-300 focus:ring-2 focus:ring-clay-100"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink-soft">Max KDS</span>
          <input
            type="number"
            min={1}
            value={maxKds}
            onChange={(e) => setMaxKds(e.target.value)}
            className={NUM_FIELD}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink-soft">VAT %</span>
          <input
            type="number"
            min={0}
            value={vat}
            onChange={(e) => setVat(e.target.value)}
            className={NUM_FIELD}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink-soft">Service %</span>
          <input
            type="number"
            min={0}
            value={service}
            onChange={(e) => setService(e.target.value)}
            className={NUM_FIELD}
          />
        </label>
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
        {branches.length === 0 ? (
          <EmptyState
            title="No branches yet"
            description="Add the first branch for this restaurant above."
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Address</TH>
                <TH className="w-20">Max KDS</TH>
                <TH className="w-16">VAT</TH>
                <TH className="w-20">Service</TH>
                <TH className="w-40 text-right">Actions</TH>
              </TR>
            </THead>
            <tbody>
              {branches.map((b) => (
                <TR key={b.id}>
                  <TD className="font-medium text-ink">{b.name}</TD>
                  <TD className="text-ink-muted">{b.address ?? "—"}</TD>
                  <TD>{b.settings.maxKdsScreens}</TD>
                  <TD>{Math.round(b.settings.vatRate * 100)}%</TD>
                  <TD>{Math.round(b.settings.serviceChargeRate * 100)}%</TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onPress={() => startEdit(b)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onPress={() => remove(b.id)}
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
  );
}
