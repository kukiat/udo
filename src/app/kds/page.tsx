"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { TopBar } from "@/components/dashboard/TopBar";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/fetcher";

const PAGE_SIZE = 5;

type SortKey =
  | "name"
  | "restaurant"
  | "address"
  | "tables"
  | "occupied"
  | "status";
type SortDir = "asc" | "desc";

type Branch = {
  id: string;
  name: string;
  address: string | null;
  restaurant?: { id: string; name: string } | null;
};
type TableRow = {
  id: string;
  tableNumber: string;
  status: "available" | "occupied";
};
type BranchWithTables = Branch & { tables: TableRow[] };

function markOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "B"
  );
}

function slugTag(name: string): string {
  const tag = name
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .join("")
    .toUpperCase();
  return tag.slice(0, 12) || "BRANCH";
}

// Entry point for KDS: list the restaurant's branches together with each
// branch's tables, and let the user pick one to open its kitchen display.
export default function KdsIndex() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [branches, setBranches] = useState<BranchWithTables[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    try {
      const stored = localStorage.getItem("rms.kds.theme");
      if (stored === "light" || stored === "dark") setTheme(stored);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("kds-theme");
    if (theme === "dark") root.classList.add("kds-dark");
    else root.classList.remove("kds-dark");
    return () => {
      root.classList.remove("kds-theme", "kds-dark");
    };
  }, [theme]);
  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      try {
        localStorage.setItem("rms.kds.theme", next);
      } catch {}
      return next;
    });
  };

  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login?next=/kds");
      return;
    }
    setLoading(true);
    setBranches(null);
    api<{ branches: Branch[]; total: number }>(
      `/api/branches?withRestaurant=true`,
    )
      .then(async (d) => {
        const withTables = await Promise.all(
          d.branches.map(async (b) => {
            const { tables } = await api<{ tables: TableRow[] }>(
              `/api/tables?branchId=${b.id}`,
            );
            return { ...b, tables };
          }),
        );
        setBranches(withTables);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load branches"),
      )
      .finally(() => setLoading(false));
  }, [user, authLoading, router]);

  const occupiedOf = (b: BranchWithTables) =>
    b.tables.filter((t) => t.status === "occupied").length;

  const filtered = useMemo(() => {
    const list = branches ?? [];
    const q = query.trim().toLowerCase();
    const base = q
      ? list.filter(
          (b) =>
            b.name.toLowerCase().includes(q) ||
            (b.restaurant?.name ?? "").toLowerCase().includes(q) ||
            (b.address ?? "").toLowerCase().includes(q),
        )
      : list;
    const sorted = [...base].sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      if (sortKey === "name") {
        av = a.name.toLowerCase();
        bv = b.name.toLowerCase();
      } else if (sortKey === "restaurant") {
        av = (a.restaurant?.name ?? "").toLowerCase();
        bv = (b.restaurant?.name ?? "").toLowerCase();
      } else if (sortKey === "address") {
        av = (a.address ?? "").toLowerCase();
        bv = (b.address ?? "").toLowerCase();
      } else if (sortKey === "tables") {
        av = a.tables.length;
        bv = b.tables.length;
      } else if (sortKey === "occupied") {
        av = occupiedOf(a);
        bv = occupiedOf(b);
      } else if (sortKey === "status") {
        av = a.tables.length > 0 ? 1 : 0;
        bv = b.tables.length > 0 ? 1 : 0;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [branches, query, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);
  const pageItems = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const totalBranches = branches?.length ?? 0;
  const totalTables = (branches ?? []).reduce(
    (sum, b) => sum + b.tables.length,
    0,
  );
  const totalOccupied = (branches ?? []).reduce(
    (sum, b) => sum + occupiedOf(b),
    0,
  );
  const liveCount = (branches ?? []).filter((b) => b.tables.length > 0).length;

  return (
    <div
      suppressHydrationWarning
      className={`kds-theme${theme === "dark" ? " kds-dark" : ""}`}
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        color: "var(--ink)",
      }}
    >
      <TopBar
        role="Kitchen"
        showLive={false}
        left={
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: "-0.005em",
              color: "var(--ink-2)",
            }}
          >
            All branches
          </span>
        }
        right={<ThemeToggle theme={theme} onToggle={toggleTheme} />}
      />

      {loading || authLoading ? (
        <Loading />
      ) : (
        <div
          style={{
            padding: "28px 32px 80px",
            maxWidth: 1280,
            margin: "0 auto",
          }}
        >
          {/* Section header */}
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--ink-3)",
              marginBottom: 10,
            }}
          >
            <span style={{ color: "var(--ink-2)" }}>KDS</span>
            <span style={{ margin: "0 8px", color: "var(--ink-4)" }}>·</span>
            <span className="tnum">{totalBranches} branches</span>
            <span style={{ margin: "0 8px", color: "var(--ink-4)" }}>·</span>
            <span className="tnum" style={{ color: "var(--olive)" }}>
              {liveCount} live
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 16,
              marginBottom: 22,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 600,
                  letterSpacing: "-0.025em",
                  lineHeight: 1.05,
                  color: "var(--ink)",
                }}
              >
                Select a branch
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--ink-3)",
                  marginTop: 6,
                  maxWidth: 560,
                }}
              >
                Pick a branch to open its kitchen display. Tickets stream in
                real time as orders are placed.
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <SearchInput
                value={query}
                onChange={(v) => {
                  setQuery(v);
                  setPage(1);
                }}
                placeholder="Search branches…"
              />
            </div>
          </div>

          {/* KPI strip */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 16,
              marginBottom: 20,
            }}
          >
            <Stat label="Branches" value={String(totalBranches)} />
            <Stat label="Tables" value={String(totalTables)} />
            <Stat label="Occupied" value={String(totalOccupied)} />
          </div>

          {error && (
            <div style={{ marginBottom: 16 }}>
              <ErrorState message={error} />
            </div>
          )}

          {totalBranches === 0 ? (
            <div
              style={{
                background: "var(--bg-elev)",
                border: "1px solid var(--line)",
                borderRadius: 16,
                padding: 32,
              }}
            >
              <EmptyState
                title="No branches"
                description="There are no branches available to display."
              />
            </div>
          ) : (
            <div
              style={{
                background: "var(--bg-elev)",
                border: "1px solid var(--line)",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              <BranchTable
                branches={pageItems}
                startIndex={(page - 1) * PAGE_SIZE}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                onOpen={(id) => router.push(`/kds/${id}`)}
              />
              <Pagination
                page={page}
                pageCount={pageCount}
                total={filtered.length}
                pageSize={PAGE_SIZE}
                noun="branches"
                onChange={setPage}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="r-stat-card"
      style={{
        background: "var(--bg-elev)",
        border: "1px solid var(--line)",
        borderRadius: 16,
        padding: "18px 20px",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ink-3)",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        className="tnum"
        style={{
          fontSize: 30,
          fontWeight: 600,
          letterSpacing: "-0.025em",
          lineHeight: 1,
          color: "var(--ink)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function BrandMark({ name }: { name: string }) {
  return (
    <div
      className="r-brand"
      style={{
        width: 40,
        height: 40,
        borderRadius: 8,
        background: "var(--accent-soft)",
        color: "var(--accent)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: 13,
        letterSpacing: "0.04em",
        flexShrink: 0,
        border: "1px solid var(--accent-soft)",
        transition:
          "background 0.12s ease, color 0.12s ease, border-color 0.12s ease",
      }}
    >
      {markOf(name)}
    </div>
  );
}

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div style={{ position: "relative", width: 260, height: 38 }}>
      <svg
        viewBox="0 0 24 24"
        width={14}
        height={14}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 12,
          top: "50%",
          transform: "translateY(-50%)",
          color: "var(--ink-4)",
          pointerEvents: "none",
        }}
      >
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          height: "100%",
          padding: "0 12px 0 34px",
          background: "var(--bg-elev)",
          border: "1px solid var(--line)",
          borderRadius: 10,
          fontSize: 13,
          color: "var(--ink)",
          outline: "none",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "var(--line-strong)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "var(--line)";
        }}
      />
    </div>
  );
}

