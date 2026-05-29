"use client";

import { useRef, useState } from "react";

import { ImageUpload, type ImageUploadHandle } from "@/components/ui/ImageUpload";
import { Modal } from "@/components/ui/Modal";
import { ErrorState } from "@/components/ui/States";
import { api } from "@/lib/fetcher";

type BranchInput = {
  name: string;
  address: string;
  maxKds: string;
  vat: string;
  service: string;
};

const emptyBranch = (): BranchInput => ({
  name: "",
  address: "",
  maxKds: "3",
  vat: "7",
  service: "0",
});

export function CreateRestaurantModal({
  isOpen,
  onOpenChange,
  onCreated,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (restaurantId: string) => void;
}) {
  const [name, setName] = useState("");
  const [logo, setLogo] = useState("");
  const logoRef = useRef<ImageUploadHandle>(null);
  const [branches, setBranches] = useState<BranchInput[]>([emptyBranch()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setLogo("");
    setBranches([emptyBranch()]);
    setError(null);
  };

  const updateBranch = (i: number, patch: Partial<BranchInput>) =>
    setBranches((prev) =>
      prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)),
    );

  const addBranch = () => setBranches((prev) => [...prev, emptyBranch()]);
  const removeBranch = (i: number) =>
    setBranches((prev) => prev.filter((_, idx) => idx !== i));

  const canSubmit =
    name.trim().length > 0 &&
    branches.length > 0 &&
    branches.every((b) => b.name.trim().length > 0);

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const logoUrl = await logoRef.current!.flush();
      const { restaurant } = await api<{ restaurant: { id: string } }>(
        "/api/restaurants",
        {
          method: "POST",
          body: JSON.stringify({
            name,
            logo: logoUrl,
            branches: branches.map((b) => ({
              name: b.name,
              address: b.address.trim() || null,
              settings: {
                maxKdsScreens: Number(b.maxKds),
                vatRate: Number(b.vat) / 100,
                serviceChargeRate: Number(b.service) / 100,
              },
            })),
          }),
        },
      );
      reset();
      onCreated(restaurant.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create restaurant");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) reset();
        onOpenChange(open);
      }}
      className="sm:max-w-2xl !border-[oklch(0.34_0.025_270)] !bg-[oklch(0.24_0.02_270)]"
    >
      <div className="dir-a" style={{ padding: 24, background: "var(--surface)" }}>
        <div className="h-display" style={{ fontSize: 32 }}>
          ร้านใหม่
        </div>
        <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>
          NEW RESTAURANT · ต้องมีอย่างน้อย 1 สาขา
        </div>

        {error && (
          <div style={{ marginTop: 16 }}>
            <ErrorState message={error} />
          </div>
        )}

        <section className="card-elev" style={{ padding: 18, marginTop: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>
            ① ข้อมูลร้าน · RESTAURANT
          </div>
          <div className="col" style={{ gap: 12 }}>
            <label style={{ display: "block" }}>
              <span className="label">ชื่อร้าน · NAME</span>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ชื่อร้าน"
              />
            </label>
            <div style={{ maxWidth: 360 }}>
              <ImageUpload
                ref={logoRef}
                deferred
                label="โลโก้ · LOGO (optional)"
                value={logo || null}
                onChange={(u) => setLogo(u ?? "")}
              />
            </div>
          </div>
        </section>

        <section style={{ marginTop: 18 }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
            <div className="eyebrow">② สาขา · BRANCHES ({branches.length})</div>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: "6px 12px", fontSize: 12 }}
              onClick={addBranch}
            >
              ＋ เพิ่มสาขา
            </button>
          </div>

          <div className="col" style={{ gap: 12 }}>
            {branches.map((b, i) => (
              <div key={i} className="card-elev" style={{ padding: 18 }}>
                <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
                  <span className="eyebrow">สาขา · BRANCH {i + 1}</span>
                  {branches.length > 1 && (
                    <button
                      type="button"
                      className="pill pill-danger"
                      style={{ cursor: "pointer" }}
                      onClick={() => removeBranch(i)}
                    >
                      ลบ
                    </button>
                  )}
                </div>
                <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  <label style={{ display: "block" }}>
                    <span className="label">ชื่อสาขา · NAME</span>
                    <input
                      className="input"
                      value={b.name}
                      onChange={(e) => updateBranch(i, { name: e.target.value })}
                      placeholder="ชื่อสาขา"
                    />
                  </label>
                  <label style={{ display: "block" }}>
                    <span className="label">ที่อยู่ · ADDRESS</span>
                    <input
                      className="input"
                      value={b.address}
                      onChange={(e) => updateBranch(i, { address: e.target.value })}
                      placeholder="ไม่บังคับ"
                    />
                  </label>
                </div>
                <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginTop: 12 }}>
                  <label style={{ display: "block" }}>
                    <span className="label">KDS สูงสุด</span>
                    <input
                      className="input mono"
                      type="number"
                      min={1}
                      value={b.maxKds}
                      onChange={(e) => updateBranch(i, { maxKds: e.target.value })}
                    />
                  </label>
                  <label style={{ display: "block" }}>
                    <span className="label">VAT %</span>
                    <input
                      className="input mono"
                      type="number"
                      min={0}
                      value={b.vat}
                      onChange={(e) => updateBranch(i, { vat: e.target.value })}
                    />
                  </label>
                  <label style={{ display: "block" }}>
                    <span className="label">บริการ %</span>
                    <input
                      className="input mono"
                      type="number"
                      min={0}
                      value={b.service}
                      onChange={(e) => updateBranch(i, { service: e.target.value })}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="row" style={{ gap: 8, marginTop: 24 }}>
          <button
            className="btn btn-ghost grow"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            ยกเลิก
          </button>
          <button
            className="btn btn-primary grow"
            onClick={submit}
            disabled={submitting || !canSubmit}
          >
            {submitting ? "กำลังสร้าง…" : "สร้างร้าน · CREATE"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
