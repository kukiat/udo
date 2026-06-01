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
      role="Owner Admin"
      left={
        <span className="text-[13px] font-medium tracking-[-0.005em] text-ink-soft">
          All restaurants
        </span>
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
      <div className="dir-a mx-auto max-w-5xl px-6 py-8 md:px-12">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              Owner Admin · Restaurants
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                lineHeight: 1.05,
                color: "var(--text)",
              }}
            >
              ร้านอาหาร · Restaurants
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--text-3)",
                marginTop: 6,
                maxWidth: 540,
              }}
            >
              สร้างร้าน แล้วเปิดเพื่อจัดการสาขา หมวดหมู่ และเมนู ·{" "}
              <span style={{ color: "var(--text-3)" }}>
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
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: 20,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-3)",
                }}
              >
                {s.en}
              </div>
              <div
                className="mono tnum"
                style={{
                  fontSize: 30,
                  fontWeight: 600,
                  letterSpacing: "-0.025em",
                  lineHeight: 1,
                  color: s.accent ? "var(--lime)" : "var(--text)",
                }}
              >
                {s.val}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-3)" }}>{s.th}</div>
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
          {restaurants.map((r) => (
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
              style={{
                padding: 0,
                overflow: "hidden",
                cursor: "pointer",
                transition: "border-color 0.15s ease, transform 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--border-strong)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <div className="row" style={{ padding: 20, gap: 16 }}>
                {r.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.logo}
                    alt=""
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 12,
                      objectFit: "cover",
                      flexShrink: 0,
                      border: "1px solid var(--border)",
                    }}
                  />
                ) : (
                  // Marrow brand mark: ink ring + terracotta dot. Initials sit
                  // inside as a tiny tnum overlay for context.
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 12,
                      background: "var(--bg-elev)",
                      border: "1px solid var(--border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      position: "relative",
                    }}
                  >
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: "var(--text)",
                        position: "relative",
                        display: "inline-block",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          inset: "20%",
                          background: "var(--coral)",
                          borderRadius: "50%",
                        }}
                      />
                    </span>
                    <span
                      className="mono"
                      style={{
                        position: "absolute",
                        bottom: 4,
                        right: 6,
                        fontSize: 9,
                        fontWeight: 700,
                        color: "var(--text-3)",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {markOf(r.name)}
                    </span>
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    className="truncate"
                    style={{
                      fontSize: 18,
                      fontWeight: 600,
                      letterSpacing: "-0.01em",
                      lineHeight: 1.25,
                      color: "var(--text)",
                    }}
                  >
                    {r.name}
                  </div>
                  <div
                    className="row"
                    style={{
                      gap: 10,
                      marginTop: 8,
                      fontSize: 12,
                      color: "var(--text-3)",
                    }}
                  >
                    <span>
                      <span
                        className="mono tnum"
                        style={{ fontWeight: 600, color: "var(--text)" }}
                      >
                        {r.branches.length}
                      </span>{" "}
                      สาขา · branches
                    </span>
                    <span aria-hidden style={{ color: "var(--border-strong)" }}>
                      ·
                    </span>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        color: "var(--lime)",
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 99,
                          background: "var(--lime)",
                        }}
                      />
                      Active
                    </span>
                  </div>
                </div>
              </div>
              <div
                className="row"
                style={{
                  borderTop: "1px solid var(--border)",
                  padding: "10px 16px",
                  gap: 6,
                  justifyContent: "flex-end",
                  background: "var(--bg-elev)",
                }}
              >
                <button
                  className="btn btn-ghost"
                  style={{ padding: "6px 12px", fontSize: 12, height: 30 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    startEdit(r);
                  }}
                >
                  แก้ไข · Edit
                </button>
                <button
                  className="btn btn-danger"
                  style={{ padding: "6px 12px", fontSize: 12, height: 30 }}
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
