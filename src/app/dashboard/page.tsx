"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const PAGE_SIZE = 5;

type SortKey = "name" | "branches" | "menu" | "status";
type SortDir = "asc" | "desc";

import { RestaurantFormModal } from "@/components/dashboard/RestaurantFormModal";
import { TopBar } from "@/components/dashboard/TopBar";
import { Modal } from "@/components/ui/Modal";
import { TextInput } from "@/components/ui/TextInput";
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
  const [menuCounts, setMenuCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);

  const [deleting, setDeleting] = useState<Restaurant | null>(null);
  const [removing, setRemoving] = useState(false);

  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    try {
      const stored = localStorage.getItem("rms.dashboard.theme");
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
        localStorage.setItem("rms.dashboard.theme", next);
      } catch {}
      return next;
    });
  };

  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? restaurants.filter((r) => r.name.toLowerCase().includes(q))
      : restaurants;
    const sorted = [...base].sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      if (sortKey === "name") {
        av = a.name.toLowerCase();
        bv = b.name.toLowerCase();
      } else if (sortKey === "branches") {
        av = a.branches.length;
        bv = b.branches.length;
      } else if (sortKey === "menu") {
        av = menuCounts[a.id] ?? -1;
        bv = menuCounts[b.id] ?? -1;
      } else if (sortKey === "status") {
        av = a.branches.length > 0 ? 1 : 0;
        bv = b.branches.length > 0 ? 1 : 0;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [restaurants, query, sortKey, sortDir, menuCounts]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Clamp page if the list shrinks (delete/filter on the last page).
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

  const load = () => {
    setLoading(true);
    setMenuTotal(null);
    setMenuCounts({});
    api<{ restaurants: Restaurant[] }>("/api/restaurants?withBranches=true")
      .then((d) => {
        setRestaurants(d.restaurants);
        return Promise.all(
          d.restaurants.map((r) =>
            api<{ total: number }>(`/api/menu?restaurantId=${r.id}&limit=1`)
              .then((m) => [r.id, m.total] as const)
              .catch(() => [r.id, 0] as const),
          ),
        ).then((entries) => {
          const map: Record<string, number> = {};
          let sum = 0;
          for (const [id, n] of entries) {
            map[id] = n;
            sum += n;
          }
          setMenuCounts(map);
          setMenuTotal(sum);
        });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

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

  const totalBranches = restaurants.reduce(
    (sum, r) => sum + r.branches.length,
    0,
  );
  const liveCount = restaurants.filter((r) => r.branches.length > 0).length;

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
        role="Admin"
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
            All restaurants
          </span>
        }
        right={<ThemeToggle theme={theme} onToggle={toggleTheme} />}
      />

      {loading ? (
        <Loading />
      ) : (
        <div style={{ padding: "28px 32px 80px", maxWidth: 1280, margin: "0 auto" }}>
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
            <span style={{ color: "var(--ink-2)" }}>RMS</span>
            <span style={{ margin: "0 8px", color: "var(--ink-4)" }}>·</span>
            <span className="tnum">{restaurants.length} restaurants</span>
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
                Select a restaurant
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--ink-3)",
                  marginTop: 6,
                  maxWidth: 560,
                }}
              >
                Pick a restaurant to manage its branches, menu, staff and
                analytics.
              </div>
            </div>
            <div
              style={{ display: "flex", alignItems: "center", gap: 10 }}
            >
              <TextInput
                value={query}
                onChange={(v) => {
                  setQuery(v);
                  setPage(1);
                }}
                placeholder="Search restaurants…"
              />
              <button
                onClick={() => setCreating(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  height: 38,
                  padding: "0 16px",
                  borderRadius: 999,
                  border: "1px solid var(--olive)",
                  background: "var(--olive-soft)",
                  color: "var(--olive)",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  boxShadow: "0 6px 18px -10px rgba(42,111,78,0.45)",
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  width={15}
                  height={15}
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
                New restaurant
              </button>
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
            <Stat label="Restaurants" value={String(restaurants.length)} />
            <Stat label="Branches" value={String(totalBranches)} />
            <Stat
              label="Menu items"
              value={menuTotal === null ? "…" : String(menuTotal)}
            />
          </div>

          {error && (
            <div style={{ marginBottom: 16 }}>
              <ErrorState message={error} />
            </div>
          )}

          {restaurants.length === 0 ? (
            <div
              style={{
                background: "var(--bg-elev)",
                border: "1px solid var(--line)",
                borderRadius: 16,
                padding: 32,
              }}
            >
              <EmptyState
                title="No restaurants yet"
                description="Create your first restaurant to get started."
                action={
                  <button
                    onClick={() => setCreating(true)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      height: 36,
                      padding: "0 14px",
                      borderRadius: 999,
                      border: "1px solid var(--olive)",
                      background: "var(--olive-soft)",
                      color: "var(--olive)",
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    New restaurant
                  </button>
                }
              />
            </div>
          ) : (
            <>
              <div
                style={{
                  background: "var(--bg-elev)",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                <RestaurantTable
                  restaurants={pageItems}
                  menuCounts={menuCounts}
                  startIndex={(page - 1) * PAGE_SIZE}
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  onOpen={(id) => router.push(`/dashboard/${id}`)}
                />
                <Pagination
                  page={page}
                  pageCount={pageCount}
                  total={filtered.length}
                  pageSize={PAGE_SIZE}
                  noun="restaurants"
                  onChange={setPage}
                />
              </div>
            </>
          )}

          <RestaurantFormModal
            isOpen={creating}
            onOpenChange={setCreating}
            onSaved={(id) => {
              setCreating(false);
              router.push(`/dashboard/${id}`);
            }}
            theme={theme}
          />

          {/* Delete confirmation modal */}
          <Modal
            isOpen={deleting !== null}
            onOpenChange={(open) => {
              if (!open) setDeleting(null);
            }}
            className={
              theme === "dark"
                ? "!border-[#2c2a23] !bg-[#1d1b16]"
                : ""
            }
          >
            <div
              className={`kds-theme${theme === "dark" ? " kds-dark" : ""}`}
              style={{ padding: 24, background: "var(--bg-elev)", color: "var(--ink)" }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--ink-3)",
                }}
              >
                Delete restaurant
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 600,
                  letterSpacing: "-0.02em",
                  marginTop: 2,
                }}
              >
                {deleting?.name}
              </div>
              <p style={{ marginTop: 14, fontSize: 13, color: "var(--ink-3)" }}>
                Are you sure you want to delete this restaurant? This cannot
                be undone, and only works if it has no branches.
              </p>
              <div style={{ display: "flex", gap: 8, marginTop: 22 }}>
                <button onClick={() => setDeleting(null)} style={btnGhostStyle}>
                  Cancel
                </button>
                <button
                  onClick={confirmRemove}
                  disabled={removing}
                  style={{
                    ...btnDangerStyle,
                    flex: 2,
                    opacity: removing ? 0.5 : 1,
                    cursor: removing ? "not-allowed" : "pointer",
                  }}
                >
                  {removing ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </Modal>
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

function BrandMark({ name, logo }: { name: string; logo: string | null }) {
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="r-brand"
        src={logo}
        alt=""
        style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          objectFit: "cover",
          border: "1px solid var(--line)",
          flexShrink: 0,
          transition: "background 0.12s ease, color 0.12s ease, border-color 0.12s ease",
        }}
      />
    );
  }
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
        transition: "background 0.12s ease, color 0.12s ease, border-color 0.12s ease",
      }}
    >
      {markOf(name)}
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
          <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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

