"use client";

import { useEffect, useState } from "react";

import { ItemSwatch } from "@/components/menu/ItemSwatch";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
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

type Filter = "all" | "available" | "hidden";

export default function BranchMenuPage() {
  const { branchId, branchName, loading: ctxLoading } = useRestaurant();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

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
      <div className="max-w-5xl">
        <div className="h-display" style={{ fontSize: 44 }}>
          เมนูสาขา
        </div>
        <div style={{ marginTop: 16 }}>
          <EmptyState
            title="No branch selected"
            description="Create a branch for this restaurant, then pick it from the top bar."
          />
        </div>
      </div>
    );
  }

  const availableCount = rows.filter((r) => r.isAvailable).length;
  const hiddenCount = rows.length - availableCount;

  const stats = [
    { th: "เมนูทั้งหมด", en: "TOTAL ITEMS", val: String(rows.length) },
    { th: "เปิดในสาขานี้", en: "AVAILABLE HERE", val: String(availableCount), color: "lime", accent: true },
    { th: "ปิดในสาขานี้", en: "HIDDEN HERE", val: String(hiddenCount), color: "coral" },
  ];

  const visible = rows.filter((r) =>
    filter === "all" ? true : filter === "available" ? r.isAvailable : !r.isAvailable,
  );

  return (
    <div className="max-w-5xl">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div className="h-display" style={{ fontSize: 44 }}>
            เมนูสาขา
          </div>
          <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>
            BRANCH MENU · เปิด/ปิด รายการเมนูเฉพาะสาขา · {branchName}
          </div>
        </div>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? "กำลังบันทึก…" : "บันทึก · SAVE"}
        </button>
      </div>

      {saved && (
        <div className="pill pill-lime" style={{ marginBottom: 14 }}>
          ● บันทึกแล้ว · Saved
        </div>
      )}
      {error && (
        <div style={{ marginBottom: 14 }}>
          <ErrorState message={error} onRetry={load} />
        </div>
      )}

      {/* Summary */}
      <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: 18 }}>
        {stats.map((s) => (
          <div
            key={s.en}
            className="stat"
            style={{
              background: s.accent
                ? "linear-gradient(135deg, oklch(0.3 0.1 130) 0%, var(--surface) 100%)"
                : "var(--surface)",
              borderColor: s.accent ? "var(--lime)" : "var(--border)",
            }}
          >
            <div className="eyebrow">
              {s.th} <span style={{ opacity: 0.6 }}>· {s.en}</span>
            </div>
            <div className="num" style={{ color: `var(--${s.color ?? "text"})` }}>
              {s.val}
            </div>
          </div>
        ))}
      </div>

      {/* Items grid */}
      <div className="card" style={{ padding: 16 }}>
        <div className="row" style={{ gap: 10, marginBottom: 14 }}>
          <button
            className={`pill ${filter === "all" ? "pill-on" : ""}`}
            style={{ cursor: "pointer" }}
            onClick={() => setFilter("all")}
          >
            ทั้งหมด · {rows.length}
          </button>
          <button
            className={`pill ${filter === "available" ? "pill-on" : "pill-lime"}`}
            style={{ cursor: "pointer" }}
            onClick={() => setFilter("available")}
          >
            เปิด · {availableCount}
          </button>
          <button
            className={`pill ${filter === "hidden" ? "pill-on" : "pill-danger"}`}
            style={{ cursor: "pointer" }}
            onClick={() => setFilter("hidden")}
          >
            ปิด · {hiddenCount}
          </button>
        </div>

        {visible.length === 0 ? (
          <EmptyState title="No menu items" description="Create menu items first." />
        ) : (
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}
          >
            {visible.map((r) => {
              const off = !r.isAvailable;
              return (
                <div
                  key={r.menuItemId}
                  className="card-elev"
                  style={{
                    padding: 12,
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                    borderColor: off ? "oklch(0.45 0.16 18)" : "var(--border)",
                    opacity: off ? 0.55 : 1,
                  }}
                >
                  <ItemSwatch
                    id={r.menuItemId}
                    name={r.name}
                    image={r.image}
                    size="xs"
                    className="rounded-lg"
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }} className="truncate">
                      {r.name}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-3)" }} className="truncate">
                      {r.categoryName ?? "—"}
                    </div>
                    <input
                      value={r.overridePrice ?? ""}
                      onChange={(e) =>
                        update(r.menuItemId, {
                          overridePrice: e.target.value || null,
                        })
                      }
                      placeholder={formatPrice(r.basePrice)}
                      inputMode="decimal"
                      className="input mono"
                      style={{
                        marginTop: 4,
                        padding: "4px 8px",
                        fontSize: 12,
                        color: "var(--lime)",
                      }}
                    />
                  </div>
                  <button
                    aria-label="Toggle availability"
                    onClick={() =>
                      update(r.menuItemId, { isAvailable: !r.isAvailable })
                    }
                    style={{
                      width: 38,
                      height: 22,
                      borderRadius: 99,
                      background: off ? "var(--bg-elev)" : "var(--lime)",
                      border: `1px solid ${off ? "var(--border-strong)" : "var(--lime)"}`,
                      position: "relative",
                      flexShrink: 0,
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        top: 2,
                        left: off ? 2 : 18,
                        width: 16,
                        height: 16,
                        borderRadius: 99,
                        background: off ? "var(--text-3)" : "var(--bg)",
                        transition: "left .2s",
                      }}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
