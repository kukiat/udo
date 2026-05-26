"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CancelOrderDialog } from "@/components/order/CancelOrderDialog";
import { AccountMenu } from "@/components/ui/AccountMenu";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/cn";
import { api } from "@/lib/fetcher";
import { getSocket } from "@/lib/socket-client";
import type { OrderDTO, OrderStatus } from "@/types";

type TableRow = {
  id: string;
  tableNumber: string;
  status: "available" | "occupied";
};
type Branch = { id: string; name: string };
type BranchInfo = { id: string; name: string; restaurant: { name: string } };

// Statuses a waiter monitors per table (everything still on the floor).
const MONITORED: OrderStatus[] = ["pending", "preparing", "ready", "served"];
const STATUS_TONE: Record<string, "neutral" | "amber" | "blue" | "green"> = {
  pending: "neutral",
  preparing: "amber",
  ready: "green",
  served: "blue",
};
// Sort priority for the menu list: ready first, then pending, preparing, served.
const STATUS_RANK: Record<string, number> = {
  ready: 0,
  pending: 1,
  preparing: 2,
  served: 3,
};
// Status filter options shown in the detail pane, in priority order.
const FILTER_STATUSES: OrderStatus[] = [
  "ready",
  "pending",
  "preparing",
  "served",
];

// An order can still be cancelled while the kitchen hasn't finished it.
const canCancel = (status: OrderStatus) =>
  status === "pending" || status === "preparing";

// Next status a waiter can advance an order to, with the button label.
const NEXT_STATUS: Partial<Record<OrderStatus, { next: OrderStatus; label: string }>> = {
  pending: { next: "preparing", label: "Start" },
  preparing: { next: "ready", label: "Ready" },
  ready: { next: "served", label: "Serve" },
};

