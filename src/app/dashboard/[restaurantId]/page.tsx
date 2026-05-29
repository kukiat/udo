"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ImageUpload, type ImageUploadHandle } from "@/components/ui/ImageUpload";
import { Modal } from "@/components/ui/Modal";
import { ErrorState, Loading } from "@/components/ui/States";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { api } from "@/lib/fetcher";

const MODAL_DARK = "!border-[oklch(0.34_0.025_270)] !bg-[oklch(0.24_0.02_270)]";

function markOf(name?: string | null): string {
  if (!name) return "R";
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "R"
  );
}

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

  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState("");
  const [logo, setLogo] = useState("");
  const logoRef = useRef<ImageUploadHandle>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setName(restaurantName ?? "");
    setLogo(restaurantLogo ?? "");
  }, [restaurantName, restaurantLogo]);

  const openEdit = () => {
    setName(restaurantName ?? "");
    setLogo(restaurantLogo ?? "");
    setSaveError(null);
    setEditOpen(true);
  };

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const logoUrl = await logoRef.current!.flush();
      await api(`/api/restaurants/${restaurantId}`, {
        method: "PUT",
        body: JSON.stringify({ name, logo: logoUrl }),
      });
      await refresh();
      setEditOpen(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;

  const stats = [
    { th: "สาขา", en: "BRANCHES", val: String(branches.length) },
    { th: "สาขาที่ใช้งาน", en: "ACTIVE", val: branchName ?? "—", small: true },
    {
      th: "VAT",
      en: "TAX",
      val: `${((settings?.vatRate ?? 0) * 100).toFixed(0)}%`,
    },
    { th: "รายการเมนู", en: "MENU ITEMS", val: "—" },
  ];

  const actions = [
    {
      href: `/dashboard/${restaurantId}/branches`,
      th: "จัดการสาขา",
      en: "Manage branches",
      icon: "⌂",
      desc: `${branches.length} สาขา · ${branches.length} branch`,
    },
    {
      href: `/dashboard/${restaurantId}/categories`,
      th: "จัดการหมวดหมู่",
      en: "Manage categories",
      icon: "◧",
      desc: "หมวดหมู่ · categories",
    },
    {
      href: `/dashboard/${restaurantId}/menu/create`,
      th: "สร้างรายการเมนู",
      en: "Create menu item",
      icon: "＋",
      desc: "เพิ่มเมนูใหม่",
      primary: true,
    },
  ];

  const activity = [
    { th: 'ตั้งสถานะเมนู "หมด"', en: "Item marked sold out", time: "15m", dot: "new" },
    { th: "เพิ่มเมนูใหม่", en: "Menu item created", time: "2h", dot: "ready" },
    { th: "แก้ไขราคาเมนู", en: "Price updated", time: "5h", dot: "prep" },
  ];

  return (
    <div className="max-w-5xl">
      <div style={{ marginBottom: 24 }}>
        <Link
          href="/dashboard"
          style={{ fontSize: 12, color: "var(--text-3)" }}
        >
          ← ทุกร้าน · ALL RESTAURANTS
        </Link>
        <div className="h-display" style={{ fontSize: 44, marginTop: 6 }}>
          ตั้งค่าร้าน
        </div>
        <div style={{ fontSize: 14, color: "var(--text-2)", marginTop: 4 }}>
          RESTAURANT SETTINGS · {restaurantName ?? "…"}
        </div>
      </div>

      {/* Hero info */}
      <div
        className="card"
        style={{
          padding: 24,
          marginBottom: 18,
          display: "flex",
          gap: 24,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {restaurantLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={restaurantLogo}
            alt=""
            style={{ width: 120, height: 120, borderRadius: 24, objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 24,
              background: "linear-gradient(135deg, var(--coral), oklch(0.4 0.15 28))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
              fontWeight: 800,
              letterSpacing: "-0.04em",
            }}
          >
            {markOf(restaurantName)}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 240 }}>
          <span className="label">ชื่อร้าน · NAME</span>
          <div className="h-1" style={{ marginTop: 2 }}>
            {restaurantName ?? "—"}
          </div>
        </div>
        <button className="btn btn-ghost" onClick={openEdit}>
          แก้ไข · EDIT
        </button>
      </div>

      <Modal
        isOpen={editOpen}
        onOpenChange={(open) => {
          if (!open) setEditOpen(false);
        }}
        className={`sm:max-w-xl ${MODAL_DARK}`}
      >
        <div className="dir-a" style={{ padding: 24, background: "var(--surface)" }}>
          <div className="eyebrow" style={{ marginBottom: 16, fontSize: 13, color: "var(--text)" }}>
            แก้ไขร้าน · EDIT RESTAURANT
          </div>
          {saveError && (
            <div style={{ marginBottom: 16 }}>
              <ErrorState message={saveError} />
            </div>
          )}
          <div>
            <span className="label">ชื่อร้าน · NAME</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <ImageUpload
              ref={logoRef}
              deferred
              label="โลโก้ · LOGO"
              value={logo || null}
              onChange={(u) => setLogo(u ?? "")}
            />
          </div>
          <div className="row" style={{ gap: 8, marginTop: 24 }}>
            <button className="btn btn-ghost grow" onClick={() => setEditOpen(false)}>
              ยกเลิก
            </button>
            <button
              className="btn btn-primary grow"
              onClick={save}
              disabled={saving || !name.trim()}
            >
              {saving ? "กำลังบันทึก…" : "บันทึก · SAVE"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Stats */}
      <div
        className="grid gap-3.5"
        style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 18 }}
      >
        {stats.map((s) => (
          <div key={s.en} className="stat">
            <div className="eyebrow">
              {s.th} · {s.en}
            </div>
            <div className={s.small ? "h-2" : "num"}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div
        className="grid gap-3.5"
        style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: 24 }}
      >
        {actions.map((a) => (
          <Link key={a.en} href={a.href} className="card" style={{
            padding: 18,
            display: "flex",
            alignItems: "center",
            gap: 14,
            background: a.primary
              ? "linear-gradient(135deg, var(--coral) 0%, oklch(0.5 0.15 28) 100%)"
              : "var(--surface)",
            borderColor: a.primary ? "var(--coral)" : "var(--border)",
            color: a.primary ? "oklch(0.18 0.05 28)" : "var(--text)",
          }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: a.primary
                  ? "oklch(0.95 0.05 28 / 0.2)"
                  : "var(--bg-elev)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
              }}
            >
              {a.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div className="h-3">{a.th}</div>
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: "0.05em",
                  opacity: 0.7,
                  textTransform: "uppercase",
                  marginTop: 3,
                  lineHeight: 1.3,
                }}
              >
                {a.en}
              </div>
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
                {a.desc}
              </div>
            </div>
            <span style={{ fontSize: 18 }}>→</span>
          </Link>
        ))}
      </div>

      {/* Recent activity */}
      <div className="card" style={{ padding: 20 }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div className="h-2">กิจกรรมล่าสุด</div>
            <div className="eyebrow">RECENT ACTIVITY</div>
          </div>
        </div>
        {activity.map((a, i) => (
          <div
            key={i}
            className="row"
            style={{
              padding: "12px 0",
              borderTop: i === 0 ? "none" : "1px dashed var(--border)",
              gap: 12,
            }}
          >
            <span className={`dot dot-${a.dot}`} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13 }}>{a.th}</div>
              <div style={{ fontSize: 11, color: "var(--text-3)" }}>{a.en}</div>
            </div>
            <span className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>
              {a.time} ก่อน
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
