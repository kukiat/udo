"use client";

import { useState } from "react";

import { Modal } from "@/components/ui/Modal";
import { PillButton } from "@/components/ui/PillButton";
import { TextInput } from "@/components/ui/TextInput";
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
          <PillButton tone="accent" variant="outline" onPress={() => setShowClose(true)}>
            Close shift
          </PillButton>
        </>
      ) : (
        <>
          <span className="text-sm text-ink-muted">
            No open shift — open one to take payments.
          </span>
          <PillButton tone="accent"  onPress={() => setShowOpen(true)}>
            Open shift
          </PillButton>
        </>
      )}

      <Modal isOpen={showOpen} onOpenChange={setShowOpen}>
        <div className="flex flex-col gap-4 p-5">
          <div>
            <h2
              className="text-lg font-semibold"
              style={{ color: "var(--ink)" }}
            >
              Open shift
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--ink-3)" }}>
              Enter the starting cash in the drawer.
            </p>
          </div>

          <label className="flex flex-col gap-1.5">
            <span
              className="text-[13px] font-semibold"
              style={{ color: "var(--ink)" }}
            >
              Opening cash float
            </span>
            <TextInput
              type="number"
              min={0}
              value={openFloat}
              onChange={setOpenFloat}
              icon={null}
              width="100%"
              ariaLabel="Opening cash float"
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <PillButton
              tone="neutral"
              isDisabled={busy}
              onPress={() => setShowOpen(false)}
              className="flex-1"
            >
              Cancel
            </PillButton>
            <PillButton
              tone="accent"
              isDisabled={busy}
              onPress={openShift}
              className="flex-1"
            >
              Open
            </PillButton>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showClose} onOpenChange={setShowClose}>
        <div className="flex flex-col gap-4 p-5">
          <div>
            <h2
              className="text-lg font-semibold"
              style={{ color: "var(--ink)" }}
            >
              Close shift
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--ink-3)" }}>
              Count the cash in the drawer and enter the total.
            </p>
          </div>

          {shift && (
            <div
              className="rounded-lg p-3 text-sm"
              style={{
                background: "var(--bg-subtle, var(--bg-elev))",
                color: "var(--ink-3)",
              }}
            >
              <div className="flex justify-between">
                <span>Opening float</span>
                <span>{formatPrice(shift.openingFloat)}</span>
              </div>
              <div className="flex justify-between">
                <span>Cash sales</span>
                <span>{formatPrice(shift.cashTotal)}</span>
              </div>
              <div
                className="mt-1 flex justify-between border-t pt-1 font-semibold"
                style={{
                  borderColor: "var(--line-strong)",
                  color: "var(--ink)",
                }}
              >
                <span>Expected in drawer</span>
                <span>{formatPrice(shift.expectedCash)}</span>
              </div>
            </div>
          )}

          <label className="flex flex-col gap-1.5">
            <span
              className="text-[13px] font-semibold"
              style={{ color: "var(--ink)" }}
            >
              Counted cash
            </span>
            <TextInput
              type="number"
              min={0}
              value={counted}
              onChange={setCounted}
              icon={null}
              width="100%"
              ariaLabel="Counted cash"
            />
          </label>

          {shift && counted !== "" && (
            <p className="text-sm" style={{ color: "var(--ink-3)" }}>
              Variance:{" "}
              {formatPrice(
                parseFloat(counted) - parseFloat(shift.expectedCash),
              )}
            </p>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <PillButton
              tone="neutral"
              isDisabled={busy}
              onPress={() => setShowClose(false)}
              className="flex-1"
            >
              Cancel
            </PillButton>
            <PillButton
              tone="accent"
              isDisabled={busy}
              onPress={closeShift}
              className="flex-1"
            >
              Close shift
            </PillButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
