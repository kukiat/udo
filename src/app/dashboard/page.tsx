"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { CreateRestaurantModal } from "@/components/dashboard/CreateRestaurantModal";
import { TopBar } from "@/components/dashboard/TopBar";
import { Button } from "@/components/ui/Button";
import { ImageUpload, type ImageUploadHandle } from "@/components/ui/ImageUpload";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { api } from "@/lib/fetcher";

function markOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "R"
  );
}

type Restaurant = {
  id: string;
  name: string;
  logo: string | null;
  branches: { id: string }[];
};

export default function DashboardHome() {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [menuTotal, setMenuTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [logo, setLogo] = useState("");
  const logoRef = useRef<ImageUploadHandle>(null);
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<Restaurant | null>(null);
  const [removing, setRemoving] = useState(false);

  const load = () => {
    setLoading(true);
    setMenuTotal(null);
    api<{ restaurants: Restaurant[] }>("/api/restaurants?withBranches=true")
      .then((d) => {
        setRestaurants(d.restaurants);
        return Promise.all(
          d.restaurants.map((r) =>
            api<{ total: number }>(`/api/menu?restaurantId=${r.id}&limit=1`)
              .then((m) => m.total)
              .catch(() => 0),
          ),
        ).then((counts) => setMenuTotal(counts.reduce((a, b) => a + b, 0)));
      })
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
      const logoUrl = await logoRef.current!.flush();
      await api(`/api/restaurants/${editingId}`, {
        method: "PUT",
        body: JSON.stringify({ name, logo: logoUrl }),
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
      left={
        <div>
          <div>
            ร้านอาหารทั้งหมด{" "}
            <span style={{ color: "var(--text-3)", fontWeight: 500 }}>
              · RESTAURANTS
            </span>
          </div>
          <div
            style={{
              fontSize: 10,
              color: "var(--text-3)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Owner Admin View
          </div>
        </div>
      }
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

  const totalBranches = restaurants.reduce(
    (sum, r) => sum + r.branches.length,
    0,
  );
  const stats = [
    { th: "ร้านทั้งหมด", en: "RESTAURANTS", val: String(restaurants.length) },
    { th: "สาขารวม", en: "BRANCHES", val: String(totalBranches) },
    { th: "รายการเมนู", en: "MENU ITEMS", val: menuTotal === null ? "…" : String(menuTotal) },
    { th: "ยอดวันนี้", en: "TODAY", val: "—", accent: true },
  ];

  return (
    <>
      {topBar}
      <div className="mx-auto max-w-5xl px-6 py-8 md:px-12">
        <div className="row" style={{ justifyContent: "space-between", gap: 16, marginBottom: 28 }}>
          <div>
            <div className="h-display" style={{ fontSize: 48 }}>
              ร้านอาหาร
            </div>
            <div style={{ fontSize: 14, color: "var(--text-2)", marginTop: 6 }}>
              สร้างร้าน แล้วเปิดเพื่อจัดการสาขา หมวดหมู่ และเมนู
              <br />
              <span style={{ color: "var(--text-3)", fontSize: 12 }}>
                Create a restaurant, then open it to manage branches,
                categories, and menu
              </span>
            </div>
          </div>
          <button className="btn btn-primary row" style={{ gap: 6 }} onClick={() => setCreating(true)}>
            <svg
              viewBox="0 0 24 24"
              width={16}
              height={16}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            ร้านใหม่ · NEW RESTAURANT
          </button>
        </div>

        <div
          className="grid gap-3.5"
          style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 28 }}
        >
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
              <div
                className="num"
                style={{ color: s.accent ? "var(--lime)" : "var(--text)" }}
              >
                {s.val}
              </div>
            </div>
          ))}
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
        className="!border-[oklch(0.34_0.025_270)] !bg-[oklch(0.24_0.02_270)]"
      >
        <div className="dir-a" style={{ padding: 20, background: "var(--surface)" }}>
          <h2 className="h-2">แก้ไขร้าน · Edit restaurant</h2>
          <label style={{ display: "block", marginTop: 16 }}>
            <span className="label">ชื่อร้าน · NAME</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ชื่อร้าน"
              className="input"
            />
          </label>
          <div style={{ marginTop: 16, maxWidth: 360 }}>
            <ImageUpload
              ref={logoRef}
              deferred
              label="โลโก้ · LOGO"
              value={logo || null}
              onChange={(u) => setLogo(u ?? "")}
            />
          </div>
          <div className="row" style={{ gap: 8, marginTop: 24 }}>
            <button className="btn btn-ghost grow" onClick={resetForm}>
              ยกเลิก
            </button>
            <button
              className="btn btn-primary grow"
              onClick={saveEdit}
              disabled={saving || !name.trim()}
            >
              บันทึก · Update
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        className="!border-[oklch(0.34_0.025_270)] !bg-[oklch(0.24_0.02_270)]"
      >
        <div className="dir-a" style={{ padding: 20, background: "var(--surface)" }}>
          <h2 className="h-2">ลบร้าน · Delete restaurant</h2>
          <p style={{ marginTop: 12, fontSize: 13, color: "var(--text-3)" }}>
            Are you sure you want to delete{" "}
            <span style={{ fontWeight: 700, color: "var(--text)" }}>
              {deleting?.name}
            </span>
            ? This cannot be undone.
          </p>
          <div className="row" style={{ gap: 8, marginTop: 24 }}>
            <button className="btn btn-ghost grow" onClick={() => setDeleting(null)}>
              ยกเลิก
            </button>
            <button
              className="btn btn-danger grow"
              onClick={confirmRemove}
              disabled={removing}
            >
              ลบ · Delete
            </button>
          </div>
        </div>
      </Modal>

      {error && (
        <div style={{ marginBottom: 16 }}>
          <ErrorState message={error} />
        </div>
      )}

      {restaurants.length === 0 ? (
        <EmptyState
          title="No restaurants yet"
          description="Create your first restaurant to get started."
          action={
            <Button onPress={() => setCreating(true)}>New restaurant</Button>
          }
        />
      ) : (
        <div
          className="grid gap-3.5"
          style={{ gridTemplateColumns: "repeat(2, 1fr)" }}
        >
          {restaurants.map((r, i) => (
            <div
              key={r.id}
              role="link"
              tabIndex={0}
              onClick={() => router.push(`/dashboard/${r.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(`/dashboard/${r.id}`);
                }
              }}
              className="card"
              style={{ padding: 0, overflow: "hidden", cursor: "pointer" }}
            >
              <div className="row" style={{ padding: 20, gap: 16 }}>
                {r.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.logo}
                    alt=""
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: 16,
                      objectFit: "cover",
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    className="brand-mark"
                    style={{
                      width: 60,
                      height: 60,
                      fontSize: 18,
                      borderRadius: 16,
                      background: `linear-gradient(135deg, oklch(0.5 0.2 ${30 + i * 80}), oklch(0.35 0.15 ${50 + i * 80}))`,
                    }}
                  >
                    {markOf(r.name)}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="h-2 truncate" style={{ lineHeight: 1.4 }}>
                    {r.name}
                  </div>
                  <div
                    className="row"
                    style={{
                      gap: 12,
                      marginTop: 10,
                      fontSize: 12,
                      color: "var(--text-2)",
                    }}
                  >
                    <span>
                      <span className="mono" style={{ fontWeight: 700 }}>
                        {r.branches.length}
                      </span>{" "}
                      สาขา
                    </span>
                    <span style={{ color: "var(--text-3)" }}>·</span>
                    <span style={{ color: "var(--lime)" }}>● Active</span>
                  </div>
                </div>
              </div>
              <div
                className="row"
                style={{
                  borderTop: "1px solid var(--border)",
                  padding: "12px 20px",
                  gap: 8,
                  justifyContent: "flex-end",
                }}
              >
                <button
                  className="btn btn-ghost"
                  style={{ padding: "8px 14px", fontSize: 12 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    startEdit(r);
                  }}
                >
                  แก้ไข · Edit
                </button>
                <button
                  className="btn btn-danger"
                  style={{ padding: "8px 14px", fontSize: 12 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleting(r);
                  }}
                >
                  ลบ · Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </>
  );
}
