"use client";

import { useState } from "react";

import { Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import {
  useRestaurant,
  type BranchSummary,
} from "@/contexts/RestaurantContext";
import { api } from "@/lib/fetcher";

const MODAL_DARK = "!border-[oklch(0.34_0.025_270)] !bg-[oklch(0.24_0.02_270)]";

export default function BranchesPage() {
  const { restaurantId, branches, loading, refresh } = useRestaurant();

  const [formOpen, setFormOpen] = useState(false);
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

  const openCreate = () => {
    resetForm();
    setError(null);
    setFormOpen(true);
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
      setFormOpen(false);
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
    setError(null);
    setFormOpen(true);
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
    <div className="max-w-5xl">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div className="h-display" style={{ fontSize: 44 }}>
            สาขา
          </div>
          <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>
            BRANCHES · จัดการสาขาของร้าน
          </div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          ＋ สาขาใหม่ · NEW BRANCH
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
        className={`sm:max-w-2xl ${MODAL_DARK}`}
      >
        <div className="dir-a" style={{ padding: 24, background: "var(--surface)" }}>
          <div className="eyebrow" style={{ marginBottom: 16, fontSize: 13, color: "var(--text)" }}>
            {editingId ? "แก้ไขสาขา · EDIT BRANCH" : "เพิ่มสาขา · NEW BRANCH"}
          </div>
          {error && (
            <div style={{ marginBottom: 16 }}>
              <ErrorState message={error} />
            </div>
          )}
          <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div>
              <span className="label">ชื่อสาขา · NAME</span>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder='เช่น "สาขาทองหล่อ"'
              />
            </div>
            <div>
              <span className="label">ที่อยู่ · ADDRESS</span>
              <input
                className="input"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="ไม่บังคับ"
              />
            </div>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginTop: 12 }}>
            <div>
              <span className="label">KDS สูงสุด</span>
              <input
                className="input mono"
                type="number"
                min={1}
                value={maxKds}
                onChange={(e) => setMaxKds(e.target.value)}
              />
            </div>
            <div>
              <span className="label">VAT %</span>
              <input
                className="input mono"
                type="number"
                min={0}
                value={vat}
                onChange={(e) => setVat(e.target.value)}
              />
            </div>
            <div>
              <span className="label">บริการ %</span>
              <input
                className="input mono"
                type="number"
                min={0}
                value={service}
                onChange={(e) => setService(e.target.value)}
              />
            </div>
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

      {branches.length === 0 ? (
        <EmptyState
          title="No branches yet"
          description="Add the first branch for this restaurant above."
        />
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="table">
            <thead>
              <tr>
                <th>ชื่อ · NAME</th>
                <th>ที่อยู่ · ADDRESS</th>
                <th style={{ textAlign: "right" }}>KDS</th>
                <th style={{ textAlign: "right" }}>VAT</th>
                <th style={{ textAlign: "right" }}>บริการ</th>
                <th style={{ textAlign: "right" }} />
              </tr>
            </thead>
            <tbody>
              {branches.map((b) => (
                <tr key={b.id}>
                  <td style={{ fontWeight: 700 }}>{b.name}</td>
                  <td style={{ color: "var(--text-2)" }}>{b.address ?? "—"}</td>
                  <td className="mono" style={{ textAlign: "right", fontWeight: 700 }}>
                    {b.settings.maxKdsScreens}
                  </td>
                  <td className="mono" style={{ textAlign: "right" }}>
                    {Math.round(b.settings.vatRate * 100)}%
                  </td>
                  <td className="mono" style={{ textAlign: "right" }}>
                    {Math.round(b.settings.serviceChargeRate * 100)}%
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      className="pill"
                      style={{ marginRight: 6, cursor: "pointer" }}
                      onClick={() => startEdit(b)}
                    >
                      แก้ไข
                    </button>
                    <button
                      className="pill pill-danger"
                      style={{ cursor: "pointer" }}
                      onClick={() => remove(b.id)}
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
    </div>
  );
}
