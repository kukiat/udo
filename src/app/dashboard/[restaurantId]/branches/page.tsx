"use client";

import { useState } from "react";

import {
  BranchFields,
  type BranchFieldsValue,
  branchFieldsFromSettings,
  emptyBranchFields,
  normalizeBranchTime,
  settingsFromBranchFields,
  tablesFromCount,
} from "@/components/dashboard/BranchFields";
import { DashboardTableFooter } from "@/components/dashboard/TableFooter";
import { useDashboardTheme } from "@/components/dashboard/DashboardShell";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import {
  useRestaurant,
  type BranchSummary,
} from "@/contexts/RestaurantContext";
import { api } from "@/lib/fetcher";
import { PillButton } from "@/components/ui/PillButton";
import { PencilIcon, PlusIcon } from "lucide-react";

export default function BranchesPage() {
  const { restaurantId, branches, loading, refresh } = useRestaurant();
  const theme = useDashboardTheme();
  const isDark = theme === "dark";

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fields, setFields] = useState<BranchFieldsValue>(emptyBranchFields());
  // Existing table count for the branch being edited; the stepper can only add
  // tables (never delete) so its lower bound is clamped to this.
  const [existingTables, setExistingTables] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patchFields = (patch: Partial<BranchFieldsValue>) =>
    setFields((f) => ({ ...f, ...patch }));

  const resetForm = () => {
    setEditingId(null);
    setFields(emptyBranchFields());
    setExistingTables(0);
    setIsActive(true);
  };

  const openCreate = () => {
    resetForm();
    setError(null);
    setFormOpen(true);
  };

  const submit = async () => {
    if (!fields.name.trim()) return;
    setSaving(true);
    setError(null);
    const settings = settingsFromBranchFields(fields);
    const address = fields.address.trim() || null;
    const openingTime = fields.openingTime || null;
    const closingTime = fields.closingTime || null;
    try {
      if (editingId) {
        await api(`/api/branches/${editingId}`, {
          method: "PUT",
          body: JSON.stringify({
            name: fields.name,
            address,
            openingTime,
            closingTime,
            settings,
            isActive,
            // Add-only reconciliation: any new numbers are created, existing
            // tables are left untouched.
            tables: tablesFromCount(fields.tables),
          }),
        });
      } else {
        await api("/api/branches", {
          method: "POST",
          body: JSON.stringify({
            restaurantId,
            name: fields.name,
            address,
            openingTime,
            closingTime,
            settings,
            tables: tablesFromCount(fields.tables),
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
    setFields(branchFieldsFromSettings(b));
    setExistingTables(0);
    setIsActive(b.isActive);
    setError(null);
    setFormOpen(true);
    // Hydrate the table count from the saved floor so the stepper starts at the
    // real value and can only grow from there.
    api<{ tables: unknown[] }>(`/api/tables?branchId=${b.id}`)
      .then(({ tables }) => {
        const count = tables.length;
        setExistingTables(count);
        setFields((f) => ({ ...f, tables: Math.max(f.tables, count) }));
      })
      .catch(() => {
        /* leave the stepper at its default if the count can't be loaded */
      });
  };

  if (loading) return <Loading />;

  return (
    <div className="max-w-5xl">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div className="h-display" style={{ fontSize: 44 }}>
            Branches
          </div>
          <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>
            Manage restaurant branches
          </div>
        </div>
        <PillButton tone="accent" onClick={openCreate}>
          <PlusIcon className="w-4 h-4" />
          New branch
        </PillButton>
      </div>

      <Modal
        isOpen={formOpen}
        onOpenChange={(open) => {
          if (!open) {
            resetForm();
            setFormOpen(false);
          }
        }}
        className={
          "sm:max-w-2xl" +
          (isDark ? " !border-[#23262E] !bg-[#15171C]" : "")
        }
      >
        <div
          className={`dir-a kds-theme${isDark ? " kds-dark" : ""}`}
          style={{ padding: 24, background: "var(--surface)" }}
        >
          <div className="eyebrow" style={{ marginBottom: 16, fontSize: 13, color: "var(--text)" }}>
            {editingId ? "Edit branch" : "New branch"}
          </div>
          {error && (
            <div style={{ marginBottom: 16 }}>
              <ErrorState message={error} />
            </div>
          )}
          <BranchFields
            value={fields}
            onChange={patchFields}
            tablesMin={editingId ? existingTables : undefined}
          >
            {editingId && (
              <div style={{ marginTop: 12 }}>
                <span className="label">Status</span>
                <div className="row" style={{ gap: 8 }}>
                  <StatusRadio
                    label="Active"
                    selected={isActive}
                    onSelect={() => setIsActive(true)}
                    accent="var(--olive)"
                  />
                  <StatusRadio
                    label="Inactive"
                    selected={!isActive}
                    onSelect={() => setIsActive(false)}
                    accent="var(--rose)"
                  />
                </div>
              </div>
            )}
          </BranchFields>
          <div className="flex gap-2 w-full justify-end mt-6">
            <PillButton
              variant="outline"
              onClick={() => {
                resetForm();
                setFormOpen(false);
              }}
            >
              Cancel
            </PillButton>
            <PillButton
              tone="accent"
              onClick={submit}
              isDisabled={saving || !fields.name.trim()}
            >
              {saving ? "Saving..." : editingId ? "Save" : "Add"}
            </PillButton>
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
        <BranchesTable branches={branches} onEdit={startEdit} />
      )}
    </div>
  );
}

function StatusRadio({
  label,
  selected,
  onSelect,
  accent,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
  accent: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`
        flex items-center gap-2 pr-0 pl-0 py-2
        border-none bg-transparent 
        font-semibold text-[13px] font-sans
        cursor-pointer
        outline-none
      `}
      style={{
        color: "var(--ink-2)",
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 10,
        paddingBottom: 10,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 16,
          height: 16,
          borderRadius: 999,
          flexShrink: 0,
          border: `2px solid ${selected ? accent : "var(--line-strong)"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {selected && (
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: accent,
            }}
          />
        )}
      </span>
      {label}
    </button>
  );
}

function BranchesTable({
  branches,
  onEdit,
}: {
  branches: BranchSummary[];
  onEdit: (b: BranchSummary) => void;
}) {
  const cols = "minmax(170px, 1.4fr) minmax(180px, 1.5fr) 120px 70px 70px 90px 80px";
  return (
    <div
      style={{
        background: "var(--bg-elev)",
        border: "1px solid var(--line)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: cols,
          gap: 12,
          padding: "11px 18px",
          background: "var(--line)",
          borderBottom: "1px solid var(--line)",
          alignItems: "center",
        }}
      >
        <HeaderLabel label="Name" />
        <HeaderLabel label="Address" />
        <HeaderLabel label="Hours" />
        <HeaderLabel label="KDS" align="right" />
        <HeaderLabel label="VAT" align="right" />
        <HeaderLabel label="Service" align="right" />
        <HeaderLabel label="" align="right" />
      </div>

      {branches.map((b, i) => (
        <div
          key={b.id}
          style={{
            display: "grid",
            gridTemplateColumns: cols,
            gap: 12,
            padding: "14px 18px",
            borderTop: i > 0 ? "1px solid var(--line)" : "none",
            alignItems: "center",
            opacity: b.isActive ? 1 : 0.55,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              minWidth: 0,
            }}
          >
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: "-0.01em",
                color: "var(--ink)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {b.name}
            </span>
            {!b.isActive && (
              <span
                style={{
                  flexShrink: 0,
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  padding: "2px 7px",
                  borderRadius: 999,
                  color: "var(--ink-3)",
                  background: "var(--line)",
                }}
              >
                Inactive
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--ink-3)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {b.address ?? "—"}
          </div>
          <div
            className="tnum mono"
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "var(--ink-2)",
            }}
          >
            {formatBranchHours(b)}
          </div>
          <div
            className="tnum mono"
            style={{
              fontSize: 14,
              fontWeight: 600,
              textAlign: "right",
              color: "var(--ink)",
            }}
          >
            {b.settings.maxKdsScreens}
          </div>
          <div
            className="tnum mono"
            style={{
              fontSize: 14,
              fontWeight: 500,
              textAlign: "right",
              color: "var(--ink-2)",
            }}
          >
            {Math.round(b.settings.vatRate * 100)}%
          </div>
          <div
            className="tnum mono"
            style={{
              fontSize: 14,
              fontWeight: 500,
              textAlign: "right",
              color: "var(--ink-2)",
            }}
          >
            {Math.round(b.settings.serviceChargeRate * 100)}%
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: 6,
            }}
          >
            <button
              onClick={() => onEdit(b)}
              aria-label="Edit branch"
              title="Edit"
              style={{ ...btnRowStyle, width: 28, padding: 0, justifyContent: "center" }}
            >
              <PencilIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
      <DashboardTableFooter
        total={branches.length}
        noun={branches.length === 1 ? "branch" : "branches"}
      />
    </div>
  );
}

function formatBranchHours(b: BranchSummary) {
  if (!b.openingTime && !b.closingTime) return "—";
  return `${normalizeBranchTime(b.openingTime) || "—"}–${
    normalizeBranchTime(b.closingTime) || "—"
  }`;
}

function HeaderLabel({
  label,
  align = "left",
}: {
  label: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <span
      style={{
        display: "block",
        textAlign: align,
        fontSize: 10,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        fontWeight: 600,
        color: "var(--ink-3)",
      }}
    >
      {label}
    </span>
  );
}

const btnRowStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  height: 28,
  padding: "0 12px",
  borderRadius: 999,
  border: "1px solid var(--line-strong)",
  background: "transparent",
  color: "var(--ink-2)",
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.02em",
  cursor: "pointer",
  fontFamily: "inherit",
};