function slugTag(name: string): string {
  const tag = name
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .join("")
    .toUpperCase();
  return tag.slice(0, 12) || "RESTAURANT";
}

function RestaurantTable({
  restaurants,
  menuCounts,
  startIndex,
  sortKey,
  sortDir,
  onSort,
  onOpen,
}: {
  restaurants: Restaurant[];
  menuCounts: Record<string, number>;
  startIndex: number;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  onOpen: (id: string) => void;
}) {
  const cols = "52px 56px minmax(220px, 1.8fr) 120px 130px 120px 130px";
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
          label="Restaurant"
          sortKey="name"
          active={sortKey === "name"}
          dir={sortDir}
          onSort={onSort}
        />
        <SortHeader
          label="Branches"
          align="right"
          sortKey="branches"
          active={sortKey === "branches"}
          dir={sortDir}
          onSort={onSort}
        />
        <SortHeader
          label="Menu items"
          align="right"
          sortKey="menu"
          active={sortKey === "menu"}
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

      {restaurants.map((r, i) => {
        const items = menuCounts[r.id];
        const live = r.branches.length > 0;
        const rowNumber = String(startIndex + i + 1).padStart(2, "0");
        return (
          <div
            key={r.id}
            className="r-row"
            role="link"
            tabIndex={0}
            onClick={() => onOpen(r.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen(r.id);
              }
            }}
            style={{
              display: "grid",
              gridTemplateColumns: cols,
              gap: 12,
              padding: "14px 18px",
              borderTop: i > 0 ? "1px solid var(--line)" : "none",
              alignItems: "center",
              cursor: live ? "pointer" : "default",
              transition: "background 0.12s ease",
              opacity: live ? 1 : 0.62,
              textDecoration: "none",
            }}
            onMouseEnter={(e) => {
              if (!live) return;
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
            <BrandMark name={r.name} logo={r.logo} />
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
                {r.name}
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
                {slugTag(r.name)}
              </div>
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
              {r.branches.length}
            </div>
            <div
              className="tnum"
              style={{
                fontSize: 14,
                fontWeight: 500,
                textAlign: "right",
                color: items == null ? "var(--ink-4)" : "var(--ink)",
              }}
            >
              {items == null ? "…" : items}
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
                onClick={() => onOpen(r.id)}
                disabled={!live}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  height: 30,
                  padding: "0 12px",
                  borderRadius: 999,
                  border: "1px solid transparent",
                  background: "transparent",
                  color: live ? "var(--ink)" : "var(--ink-4)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: live ? "pointer" : "not-allowed",
                  letterSpacing: "0.01em",
                  textDecoration: "none",
                  transition: "color 0.12s ease",
                }}
                onMouseEnter={(e) => {
                  if (!live) return;
                  e.currentTarget.style.color = "var(--accent)";
                  e.currentTarget.style.textDecoration = "none";
                }}
                onMouseLeave={(e) => {
                  if (!live) return;
                  e.currentTarget.style.color = "var(--ink)";
                  e.currentTarget.style.textDecoration = "none";
                }}
              >
                Manage
                <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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

  // Build a compact page list with ellipses around large gaps.
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
      <div
        className="tnum"
        style={{ fontSize: 12, color: "var(--ink-3)" }}
      >
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
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            Next
            <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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


const btnGhostStyle: React.CSSProperties = {
  flex: 1,
  height: 42,
  borderRadius: 8,
  border: "1px solid var(--line-strong)",
  background: "transparent",
  color: "var(--ink)",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
};

const btnDangerStyle: React.CSSProperties = {
  height: 42,
  borderRadius: 8,
  border: "1px solid var(--rose)",
  background: "var(--rose)",
  color: "#fff",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
