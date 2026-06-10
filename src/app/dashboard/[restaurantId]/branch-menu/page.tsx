"use client";

import { useEffect, useMemo, useState } from "react";

import { ItemSwatch } from "@/components/menu/ItemSwatch";
import { TextInput } from "@/components/ui/TextInput";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { usePageTitle } from "@/hooks/usePageTitle";
import { api } from "@/lib/fetcher";
import { formatPrice } from "@/lib/utils";

type Row = {
  menuItemId: string;
  name: string;
  image: string | null;
  categoryName: string | null;
  basePrice: string;
  masterStatus: "available" | "sold_out" | "hidden";
  isAvailable: boolean;
  overridePrice: string | null;
};

type Filter = "all" | "available" | "inactive";

function normalizeOverridePrice(price: string | null) {
  const trimmed = price?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

function hasRowChanged(row: Row, original?: Row) {
  if (!original) return true;
  return (
    row.isAvailable !== original.isAvailable ||
    normalizeOverridePrice(row.overridePrice) !==
      normalizeOverridePrice(original.overridePrice)
  );
}

export default function BranchMenuPage() {
  const { branchId, branchName, loading: ctxLoading } = useRestaurant();
  usePageTitle(branchName ? `Branch menu — ${branchName}` : "Branch menu");
  const [rows, setRows] = useState<Row[]>([]);
  const [originalRows, setOriginalRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const load = () => {
    if (!branchId) {
      setRows([]);
      setOriginalRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setSaved(false);
    api<{ items: Row[] }>(`/api/branch-menu?branchId=${branchId}`)
      .then((d) => {
        setRows(d.items);
        setOriginalRows(d.items);
      })
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

  const originalByItemId = useMemo(
    () => new Map(originalRows.map((row) => [row.menuItemId, row])),
    [originalRows],
  );

  const dirtyRows = useMemo(
    () =>
      rows.filter((row) =>
        hasRowChanged(row, originalByItemId.get(row.menuItemId)),
      ),
    [rows, originalByItemId],
  );

  const save = async () => {
    if (!branchId) return;
    if (dirtyRows.length === 0) {
      setSaved(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api("/api/branch-menu", {
        method: "POST",
        body: JSON.stringify({
          branchId,
          items: dirtyRows.map((r) => ({
            menuItemId: r.menuItemId,
            isAvailable: r.isAvailable,
            price: r.overridePrice ?? "",
          })),
        }),
      });
      setOriginalRows(rows);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save overrides");
    } finally {
      setSaving(false);
    }
  };

  const availableCount = rows.filter((r) => r.isAvailable).length;
  const inactiveCount = rows.length - availableCount;
  const priceOverrideCount = rows.filter((r) => r.overridePrice?.trim()).length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesFilter =
        filter === "all"
          ? true
          : filter === "available"
            ? r.isAvailable
            : !r.isAvailable;
      const matchesQuery =
        !q ||
        r.name.toLowerCase().includes(q) ||
        (r.categoryName ?? "").toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });
  }, [rows, filter, query]);

  if (ctxLoading || loading) return <Loading />;

  if (!branchId) {
    return (
      <div className="mx-auto flex h-full max-w-[1280px] flex-col">
        <SectionHead
          overline="Branch menu"
          title="Menu availability"
          subtitle="Select a branch from the top bar before editing item availability."
        />
        <EmptyState
          title="No branch selected"
          description="Create a branch for this restaurant, then pick it from the top bar."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-[1280px] flex-col">
      <SectionHead
        overline="Branch menu"
        title="Menu availability"
        subtitle={`${branchName ?? "Selected branch"} item overrides`}
        action={
          <button
            type="button"
            onClick={save}
            disabled={saving || dirtyRows.length === 0}
            className="inline-flex h-[34px] items-center gap-2 rounded-md border border-[color:var(--line-strong)] bg-[color:var(--bg-elev)] px-3.5 text-[13px] font-medium text-[color:var(--ink)] transition-colors hover:bg-[color:var(--bg-sunken)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span aria-hidden style={{ fontSize: 13 }}>
              {saving ? "..." : "Save"}
            </span>
            {saving
              ? "Saving"
              : dirtyRows.length > 0
                ? `Save ${dirtyRows.length} change${dirtyRows.length === 1 ? "" : "s"}`
                : "No changes"}
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Total items" value={String(rows.length)} sub="Master menu" />
        <Stat
          label="Available here"
          value={String(availableCount)}
          sub={`${Math.round((availableCount / Math.max(rows.length, 1)) * 100)}% active`}
          tone="olive"
        />
        <Stat
          label="Price overrides"
          value={String(priceOverrideCount)}
          sub={`${inactiveCount} inactive`}
          tone={inactiveCount > 0 ? "rose" : "neutral"}
        />
      </div>

      {saved && (
        <div className="mt-4 rounded-card border border-olive bg-olive-soft px-4 py-3 text-[13px] font-medium text-olive">
          Branch menu overrides saved.
        </div>
      )}

      {error && (
        <div className="mt-4">
          <ErrorState message={error} onRetry={load} />
        </div>
      )}

      <div className="mt-4 flex min-h-0 flex-1 flex-col rounded-card border border-line bg-white p-4">
        <CardHead
          title="Items"
          subtitle={`${visible.length} shown`}
          action={
            <TextInput
              value={query}
              onChange={setQuery}
              placeholder="Search items..."
              width={240}
            />
          }
        />

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>
            All
            <span className="tnum">{rows.length}</span>
          </FilterButton>
          <FilterButton
            active={filter === "available"}
            tone="olive"
            onClick={() => setFilter("available")}
          >
            Available
            <span className="tnum">{availableCount}</span>
          </FilterButton>
          <FilterButton
            active={filter === "inactive"}
            tone="rose"
            onClick={() => setFilter("inactive")}
          >
            Inactive
            <span className="tnum">{inactiveCount}</span>
          </FilterButton>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            title="No menu items"
            description={query ? "No items match the current search." : "Create menu items first."}
          />
        ) : (
          <div className="grid min-h-0 grid-cols-1 gap-3 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((row) => (
              <BranchMenuItemCard
                key={row.menuItemId}
                row={row}
                onUpdate={(patch) => update(row.menuItemId, patch)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionHead({
  overline,
  title,
  subtitle,
  action,
}: {
  overline?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 flex-1">
        {overline && (
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            {overline}
          </div>
        )}
        <div
          className="text-[24px] font-semibold text-ink"
          style={{ letterSpacing: "-0.02em", lineHeight: 1.1 }}
        >
          {title}
        </div>
        {subtitle && (
          <div className="mt-1 text-[13px] text-ink-muted">{subtitle}</div>
        )}
      </div>
      {action && <div className="flex shrink-0">{action}</div>}
    </div>
  );
}

function CardHead({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div
          className="text-[16px] font-semibold text-ink"
          style={{ letterSpacing: "-0.005em", lineHeight: 1.2 }}
        >
          {title}
        </div>
        {subtitle && (
          <div className="mt-0.5 text-[12px] text-ink-muted">{subtitle}</div>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "olive" | "rose";
}) {
  const valueColor =
    tone === "olive"
      ? "text-olive"
      : tone === "rose"
        ? "text-rose"
        : "text-ink";

  return (
    <div className="rounded-card border border-line bg-white p-5">
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-muted">
        {label}
      </div>
      <div
        className={`tnum mt-2 text-[30px] font-semibold ${valueColor}`}
        style={{ letterSpacing: "-0.025em", lineHeight: 1 }}
      >
        {value}
      </div>
      {sub && <div className="mt-1.5 text-[12px] text-ink-muted">{sub}</div>}
    </div>
  );
}

function FilterButton({
  active,
  tone = "neutral",
  children,
  onClick,
}: {
  active: boolean;
  tone?: "neutral" | "olive" | "rose";
  children: React.ReactNode;
  onClick: () => void;
}) {
  const activeStyle =
    tone === "olive"
      ? "border-olive bg-olive-soft text-olive"
      : tone === "rose"
        ? "border-rose bg-rose-soft text-rose"
        : "border-ink bg-ink text-white";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-[30px] items-center gap-2 rounded-full border px-3 text-[12px] font-semibold transition-colors ${
        active
          ? activeStyle
          : "border-line-strong bg-[color:var(--bg-elev)] text-ink-soft hover:bg-[color:var(--bg-sunken)]"
      }`}
    >
      {children}
    </button>
  );
}

function BranchMenuItemCard({
  row,
  onUpdate,
}: {
  row: Row;
  onUpdate: (patch: Partial<Row>) => void;
}) {
  const off = !row.isAvailable;

  return (
    <div
      className="rounded-card border bg-white p-3 shadow-card transition-colors"
      style={{
        borderColor: off ? "var(--rose)" : "var(--line)",
        opacity: off ? 0.62 : 1,
      }}
    >
      <div className="flex items-start gap-3">
        <ItemSwatch
          id={row.menuItemId}
          name={row.name}
          image={row.image}
          size="xs"
          className="rounded-lg"
        />
        <div className="min-w-0 flex-1">
          <div
            className="truncate text-[13px] font-semibold text-ink"
            style={{ letterSpacing: "-0.005em" }}
          >
            {row.name}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-ink-muted">
            {row.categoryName ?? "Uncategorized"}
          </div>
          {row.masterStatus !== "available" && (
            <div className="mt-1 inline-flex rounded-full border border-rose bg-rose-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-rose">
              Master {row.masterStatus.replace("_", " ")}
            </div>
          )}
        </div>
        <AvailabilityToggle
          checked={row.isAvailable}
          onClick={() => onUpdate({ isAvailable: !row.isAvailable })}
        />
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-3">
        <label className="min-w-0">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            Branch price
          </span>
          <TextInput
            value={row.overridePrice ?? ""}
            onChange={(value) => onUpdate({ overridePrice: value || null })}
            placeholder={formatPrice(row.basePrice)}
            inputMode="decimal"
            type="text"
            mono
            icon={null}
            width="100%"
            height={32}
            ariaLabel={`Branch price for ${row.name}`}
            inputStyle={{
              padding: "0 10px",
              fontSize: 12,
            }}
          />
        </label>
        <div className="pb-1 text-right">
          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            Base
          </div>
          <div className="tnum text-[12px] font-semibold text-ink">
            {formatPrice(row.basePrice)}
          </div>
        </div>
      </div>
    </div>
  );
}

function AvailabilityToggle({
  checked,
  onClick,
}: {
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={checked ? "Mark item hidden" : "Mark item available"}
      onClick={onClick}
      className="relative h-[22px] w-[38px] shrink-0 rounded-full border transition-colors"
      style={{
        background: checked ? "var(--olive)" : "var(--bg-sunken)",
        borderColor: checked ? "var(--olive)" : "var(--line-strong)",
      }}
    >
      <span
        aria-hidden="true"
        className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full transition-[left,background-color]"
        style={{
          left: checked ? 18 : 2,
          background: checked ? "#fff" : "var(--ink-4)",
        }}
      />
    </button>
  );
}
