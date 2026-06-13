"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PlusIcon, RotateCcwIcon, SaveIcon, Trash2Icon } from "lucide-react";

import { useDashboardTheme } from "@/components/dashboard/DashboardShell";
import {
  CANVAS_H,
  CANVAS_W,
  FloorPlanCanvas,
  GRID,
} from "@/components/floor/FloorPlanCanvas";
import { Modal } from "@/components/ui/Modal";
import { PillButton } from "@/components/ui/PillButton";
import { Select } from "@/components/ui/Select";
import { TextInput } from "@/components/ui/TextInput";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { usePageTitle } from "@/hooks/usePageTitle";
import { api } from "@/lib/fetcher";
import type { FloorZoneDTO, TableLayoutDTO, TableShape } from "@/types";

const isPlaced = (t: TableLayoutDTO) =>
  t.zoneId != null && t.posX != null && t.posY != null;

export default function FloorPlanPage() {
  usePageTitle("Floor plan");
  const { branchId, branchName, loading: ctxLoading } = useRestaurant();
  const theme = useDashboardTheme();
  const isDark = theme === "dark";

  const [zones, setZones] = useState<FloorZoneDTO[]>([]);
  const [tables, setTables] = useState<TableLayoutDTO[]>([]);
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Zone create/rename modal
  const [zoneModalOpen, setZoneModalOpen] = useState(false);
  const [zoneEditingId, setZoneEditingId] = useState<string | null>(null);
  const [zoneName, setZoneName] = useState("");
  const [zoneSaving, setZoneSaving] = useState(false);
  const [zoneError, setZoneError] = useState<string | null>(null);

  // Zone delete confirm
  const [zoneDeleteOpen, setZoneDeleteOpen] = useState(false);

  // Rename (table number) — draft committed via the Rename button.
  const [nameDraft, setNameDraft] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  // Add-table modal
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState("");
  const [newTableSeats, setNewTableSeats] = useState("4");
  const [newTableShape, setNewTableShape] = useState<TableShape>("rect");
  const [tableSaving, setTableSaving] = useState(false);
  const [tableError, setTableError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    setError(null);
    try {
      const [z, t] = await Promise.all([
        api<{ zones: FloorZoneDTO[] }>(`/api/floor-zones?branchId=${branchId}`),
        api<{ tables: TableLayoutDTO[] }>(`/api/tables?branchId=${branchId}`),
      ]);
      setZones(z.zones);
      setTables(t.tables);
      setActiveZoneId((curr) =>
        curr && z.zones.some((x) => x.id === curr)
          ? curr
          : (z.zones[0]?.id ?? null),
      );
      setSelectedId(null);
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load floor plan");
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const placedInZone = useMemo(
    () => tables.filter((t) => isPlaced(t) && t.zoneId === activeZoneId),
    [tables, activeZoneId],
  );
  const unplaced = useMemo(() => tables.filter((t) => !isPlaced(t)), [tables]);
  const selected = tables.find((t) => t.id === selectedId) ?? null;

  const updateTable = useCallback(
    (id: string, patch: Partial<TableLayoutDTO>) => {
      setTables((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      );
      setDirty(true);
    },
    [],
  );

  // Selection also resets the table-number draft in the inspector.
  const selectTable = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      const t = id ? tables.find((x) => x.id === id) : null;
      setNameDraft(t?.tableNumber ?? "");
      setRenameError(null);
    },
    [tables],
  );

  const renameTable = async () => {
    if (!selected) return;
    const name = nameDraft.trim();
    if (!name || name === selected.tableNumber) return;
    setRenaming(true);
    setRenameError(null);
    try {
      const d = await api<{ table: TableLayoutDTO }>(
        `/api/tables/${selected.id}`,
        { method: "PATCH", body: JSON.stringify({ tableNumber: name }) },
      );
      // Merge only the name so unsaved local layout edits are kept.
      setTables((prev) =>
        prev.map((t) =>
          t.id === d.table.id ? { ...t, tableNumber: d.table.tableNumber } : t,
        ),
      );
    } catch (e) {
      setRenameError(e instanceof Error ? e.message : "Failed to rename table");
    } finally {
      setRenaming(false);
    }
  };

  const placeTable = (t: TableLayoutDTO) => {
    if (!activeZoneId) return;
    // Cascade placements from the canvas center so new tables don't stack.
    const n = placedInZone.length;
    const offset = (n % 5) * GRID * 2;
    updateTable(t.id, {
      zoneId: activeZoneId,
      posX: Math.min(CANVAS_W - t.width, CANVAS_W / 2 - t.width / 2 + offset),
      posY: Math.min(CANVAS_H - t.height, CANVAS_H / 2 - t.height / 2 + offset),
    });
    setSelectedId(t.id);
    setNameDraft(t.tableNumber);
    setRenameError(null);
  };

  const removeFromPlan = (id: string) => {
    updateTable(id, { zoneId: null, posX: null, posY: null });
    selectTable(null);
  };

  const save = async () => {
    if (!branchId || tables.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const d = await api<{ tables: TableLayoutDTO[] }>("/api/tables/layout", {
        method: "PUT",
        body: JSON.stringify({
          branchId,
          tables: tables.map((t) => ({
            id: t.id,
            zoneId: t.zoneId,
            posX: t.posX,
            posY: t.posY,
            width: t.width,
            height: t.height,
            shape: t.shape,
            seats: t.seats,
            rotation: t.rotation,
          })),
        }),
      });
      setTables(d.tables);
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save layout");
    } finally {
      setSaving(false);
    }
  };

  const openZoneCreate = () => {
    setZoneEditingId(null);
    setZoneName("");
    setZoneError(null);
    setZoneModalOpen(true);
  };

  const openZoneRename = () => {
    const z = zones.find((x) => x.id === activeZoneId);
    if (!z) return;
    setZoneEditingId(z.id);
    setZoneName(z.name);
    setZoneError(null);
    setZoneModalOpen(true);
  };

  const submitZone = async () => {
    if (!branchId || !zoneName.trim()) return;
    setZoneSaving(true);
    setZoneError(null);
    try {
      if (zoneEditingId) {
        const d = await api<{ zone: FloorZoneDTO }>(
          `/api/floor-zones/${zoneEditingId}`,
          { method: "PUT", body: JSON.stringify({ name: zoneName.trim() }) },
        );
        setZones((prev) =>
          prev.map((z) => (z.id === d.zone.id ? d.zone : z)),
        );
      } else {
        const d = await api<{ zone: FloorZoneDTO }>("/api/floor-zones", {
          method: "POST",
          body: JSON.stringify({
            branchId,
            name: zoneName.trim(),
            sortOrder: zones.length,
          }),
        });
        setZones((prev) => [...prev, d.zone]);
        setActiveZoneId(d.zone.id);
      }
      setZoneModalOpen(false);
    } catch (e) {
      setZoneError(e instanceof Error ? e.message : "Failed to save zone");
    } finally {
      setZoneSaving(false);
    }
  };

  const deleteZone = async () => {
    if (!activeZoneId) return;
    setZoneSaving(true);
    try {
      await api(`/api/floor-zones/${activeZoneId}`, { method: "DELETE" });
      setZoneDeleteOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete zone");
      setZoneDeleteOpen(false);
    } finally {
      setZoneSaving(false);
    }
  };

  const submitTable = async () => {
    if (!branchId || !newTableNumber.trim()) return;
    setTableSaving(true);
    setTableError(null);
    try {
      const d = await api<{ table: TableLayoutDTO }>("/api/tables", {
        method: "POST",
        body: JSON.stringify({
          branchId,
          tableNumber: newTableNumber.trim(),
          seats: Math.max(1, Math.min(50, Number(newTableSeats) || 4)),
          shape: newTableShape,
        }),
      });
      setTables((prev) => [...prev, d.table]);
      setTableModalOpen(false);
      setNewTableNumber("");
      setNewTableSeats("4");
      setNewTableShape("rect");
      if (activeZoneId) placeTable(d.table);
    } catch (e) {
      setTableError(e instanceof Error ? e.message : "Failed to create table");
    } finally {
      setTableSaving(false);
    }
  };

  const deleteTable = async (id: string) => {
    setError(null);
    try {
      await api(`/api/tables/${id}`, { method: "DELETE" });
      setTables((prev) => prev.filter((t) => t.id !== id));
      setSelectedId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete table");
    }
  };

  const numField = (
    label: string,
    value: number,
    min: number,
    max: number,
    key: "width" | "height" | "seats" | "rotation",
  ) => (
    <div>
      <span className="label">{label}</span>
      <TextInput
        value={String(value)}
        onChange={(v: string) => {
          if (!selected) return;
          const n = Number(v);
          if (Number.isFinite(n)) {
            updateTable(selected.id, {
              [key]: Math.max(min, Math.min(max, Math.round(n))),
            });
          }
        }}
        type="number"
        mono
        icon={null}
        width="100%"
        ariaLabel={label}
      />
    </div>
  );

  if (ctxLoading || loading) return <Loading />;

  return (
    <div className={`max-w-6xl dir-a kds-theme${isDark ? " kds-dark" : ""}`}>
      <div
        className="row"
        style={{ justifyContent: "space-between", marginBottom: 24 }}
      >
        <div>
          <div className="h-display" style={{ fontSize: 44 }}>
            Floor plan
          </div>
          <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>
            Arrange tables for {branchName ?? "this branch"} — drag to move,
            use handles to resize and rotate
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {dirty && (
            <PillButton tone="neutral" onClick={() => void load()}>
              <RotateCcwIcon className="h-4 w-4" />
              Discard
            </PillButton>
          )}
          <PillButton
            tone="accent"
            isDisabled={!dirty || saving}
            onClick={() => void save()}
          >
            <SaveIcon className="h-4 w-4" />
            {saving ? "Saving…" : dirty ? "Save layout" : "Saved"}
          </PillButton>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 16 }}>
          <ErrorState message={error} onRetry={() => void load()} />
        </div>
      )}

      {/* Zone tabs */}
      <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {zones.map((z) => (
          <button
            key={z.id}
            onClick={() => {
              setActiveZoneId(z.id);
              selectTable(null);
            }}
            className="rounded-full border px-4 py-1.5 text-[13px] font-medium transition-colors"
            style={
              z.id === activeZoneId
                ? {
                    background: "var(--accent-soft)",
                    borderColor: "var(--accent)",
                    color: "var(--accent)",
                  }
                : {
                    background: "var(--bg-elev)",
                    borderColor: "var(--line-strong)",
                    color: "var(--ink)",
                  }
            }
          >
            {z.name}
          </button>
        ))}
        <PillButton tone="neutral" onClick={openZoneCreate}>
          <PlusIcon className="h-4 w-4" />
          Zone
        </PillButton>
        {activeZoneId && (
          <>
            <PillButton tone="neutral" onClick={openZoneRename}>
              Rename
            </PillButton>
            <PillButton
              tone="danger"
              variant="outline"
              onClick={() => setZoneDeleteOpen(true)}
            >
              Delete zone
            </PillButton>
          </>
        )}
      </div>

      {zones.length === 0 ? (
        <EmptyState
          title="No zones yet"
          description="Create a zone (e.g. Floor 1, Terrace) to start laying out tables."
          action={
            <PillButton tone="accent" onClick={openZoneCreate}>
              <PlusIcon className="h-4 w-4" />
              Create zone
            </PillButton>
          }
        />
      ) : (
        <div
          className="grid items-start gap-4"
          style={{ gridTemplateColumns: "minmax(0,1fr) 280px" }}
        >
          <FloorPlanCanvas
            tables={placedInZone}
            mode="edit"
            selectedId={selectedId}
            onSelect={selectTable}
            onChange={updateTable}
          />

          <div className="flex flex-col gap-4">
            {/* Inspector */}
            <div
              className="rounded-card border p-4"
              style={{
                background: "var(--bg-elev)",
                borderColor: "var(--line)",
              }}
            >
              <div
                className="eyebrow"
                style={{ marginBottom: 12, fontSize: 12 }}
              >
                {selected && isPlaced(selected)
                  ? `Table ${selected.tableNumber}`
                  : "Table properties"}
              </div>
              {selected && isPlaced(selected) ? (
                <div className="flex flex-col gap-3">
                  <div>
                    <span className="label">Table number</span>
                    <div className="flex items-center gap-2">
                      <TextInput
                        value={nameDraft}
                        onChange={(v: string) => {
                          setNameDraft(v);
                          setRenameError(null);
                        }}
                        icon={null}
                        type="text"
                        width="100%"
                        ariaLabel="Table number"
                        invalid={!!renameError}
                      />
                      <PillButton
                        tone="neutral"
                        isDisabled={
                          renaming ||
                          !nameDraft.trim() ||
                          nameDraft.trim() === selected.tableNumber
                        }
                        onClick={() => void renameTable()}
                      >
                        {renaming ? "…" : "Rename"}
                      </PillButton>
                    </div>
                    {renameError && (
                      <p
                        style={{
                          marginTop: 6,
                          fontSize: 12,
                          color: "var(--rose)",
                        }}
                      >
                        {renameError}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {numField("Width", selected.width, 40, 400, "width")}
                    {numField("Height", selected.height, 40, 400, "height")}
                    {numField("Seats", selected.seats, 1, 50, "seats")}
                    {numField("Rotate °", selected.rotation, 0, 359, "rotation")}
                  </div>
                  <Select
                    dark={isDark}
                    label="Shape"
                    options={[
                      { id: "rect", label: "Rectangle" },
                      { id: "circle", label: "Circle" },
                    ]}
                    selectedKey={selected.shape}
                    onSelectionChange={(k) =>
                      updateTable(selected.id, { shape: k as TableShape })
                    }
                    placeholder="Shape"
                  />
                  <div className="flex flex-col gap-2 pt-1">
                    <PillButton
                      tone="neutral"
                      onClick={() => removeFromPlan(selected.id)}
                    >
                      Remove from plan
                    </PillButton>
                    <PillButton
                      tone="danger"
                      variant="outline"
                      onClick={() => void deleteTable(selected.id)}
                    >
                      <Trash2Icon className="h-4 w-4" />
                      Delete table
                    </PillButton>
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: 13, color: "var(--text-2)" }}>
                  Select a table on the canvas to edit its size, shape, seats,
                  and rotation.
                </p>
              )}
            </div>

            {/* Unplaced tray */}
            <div
              className="rounded-card border p-4"
              style={{
                background: "var(--bg-elev)",
                borderColor: "var(--line)",
              }}
            >
              <div
                className="row"
                style={{ justifyContent: "space-between", marginBottom: 12 }}
              >
                <div className="eyebrow" style={{ fontSize: 12 }}>
                  Unplaced tables
                </div>
                <PillButton
                  tone="accent"
                  onClick={() => {
                    setTableError(null);
                    setTableModalOpen(true);
                  }}
                >
                  <PlusIcon className="h-4 w-4" />
                  Table
                </PillButton>
              </div>
              {unplaced.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--text-2)" }}>
                  Every table is placed on a plan.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {unplaced.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => placeTable(t)}
                      title={`Place table ${t.tableNumber} on ${zones.find((z) => z.id === activeZoneId)?.name ?? "plan"}`}
                      className="rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors hover:border-clay-500 hover:text-clay-500"
                      style={{
                        background: "var(--bg-sunken)",
                        borderColor: "var(--line-strong)",
                        color: "var(--ink)",
                      }}
                    >
                      {t.tableNumber}
                      <span
                        style={{
                          marginLeft: 6,
                          fontSize: 11,
                          color: "var(--text-2)",
                        }}
                      >
                        {t.seats} seats
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Zone create/rename modal */}
      <Modal
        isOpen={zoneModalOpen}
        onOpenChange={(open) => !open && setZoneModalOpen(false)}
        theme={isDark ? "dark" : "light"}
        className="sm:max-w-md dir-a"
        header={
          <div className="eyebrow" style={{ fontSize: 13, color: "var(--text)" }}>
            {zoneEditingId ? "Rename zone" : "New zone"}
          </div>
        }
        footer={
          <div className="flex w-full justify-end gap-2">
            <PillButton tone="neutral" onClick={() => setZoneModalOpen(false)}>
              Cancel
            </PillButton>
            <PillButton
              tone="accent"
              isDisabled={zoneSaving || !zoneName.trim()}
              onClick={() => void submitZone()}
            >
              {zoneSaving ? "Saving…" : zoneEditingId ? "Rename" : "Create"}
            </PillButton>
          </div>
        }
      >
        <div style={{ padding: "16px 20px" }}>
          {zoneError && (
            <div style={{ marginBottom: 12 }}>
              <ErrorState message={zoneError} />
            </div>
          )}
          <span className="label">Name</span>
          <TextInput
            value={zoneName}
            onChange={setZoneName}
            placeholder="e.g. Floor 1, Terrace"
            icon={null}
            type="text"
            width="100%"
            ariaLabel="Zone name"
          />
        </div>
      </Modal>

      {/* Zone delete confirm */}
      <Modal
        isOpen={zoneDeleteOpen}
        onOpenChange={(open) => !open && setZoneDeleteOpen(false)}
        theme={isDark ? "dark" : "light"}
        className="sm:max-w-md dir-a"
        header={
          <div className="eyebrow" style={{ fontSize: 13, color: "var(--text)" }}>
            Delete zone
          </div>
        }
        footer={
          <div className="flex w-full justify-end gap-2">
            <PillButton tone="neutral" onClick={() => setZoneDeleteOpen(false)}>
              Cancel
            </PillButton>
            <PillButton
              tone="danger"
              isDisabled={zoneSaving}
              onClick={() => void deleteZone()}
            >
              {zoneSaving ? "Deleting…" : "Delete zone"}
            </PillButton>
          </div>
        }
      >
        <div style={{ padding: "16px 20px" }}>
          <p style={{ fontSize: 13, color: "var(--text-2)" }}>
            Tables in this zone are not deleted — they move back to the
            unplaced tray. Unsaved layout changes will be discarded.
          </p>
        </div>
      </Modal>

      {/* Add table modal */}
      <Modal
        isOpen={tableModalOpen}
        onOpenChange={(open) => !open && setTableModalOpen(false)}
        theme={isDark ? "dark" : "light"}
        className="sm:max-w-md dir-a"
        header={
          <div className="eyebrow" style={{ fontSize: 13, color: "var(--text)" }}>
            New table
          </div>
        }
        footer={
          <div className="flex w-full justify-end gap-2">
            <PillButton tone="neutral" onClick={() => setTableModalOpen(false)}>
              Cancel
            </PillButton>
            <PillButton
              tone="accent"
              isDisabled={tableSaving || !newTableNumber.trim()}
              onClick={() => void submitTable()}
            >
              {tableSaving ? "Creating…" : "Create table"}
            </PillButton>
          </div>
        }
      >
        <div style={{ padding: "16px 20px" }}>
          {tableError && (
            <div style={{ marginBottom: 12 }}>
              <ErrorState message={tableError} />
            </div>
          )}
          <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 90px" }}>
            <div>
              <span className="label">Table number</span>
              <TextInput
                value={newTableNumber}
                onChange={setNewTableNumber}
                placeholder="e.g. 6 or A1"
                icon={null}
                type="text"
                width="100%"
                ariaLabel="Table number"
              />
            </div>
            <div>
              <span className="label">Seats</span>
              <TextInput
                value={newTableSeats}
                onChange={setNewTableSeats}
                type="number"
                mono
                icon={null}
                width="100%"
                ariaLabel="Seats"
              />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <Select
              dark={isDark}
              label="Shape"
              options={[
                { id: "rect", label: "Rectangle" },
                { id: "circle", label: "Circle" },
              ]}
              selectedKey={newTableShape}
              onSelectionChange={(k) => setNewTableShape(k as TableShape)}
              placeholder="Shape"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
