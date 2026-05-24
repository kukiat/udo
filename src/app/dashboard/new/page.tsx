"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { Modal } from "@/components/ui/Modal";
import { ErrorState, Spinner } from "@/components/ui/States";
import { api } from "@/lib/fetcher";

type BranchInput = {
  name: string;
  address: string;
  maxKds: string;
  vat: string;
  service: string;
};

const FIELD =
  "rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-clay-300 focus:ring-2 focus:ring-clay-100";

const emptyBranch = (): BranchInput => ({
  name: "",
  address: "",
  maxKds: "3",
  vat: "7",
  service: "0",
});

export default function CreateRestaurantPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [logo, setLogo] = useState("");
  const [branches, setBranches] = useState<BranchInput[]>([emptyBranch()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const { restaurant } = await api<{ restaurant: { id: string } }>(
        "/api/restaurants",
        {
          method: "POST",
          body: JSON.stringify({
            name,
            logo: logo.trim() || null,
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
      router.push(`/dashboard/${restaurant.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create restaurant");
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-5 md:p-8">
      <Link href="/dashboard" className="text-sm text-ink-muted hover:text-ink">
        ← All restaurants
      </Link>
      <h1 className="mb-1 mt-2 text-2xl font-bold text-ink">New Restaurant</h1>
      <p className="text-ink-muted">A restaurant needs at least one branch.</p>

      {error && (
        <div className="mt-4">
          <ErrorState message={error} />
        </div>
      )}

      <section className="mt-5 rounded-card border border-line bg-white p-4 shadow-card">
        <h2 className="text-sm font-semibold text-ink">Restaurant</h2>
        <div className="mt-3 flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-soft">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Restaurant name"
              className={FIELD}
            />
          </label>
          <ImageUpload
            label="Logo (optional)"
            value={logo || null}
            onChange={(u) => setLogo(u ?? "")}
          />
        </div>
      </section>

      <section className="mt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">
            Branches ({branches.length})
          </h2>
          <Button size="sm" variant="secondary" onPress={addBranch}>
            + Add branch
          </Button>
        </div>

        <div className="mt-3 flex flex-col gap-3">
          {branches.map((b, i) => (
            <div
              key={i}
              className="rounded-card border border-line bg-white p-4 shadow-card"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                  Branch {i + 1}
                </span>
                {branches.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onPress={() => removeBranch(i)}
                  >
                    Remove
                  </Button>
                )}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-ink-soft">Name</span>
                  <input
                    value={b.name}
                    onChange={(e) => updateBranch(i, { name: e.target.value })}
                    placeholder="Branch name"
                    className={FIELD}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-ink-soft">
                    Address
                  </span>
                  <input
                    value={b.address}
                    onChange={(e) =>
                      updateBranch(i, { address: e.target.value })
                    }
                    placeholder="Optional"
                    className={FIELD}
                  />
                </label>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-ink-soft">
                    Max KDS
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={b.maxKds}
                    onChange={(e) => updateBranch(i, { maxKds: e.target.value })}
                    className={FIELD}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-ink-soft">VAT %</span>
                  <input
                    type="number"
                    min={0}
                    value={b.vat}
                    onChange={(e) => updateBranch(i, { vat: e.target.value })}
                    className={FIELD}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-ink-soft">
                    Service %
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={b.service}
                    onChange={(e) =>
                      updateBranch(i, { service: e.target.value })
                    }
                    className={FIELD}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-5 flex gap-3">
        <Button onPress={submit} isDisabled={submitting || !canSubmit}>
          {submitting ? "Creating…" : "Create restaurant"}
        </Button>
        <Link href="/dashboard">
          <Button variant="ghost">Cancel</Button>
        </Link>
      </div>

      <Modal isOpen={submitting} onOpenChange={() => {}} className="sm:max-w-xs">
        <div className="flex flex-col items-center gap-3 p-8 text-center">
          <Spinner className="h-8 w-8" />
          <p className="text-sm font-medium text-ink">Creating restaurant…</p>
        </div>
      </Modal>
    </div>
  );
}