function SortHeader({
  label,
  align = "left",
  sortKey,
  active,
  dir,
  onSort,
}: {
  label: string;
  align?: "left" | "right" | "center";
  sortKey?: SortKey;
  active?: boolean;
  dir?: SortDir;
  onSort?: (key: SortKey) => void;
}) {
  const sortable = !!sortKey && !!onSort;
  return (
    <button
      type="button"
      disabled={!sortable}
      onClick={() => sortable && onSort!(sortKey!)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        justifyContent:
          align === "right"
            ? "flex-end"
            : align === "center"
            ? "center"
            : "flex-start",
        width: "100%",
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: sortable ? "pointer" : "default",
        fontSize: 10,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        fontWeight: 600,
        color: active ? "var(--ink-2)" : "var(--ink-3)",
        fontFamily: "inherit",
      }}
    >
      <span>{label}</span>
      {sortable && (
        <svg
          viewBox="0 0 12 12"
          width={9}
          height={9}
          aria-hidden="true"
          style={{
            transform:
              active && dir === "asc" ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.12s ease",
            opacity: active ? 1 : 0.55,
          }}
        >
          <path
            d="M2 4l4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}

function StatusPill({ live }: { live: boolean }) {
  if (!live) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "4px 12px",
          borderRadius: 999,
          background: "var(--bg-sunken)",
          border: "1px solid transparent",
          color: "var(--ink-3)",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.02em",
        }}
      >
        Closed
      </span>
    );
  }
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px 4px 8px",
        borderRadius: 999,
        background: "var(--olive-soft)",
        border: "1px solid color-mix(in srgb, var(--olive) 18%, transparent)",
        color: "var(--olive)",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.02em",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: "var(--olive)",
          animation: "blink 1.6s infinite",
        }}
      />
      Live
    </span>
  );
}