// Wall-clock time the order was placed, e.g. "14:32".
const startClock = (createdAt: string) =>
  new Date(createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

// Time since the order was placed, e.g. "5:20".
const elapsed = (createdAt: string, now: number) => {
  const ms = Math.max(0, now - new Date(createdAt).getTime());
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}:${String(secs).padStart(2, "0")}`;
};

// Orders still on the floor past this age are flagged as overdue.
const OVERDUE_MS = 10 * 60 * 1000;
const isOverdue = (createdAt: string, now: number) =>
  now - new Date(createdAt).getTime() >= OVERDUE_MS;

function StatCard({
  label,
  value,
  tone = "neutral",
  highlight = false,
}: {
  label: string;
  value: number;
  tone?: "neutral" | "amber" | "green";
  highlight?: boolean;
}) {
  const valueTone = {
    neutral: "text-ink",
    amber: "text-amber-600",
    green: "text-green-600",
  }[tone];
  return (
    <div
      className={cn(
        "rounded-card border p-4 shadow-card",
        highlight
          ? "border-transparent bg-clay-500 text-white"
          : "border-line bg-white",
      )}
    >
      <p
        className={cn(
          "text-sm font-medium",
          highlight ? "text-white/80" : "text-ink-muted",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-2xl font-bold",
          highlight ? "text-white" : valueTone,
        )}
      >
        {value}
      </p>
    </div>
  );
}

export default function WaitstaffPage() {
  const { branchId } = useParams<{ branchId: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [branch, setBranch] = useState<BranchInfo | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [orders, setOrders] = useState<OrderDTO[]>([]);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [servingId, setServingId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<OrderDTO | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const [newTable, setNewTable] = useState("");
  const [addingTable, setAddingTable] = useState(false);
  const [tableError, setTableError] = useState<string | null>(null);

  // Active session id per table id — used to gate / build the order link.
  const [sessionByTable, setSessionByTable] = useState<Map<string, string>>(
    new Map(),
  );
  const [openingTableId, setOpeningTableId] = useState<string | null>(null);
  const [linkModal, setLinkModal] = useState<{
    tableNumber: string;
    url: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const loadOrders = useCallback(async () => {
    const d = await api<{ orders: OrderDTO[] }>(
      `/api/orders?branchId=${branchId}&statuses=${MONITORED.join(",")}`,
    );
    setOrders(d.orders);
  }, [branchId]);

  const loadTables = useCallback(async () => {
    const d = await api<{ tables: TableRow[] }>(
      `/api/tables?branchId=${branchId}`,
    );
    setTables(d.tables);
  }, [branchId]);

  const loadSessions = useCallback(async () => {
    const d = await api<{ sessions: { sessionId: string; tableId: string }[] }>(
      `/api/pos/sessions?branchId=${branchId}`,
    );
    setSessionByTable(
      new Map(d.sessions.map((s) => [s.tableId, s.sessionId])),
    );
  }, [branchId]);

  const orderLink = (tableNumber: string, sessionId: string) =>
    `${window.location.origin}/order/${branchId}/${encodeURIComponent(
      tableNumber,
    )}?s=${sessionId}`;

  const openSession = async (table: TableRow) => {
    setOpeningTableId(table.id);
    setError(null);
    try {
      const { session } = await api<{ session: { id: string } }>(
        "/api/sessions",
        {
          method: "POST",
          body: JSON.stringify({ branchId, tableId: table.id }),
        },
      );
      await Promise.all([loadSessions(), loadTables()]);
      setCopied(false);
      setLinkModal({
        tableNumber: table.tableNumber,
        url: orderLink(table.tableNumber, session.id),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to open session");
    } finally {
      setOpeningTableId(null);
    }
  };

  const showLink = (table: TableRow) => {
    const sessionId = sessionByTable.get(table.id);
    if (!sessionId) return;
    setCopied(false);
    setLinkModal({
      tableNumber: table.tableNumber,
      url: orderLink(table.tableNumber, sessionId),
    });
  };

  const copyLink = async () => {
    if (!linkModal) return;
    try {
      await navigator.clipboard.writeText(linkModal.url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  // Branch list for the selector — scoped to the user's restaurant.
  useEffect(() => {
    if (!user) return;
    api<{ branches: Branch[] }>(
      `/api/branches?restaurantId=${user.restaurantId}`,
    )
      .then((d) => setBranches(d.branches))
      .catch(() => setBranches([]));
  }, [user]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api<{ branch: BranchInfo }>(`/api/branches/${branchId}`).then((d) =>
        setBranch(d.branch),
      ),
      loadOrders(),
      loadTables(),
      loadSessions(),
    ])
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [branchId, loadOrders, loadTables, loadSessions]);

  // Live updates via the branch room — replaces interval polling. A new order,
  // a status change, or a settled bill all shift orders/tables/sessions, so we
  // refresh the affected slices in response to each event.
  useEffect(() => {
    const socket = getSocket();

    const refreshOrders = () => loadOrders().catch(() => {});
    const refreshAll = () => {
      loadOrders().catch(() => {});
      loadTables().catch(() => {});
      loadSessions().catch(() => {});
    };

    socket.on("order:new", refreshAll);
    socket.on("order:status-update", refreshOrders);
    socket.on("bill:paid", refreshAll);

    const join = () => socket.emit("branch:join", { branchId });
    if (socket.connected) join();
    socket.on("connect", join);

    return () => {
      socket.off("order:new", refreshAll);
      socket.off("order:status-update", refreshOrders);
      socket.off("bill:paid", refreshAll);
      socket.off("connect", join);
    };
  }, [branchId, loadOrders, loadTables, loadSessions]);

  const advanceStatus = async (order: OrderDTO, next: OrderStatus) => {
    setServingId(order.id);
    setError(null);
    try {
      await api(`/api/orders/${order.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      await loadOrders();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setServingId(null);
    }
  };

  const confirmCancel = async (reason?: string) => {
    if (!cancelTarget) return;
    setCancelling(true);
    setError(null);
    try {
      await api(`/api/orders/${cancelTarget.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: reason?.trim() || undefined }),
      });
      setCancelTarget(null);
      await loadOrders();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to cancel order");
    } finally {
      setCancelling(false);
    }
  };

  const addTable = async () => {
    if (!newTable.trim()) return;
    setAddingTable(true);
    setTableError(null);
    try {
      await api("/api/tables", {
        method: "POST",
        body: JSON.stringify({ branchId, tableNumber: newTable.trim() }),
      });
      setNewTable("");
      await loadTables();
    } catch (e) {
      setTableError(e instanceof Error ? e.message : "Failed to add table");
    } finally {
      setAddingTable(false);
    }
  };

  // Group monitored orders by table id.
  const ordersByTable = useMemo(() => {
    const m = new Map<string, OrderDTO[]>();
    for (const o of orders) {
      const arr = m.get(o.tableId) ?? [];
      arr.push(o);
      m.set(o.tableId, arr);
    }
    return m;
  }, [orders]);

  const readyOrders = useMemo(
    () => orders.filter((o) => o.status === "ready"),
    [orders],
  );
  const readyByTable = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of readyOrders)
      m.set(o.tableId, (m.get(o.tableId) ?? 0) + 1);
    return m;
  }, [readyOrders]);

  // Table selected for the detail modal (null = modal closed).
  const [detailTableId, setDetailTableId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  // Ticking clock so elapsed times and overdue alerts update live.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Briefly highlight orders that just arrived or changed status.
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const prevStatusRef = useRef<Map<string, OrderStatus> | null>(null);
  useEffect(() => {
    const prev = prevStatusRef.current;
    const snapshot = new Map(orders.map((o) => [o.id, o.status]));
    prevStatusRef.current = snapshot;
    // Skip the first load — don't flash every pre-existing order on mount.
    if (prev === null) return;

    const changed = orders
      .filter((o) => prev.get(o.id) !== o.status)
      .map((o) => o.id);
    if (changed.length === 0) return;

    setFlashIds((curr) => new Set([...curr, ...changed]));
    const timer = setTimeout(() => {
      setFlashIds((curr) => {
        const next = new Set(curr);
        changed.forEach((id) => next.delete(id));
        return next;
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [orders]);
  // Grid toolbar filters.
  const [search, setSearch] = useState("");
  const [tableFilter, setTableFilter] = useState<"all" | "available" | "occupied">(
    "all",
  );

  const openDetail = (tableId: string) => {
    setStatusFilter("all");
    setDetailTableId(tableId);
  };

  const selectedTable = tables.find((t) => t.id === detailTableId) ?? null;
  const selectedOrders = detailTableId
    ? ordersByTable.get(detailTableId) ?? []
    : [];

  const filteredTables = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tables.filter((t) => {
      if (tableFilter !== "all" && t.status !== tableFilter) return false;
      if (q && !t.tableNumber.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tables, tableFilter, search]);

  const occupiedCount = tables.filter((t) => t.status === "occupied").length;
  const availableCount = tables.filter((t) => t.status === "available").length;

  // Flatten the selected table's orders into individual menu-item lines,
  // filtered by status and sorted ready → pending → preparing → served.
  const menuLines = useMemo(() => {
    const lines = selectedOrders.flatMap((o) =>
      o.items.map((item) => ({ key: item.id, order: o, item })),
    );
    const filtered =
      statusFilter === "all"
        ? lines
        : lines.filter((l) => l.order.status === statusFilter);
    return filtered.sort(
      (a, b) =>
        (STATUS_RANK[a.order.status] ?? 9) -
        (STATUS_RANK[b.order.status] ?? 9),
    );
  }, [selectedOrders, statusFilter]);

  const statusCount = (s: OrderStatus) =>
    selectedOrders.reduce(
      (n, o) => n + (o.status === s ? o.items.length : 0),
      0,
    );

  if (loading) return <Loading />;

  return (
    <div className="min-h-screen bg-cream">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-white px-4 py-3 sm:px-5 sm:py-4">
        <div>
          <h1 className="text-xl font-bold text-ink">Waitstaff</h1>
          {branch && (
            <p className="mt-0.5 text-sm text-ink-muted">
              {branch.restaurant.name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {branches.length > 0 && (
            <Select
              label=""
              className="w-44"
              options={branches.map((b) => ({ id: b.id, label: b.name }))}
              selectedKey={branchId}
              onSelectionChange={(k) => k && router.push(`/waitstaff/${k}`)}
            />
          )}
          <Link href={`/pos/${branchId}`}>
            <Button variant="secondary" size="sm">
              Cashier / POS
            </Button>
          </Link>
          <AccountMenu />
        </div>
      </header>

      <div className="mx-auto max-w-6xl p-4 sm:p-5">
        {error && (
          <div className="mb-4">
            <ErrorState message={error} />
          </div>
        )}

        {/* ---------- Stat cards ---------- */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            highlight
            label="Total Orders"
            value={orders.length}
          />
          <StatCard label="Occupied" value={occupiedCount} tone="amber" />
          <StatCard label="Ready" value={readyOrders.length} tone="green" />
          <StatCard label="Available" value={availableCount} tone="neutral" />
        </div>

        {/* ---------- Toolbar: search, status filter, add table ---------- */}
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-card border border-line bg-white p-3 shadow-card">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tables…"
            className="min-w-[10rem] flex-1 rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-clay-300 focus:ring-2 focus:ring-clay-100"
          />
          <Select
            label=""
            className="w-44"
            options={[
              { id: "all", label: "All statuses" },
              { id: "available", label: "Available" },
              { id: "occupied", label: "Occupied" },
            ]}
            selectedKey={tableFilter}
            onSelectionChange={(k) =>
              setTableFilter(k as "all" | "available" | "occupied")
            }
          />
          <div className="flex items-center gap-2">
            <input
              value={newTable}
              onChange={(e) => setNewTable(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTable()}
              placeholder="New table #"
              className="w-32 rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-clay-300 focus:ring-2 focus:ring-clay-100"
            />
            <Button
              size="sm"
              onPress={addTable}
              isDisabled={addingTable || !newTable.trim()}
            >
              Add
            </Button>
          </div>
        </div>
        {tableError && <p className="mt-2 text-sm text-red-600">{tableError}</p>}

        {/* ---------- Table card grid ---------- */}
        {filteredTables.length === 0 ? (
          <div className="mt-5">
            <EmptyState
              title={tables.length === 0 ? "No tables yet" : "No tables match"}
              description={
                tables.length === 0
                  ? "Add a table to start monitoring orders."
                  : "Try a different search or status filter."
              }
            />
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {filteredTables.map((t) => {
              const ready = readyByTable.get(t.id) ?? 0;
              const tableOrders = ordersByTable.get(t.id) ?? [];
              const count = tableOrders.filter(
                (o) => o.status !== "served",
              ).length;
              const overdue = tableOrders.filter(
                (o) => o.status !== "served" && isOverdue(o.createdAt, now),
              ).length;
              const flashing = tableOrders.some((o) => flashIds.has(o.id));
              return (
                <button
                  key={t.id}
                  onClick={() => openDetail(t.id)}
                  className={cn(
                    "group flex flex-col gap-3 rounded-card border bg-white p-4 text-left shadow-card transition-all duration-500",
                    flashing
                      ? "border-orange-300 bg-orange-50"
                      : overdue > 0
                        ? "border-red-300 ring-1 ring-red-200"
                        : "border-line hover:border-clay-300",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sand text-sm font-bold text-ink-soft">
                        {t.tableNumber}
                      </span>
                      <span className="font-semibold text-ink">
                        Table {t.tableNumber}
                      </span>
                    </div>
                    {overdue > 0 ? (
                      <Badge tone="red" className="animate-pulse">
                        {overdue} overdue
                      </Badge>
                    ) : (
                      <Badge tone={t.status === "occupied" ? "amber" : "green"}>
                        {t.status}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between border-t border-line pt-3 text-sm text-ink-muted">
                    <span>
                      {count} active order{count === 1 ? "" : "s"}
                    </span>
                    {ready > 0 ? (
                      <span className="flex items-center gap-1.5 font-medium text-green-700">
                        <span className="h-2 w-2 rounded-full bg-green-500" />
                        {ready} ready
                      </span>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ---------- Detail modal: selected table ---------- */}
      <Modal
        isOpen={selectedTable !== null}
        onOpenChange={(open) => !open && setDetailTableId(null)}
      >
        {selectedTable && (
          <div className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-ink">
                Table {selectedTable.tableNumber}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                {sessionByTable.has(selectedTable.id) && (
                  <Link
                    href={`/pos/${branchId}?session=${sessionByTable.get(
                      selectedTable.id,
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button size="sm" variant="secondary">
                      Cashier / POS
                    </Button>
                  </Link>
                )}
                {sessionByTable.has(selectedTable.id) ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onPress={() => showLink(selectedTable)}
                  >
                    Order link
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    isDisabled={openingTableId === selectedTable.id}
                    onPress={() => openSession(selectedTable)}
                  >
                    {openingTableId === selectedTable.id
                      ? "Opening…"
                      : "Open session"}
                  </Button>
                )}
                <Badge
                  tone={
                    selectedTable.status === "occupied" ? "amber" : "neutral"
                  }
                >
                  {selectedTable.status}
                </Badge>
              </div>
            </div>

            {/* Status filter */}
            <div className="mt-4 flex flex-wrap gap-1.5">
              {(["all", ...FILTER_STATUSES] as const).map((s) => {
                const active = statusFilter === s;
                const count =
                  s === "all"
                    ? selectedOrders.reduce((n, o) => n + o.items.length, 0)
                    : statusCount(s);
                return (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition",
                      active
                        ? "bg-ink text-white"
                        : "border border-line bg-white text-ink-soft hover:bg-sand",
                    )}
                  >
                    {s === "all" ? "All" : s}
                    <span
                      className={cn(
                        "rounded-full px-1.5 text-[10px]",
                        active ? "bg-white/20" : "bg-sand text-ink-muted",
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Menu item list (sorted ready → pending → preparing → served) */}
            {menuLines.length === 0 ? (
              <p className="mt-5 text-sm text-ink-muted">
                {selectedOrders.length === 0
                  ? "No active orders on this table."
                  : "No items match this status."}
              </p>
            ) : (
              <ul className="mt-4 max-h-[50vh] space-y-1 overflow-y-auto overflow-x-hidden pr-1">
                {menuLines.map(({ key, order, item }) => {
                  const overdue =
                    order.status !== "served" &&
                    isOverdue(order.createdAt, now);
                  const flash = flashIds.has(order.id);
                  return (
                  <li
                    key={key}
                    className={cn(
                      "flex items-start gap-3 border px-2.5 py-2.5 transition-all",
                      "animate-in fade-in slide-in-from-top-1 duration-300",
                      flash
                        ? "rounded-lg border-orange-300 bg-orange-50"
                        : overdue
                          ? "rounded-lg border-red-200 bg-red-50"
                          : "border-transparent border-b-line",
                    )}
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-sand text-xs font-semibold text-ink-soft">
                      {item.quantity}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">
                        {item.name}
                      </p>
                      {(item.options.length > 0 || item.note) && (
                        <p className="text-xs italic text-ink-muted">
                          {[
                            ...item.options.map((o) => o.name),
                            ...(item.note ? [item.note] : []),
                          ].join(" · ")}
                        </p>
                      )}
                      <p
                        className={cn(
                          "mt-0.5 text-[11px]",
                          overdue
                            ? "font-semibold text-red-600"
                            : "text-ink-muted",
                        )}
                      >
                        {order.orderNumber} · Started{" "}
                        {startClock(order.createdAt)}
                        {(order.status === "pending" ||
                          order.status === "preparing") &&
                          ` · ${elapsed(order.createdAt, now)} elapsed`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {overdue && (
                        <Badge tone="red" className="animate-pulse">
                          Overdue
                        </Badge>
                      )}
                      <Badge tone={STATUS_TONE[order.status] ?? "neutral"}>
                        {order.status}
                      </Badge>
                      {NEXT_STATUS[order.status] && (
                        <Button
                          size="sm"
                          isDisabled={servingId === order.id}
                          className={cn(
                            order.status === "ready" &&
                              "!bg-green-600 hover:!bg-green-700",
                          )}
                          onPress={() =>
                            advanceStatus(
                              order,
                              NEXT_STATUS[order.status]!.next,
                            )
                          }
                        >
                          {servingId === order.id
                            ? "Updating…"
                            : NEXT_STATUS[order.status]!.label}
                        </Button>
                      )}
                      {canCancel(order.status) && (
                        <Button
                          size="sm"
                          variant="danger"
                          aria-label="Cancel order"
                          className="px-2"
                          onPress={() => setCancelTarget(order)}
                        >
                          <svg
                            viewBox="0 0 16 16"
                            width={16}
                            height={16}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            strokeLinecap="round"
                          >
                            <path d="M4 4l8 8M12 4l-8 8" />
                          </svg>
                        </Button>
                      )}
                    </div>
                  </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-5 flex justify-end">
              <Button
                variant="secondary"
                onPress={() => setDetailTableId(null)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <CancelOrderDialog
        order={cancelTarget}
        cancelling={cancelling}
        onConfirm={confirmCancel}
        onDismiss={() => setCancelTarget(null)}
      />

      <Modal
        isOpen={linkModal !== null}
        onOpenChange={(open) => !open && setLinkModal(null)}
      >
        {linkModal && (
          <div className="p-5">
            <h2 className="text-lg font-bold text-ink">
              Order link · Table {linkModal.tableNumber}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Scan the QR code or share the link with the customer. It stays
              valid until the session is closed.
            </p>
            <div className="mt-4 flex justify-center">
              <div className="rounded-xl border border-line bg-white p-4">
                <QRCodeSVG value={linkModal.url} size={192} level="M" />
              </div>
            </div>
            <a
              href={linkModal.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 block break-all rounded-xl border border-line bg-sand px-3 py-2 text-sm text-clay-600 underline underline-offset-2 hover:bg-sand/70"
            >
              {linkModal.url}
            </a>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onPress={() => setLinkModal(null)}>
                Close
              </Button>
              <Button onPress={copyLink}>
                {copied ? "Copied!" : "Copy link"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
