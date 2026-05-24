"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/lib/fetcher";
import { formatPrice } from "@/lib/utils";
import type { Shift } from "@/types/pos";

export function ShiftBar({
  branchId,
  shift,
  onChange,
}: {
  branchId: string;
  shift: Shift | null;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openFloat, setOpenFloat] = useState("0");
  const [showOpen, setShowOpen] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [counted, setCounted] = useState("");

  const openShift = async () => {
    setBusy(true);
    setError(null);
    try {
      await api("/api/shifts", {
        method: "POST",
        body: JSON.stringify({ branchId, openingFloat: openFloat || "0" }),
      });
      setShowOpen(false);
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to open shift");
    } finally {
      setBusy(false);
    }
  };

  const closeShift = async () => {
    if (!shift) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/shifts/${shift.id}/close`, {
        method: "POST",
        body: JSON.stringify({ closingAmount: counted || "0" }),
      });
      setShowClose(false);
      setCounted("");
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to close shift");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-white px-4 py-3 shadow-card">
      {shift ? (
        <>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
            <span className="font-semibold text-ink">Shift open</span>
            <span className="text-ink-soft">
              Sales: {formatPrice(shift.salesTotal)} ({shift.paymentCount})
            </span>
            <span className="text-ink-soft">
              Expected cash: {formatPrice(shift.expectedCash)}
            </span>
          </div>
          <Button variant="danger" size="sm" onPress={() => setShowClose(true)}>
            Close shift
          </Button>
        </>
      ) : (
        <>
          <span className="text-sm text-ink-muted">
            No open shift — open one to take payments.
          </span>
          <Button size="sm" onPress={() => setShowOpen(true)}>
            Open shift
          </Button>
        </>
      )}

      <Modal isOpen={showOpen} onOpenChange={setShowOpen}>
        <div className="p-5">
          <h2 className="text-lg font-bold text-ink">Open shift</h2>
          <label className="mt-4 flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-soft">
              Opening cash float
            </span>
            <input
              type="number"
              min="0"
              value={openFloat}
              onChange={(e) => setOpenFloat(e.target.value)}
              className="w-40 rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-clay-300 focus:ring-2 focus:ring-clay-100"
            />
          </label>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <div className="mt-6 flex gap-2">
            <Button variant="ghost" className="flex-1" onPress={() => setShowOpen(false)}>
              Cancel
            </Button>
            <Button className="flex-1" isDisabled={busy} onPress={openShift}>
              Open
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showClose} onOpenChange={setShowClose}>
        <div className="p-5">
          <h2 className="text-lg font-bold text-ink">Close shift</h2>
          {shift && (
            <div className="mt-3 rounded-xl bg-sand p-3 text-sm text-ink-soft">
              <div className="flex justify-between">
                <span>Opening float</span>
                <span>{formatPrice(shift.openingFloat)}</span>
              </div>
              <div className="flex justify-between">
                <span>Cash sales</span>
                <span>{formatPrice(shift.cashTotal)}</span>
              </div>
              <div className="mt-1 flex justify-between border-t border-line pt-1 font-semibold text-ink">
                <span>Expected in drawer</span>
                <span>{formatPrice(shift.expectedCash)}</span>
              </div>
            </div>
          )}
          <label className="mt-4 flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-soft">
              Counted cash
            </span>
            <input
              type="number"
              min="0"
              value={counted}
              onChange={(e) => setCounted(e.target.value)}
              className="w-40 rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-clay-300 focus:ring-2 focus:ring-clay-100"
            />
          </label>
          {shift && counted !== "" && (
            <p className="mt-2 text-sm text-ink-soft">
              Variance:{" "}
              {formatPrice(
                parseFloat(counted) - parseFloat(shift.expectedCash),
              )}
            </p>
          )}
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <div className="mt-6 flex gap-2">
            <Button variant="ghost" className="flex-1" onPress={() => setShowClose(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              isDisabled={busy}
              onPress={closeShift}
            >
              Close shift
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