function BranchTable({
  branches,
  startIndex,
  sortKey,
  sortDir,
  onSort,
  onOpen,
}: {
  branches: BranchWithTables[];
  startIndex: number;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  onOpen: (id: string) => void;
}) {
  const cols =
    "52px 56px minmax(220px, 1.6fr) minmax(160px, 1fr) 110px 110px 120px 120px";
  return (
    <div>
      {/* Header row */}
      <div
        className="r-table-header"
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
        <SortHeader label="#" />
        <span />
        <SortHeader
          label="Branch"
          sortKey="name"
          active={sortKey === "name"}
          dir={sortDir}
          onSort={onSort}
        />
        <SortHeader
          label="Restaurant"
          sortKey="restaurant"
          active={sortKey === "restaurant"}
          dir={sortDir}
          onSort={onSort}
        />
        <SortHeader
          label="Tables"
          align="right"
          sortKey="tables"
          active={sortKey === "tables"}
          dir={sortDir}
          onSort={onSort}
        />
        <SortHeader
          label="Occupied"
          align="right"
          sortKey="occupied"
          active={sortKey === "occupied"}
          dir={sortDir}
          onSort={onSort}
        />
        <SortHeader
          label="Status"
          align="center"
          sortKey="status"
          active={sortKey === "status"}
          dir={sortDir}
          onSort={onSort}
        />
        <SortHeader label="" align="right" />
      </div>

      {branches.map((b, i) => {
        const occupied = b.tables.filter((t) => t.status === "occupied").length;
        const live = b.tables.length > 0;
        const rowNumber = String(startIndex + i + 1).padStart(2, "0");
        return (
          <div
            key={b.id}
            className="r-row"
            role="link"
            tabIndex={0}
            onClick={() => onOpen(b.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen(b.id);
              }
            }}
            style={{
              display: "grid",
              gridTemplateColumns: cols,
              gap: 12,
              padding: "14px 18px",
              borderTop: i > 0 ? "1px solid var(--line)" : "none",
              alignItems: "center",
              cursor: "pointer",
              transition: "background 0.12s ease",
              textDecoration: "none",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--bg-sunken)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "";
            }}
          >
            <span
              className="tnum mono"
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "var(--ink-4)",
                letterSpacing: "0.04em",
              }}
            >
              {rowNumber}
            </span>
            <BrandMark name={b.name} />
            <div style={{ minWidth: 0 }}>
              <div
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
              </div>
              <div
                className="mono"
                style={{
                  marginTop: 4,
                  fontSize: 10,
                  color: "var(--ink-4)",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                {slugTag(b.name)}
              </div>
            </div>
            <div
              style={{
                minWidth: 0,
                fontSize: 13,
                color: "var(--ink-2)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              <div
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {b.restaurant?.name ?? "—"}
              </div>
              {b.address && (
                <div
                  style={{
                    marginTop: 2,
                    fontSize: 11,
                    color: "var(--ink-4)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {b.address}
                </div>
              )}
            </div>
            <div
              className="tnum"
              style={{
                fontSize: 14,
                fontWeight: 500,
                textAlign: "right",
                color: "var(--ink)",
              }}
            >
              {b.tables.length}
            </div>
            <div
              className="tnum"
              style={{
                fontSize: 14,
                fontWeight: 500,
                textAlign: "right",
                color: occupied > 0 ? "var(--accent)" : "var(--ink-4)",
              }}
            >
              {occupied}
            </div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <StatusPill live={live} />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => onOpen(b.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  height: 30,
                  padding: "0 12px",
                  borderRadius: 999,
                  border: "1px solid transparent",
                  background: "transparent",
                  color: "var(--ink)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  letterSpacing: "0.01em",
                  textDecoration: "none",
                  transition: "color 0.12s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--accent)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--ink)";
                }}
              >
                Open
                <svg
                  viewBox="0 0 24 24"
                  width={13}
                  height={13}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: "light" | "dark";
  onToggle: () => void;
}) {
  const nextLabel = theme === "light" ? "Dark" : "Light";
  return (
    <button
      onClick={onToggle}
      aria-label={`Switch to ${nextLabel} theme`}
      title={`Switch to ${nextLabel} theme`}
      className="btn-quiet"
      style={{
        gap: 6,
        padding: "6px 10px",
        borderRadius: 8,
        color: "var(--ink-2)",
        fontSize: 12,
        letterSpacing: "0.02em",
      }}
    >
      <span aria-hidden style={{ fontSize: 13, lineHeight: 1 }}>
        {theme === "light" ? "◐" : "○"}
      </span>
      {nextLabel}
    </button>
  );
}

function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  noun = "items",
  onChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  noun?: string;
  onChange: (next: number) => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const go = (next: number) => {
    const clamped = Math.min(pageCount, Math.max(1, next));
    if (clamped !== page) onChange(clamped);
  };

  const pages: (number | "…")[] = [];
  if (pageCount <= 7) {
    for (let i = 1; i <= pageCount; i++) pages.push(i);
  } else {
    pages.push(1);
    const start = Math.max(2, page - 1);
    const end = Math.min(pageCount - 1, page + 1);
    if (start > 2) pages.push("…");
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < pageCount - 1) pages.push("…");
    pages.push(pageCount);
  }

  return (
    <div
      className="r-table-footer"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "12px 18px",
        borderTop: "1px solid var(--line)",
        background: "var(--bg-elev)",
      }}
    >
      <div className="tnum" style={{ fontSize: 12, color: "var(--ink-3)" }}>
        Showing{" "}
        <span style={{ color: "var(--ink)", fontWeight: 600 }}>{from}</span>
        {"–"}
        <span style={{ color: "var(--ink)", fontWeight: 600 }}>{to}</span> of{" "}
        <span style={{ color: "var(--ink)", fontWeight: 600 }}>{total}</span>{" "}
        {noun}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <PageBtn
          disabled={page <= 1}
          onClick={() => go(page - 1)}
          aria-label="Previous page"
        >
          <span
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <svg
              viewBox="0 0 24 24"
              width={11}
              height={11}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Prev
          </span>
        </PageBtn>
        {pages.map((p, i) =>
          p === "…" ? (
            <span
              key={`e${i}`}
              style={{
                width: 32,
                textAlign: "center",
                fontSize: 13,
                color: "var(--ink-4)",
              }}
            >
              …
            </span>
          ) : (
            <PageBtn
              key={p}
              active={p === page}
              onClick={() => go(p)}
              aria-label={`Page ${p}`}
              aria-current={p === page ? "page" : undefined}
            >
              {p}
            </PageBtn>
          ),
        )}
        <PageBtn
          disabled={page >= pageCount}
          onClick={() => go(page + 1)}
          aria-label="Next page"
        >
          <span
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            Next
            <svg
              viewBox="0 0 24 24"
              width={11}
              height={11}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </span>
        </PageBtn>
      </div>
    </div>
  );
}

function PageBtn({
  children,
  active,
  disabled,
  onClick,
  ...rest
}: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
} & React.AriaAttributes) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth: 34,
        height: 32,
        padding: "0 11px",
        borderRadius: 8,
        border: "1px solid",
        borderColor: active ? "var(--ink)" : "var(--line)",
        background: active ? "var(--ink)" : "transparent",
        color: active ? "var(--bg-elev)" : "var(--ink-2)",
        fontSize: 12,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transition: "background 0.12s ease, color 0.12s ease",
      }}
      onMouseEnter={(e) => {
        if (active || disabled) return;
        e.currentTarget.style.background = "var(--bg-sunken)";
        e.currentTarget.style.color = "var(--ink)";
      }}
      onMouseLeave={(e) => {
        if (active || disabled) return;
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = "var(--ink-2)";
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
