"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useMemo, useState } from "react";

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

  const markServed = async (order: OrderDTO) => {
    setServingId(order.id);
    setError(null);
    try {
      await api(`/api/orders/${order.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "served" }),
      });
      await loadOrders();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to mark served");
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

  // Selected table for the detail pane; defaults to the first table.
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  useEffect(() => {
    setSelectedTableId((curr) =>
      curr && tables.some((t) => t.id === curr)
        ? curr
        : tables[0]?.id ?? null,
    );
  }, [tables]);

  const selectedTable = tables.find((t) => t.id === selectedTableId) ?? null;
  const selectedOrders = selectedTableId
    ? ordersByTable.get(selectedTableId) ?? []
    : [];

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

      <div className="mx-auto flex max-w-6xl flex-col gap-5 p-4 sm:p-5 md:flex-row">
        {/* ---------- Side menu: Tables ---------- */}
        <aside className="w-full shrink-0 md:w-64">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
              Tables ({tables.length})
            </h2>
            {readyOrders.length > 0 && (
              <Badge tone="green">{readyOrders.length} ready</Badge>
            )}
          </div>

          {/* Add table */}
          <div className="mt-3 flex gap-2">
            <input
              value={newTable}
              onChange={(e) => setNewTable(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTable()}
              placeholder="New table #"
              className="w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-clay-300 focus:ring-2 focus:ring-clay-100"
            />
            <Button
              size="sm"
              onPress={addTable}
              isDisabled={addingTable || !newTable.trim()}
            >
              Add
            </Button>
          </div>
          {tableError && (
            <p className="mt-1 text-sm text-red-600">{tableError}</p>
          )}

          {/* Table list — horizontal scroll strip on mobile, vertical on md+ */}
          <nav className="mt-3 flex gap-2 overflow-x-auto pb-1 md:flex-col md:gap-1 md:overflow-visible md:pb-0">
            {tables.length === 0 ? (
              <p className="px-1 text-sm text-ink-muted">No tables yet.</p>
            ) : (
              tables.map((t) => {
                const active = t.id === selectedTableId;
                const ready = readyByTable.get(t.id) ?? 0;
                const count = (ordersByTable.get(t.id) ?? []).length;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTableId(t.id)}
                    className={cn(
                      "flex shrink-0 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors md:w-full md:shrink",
                      active
                        ? "border-clay-300 bg-clay-50 text-clay-700"
                        : "border-line text-ink-soft hover:bg-sand md:border-transparent",
                    )}
                  >
                    <span className="flex items-center gap-2 font-medium">
                      {ready > 0 && (
                        <span className="h-2 w-2 rounded-full bg-green-500" />
                      )}
                      Table {t.tableNumber}
                    </span>
                    <span className="flex items-center gap-1.5">
                      {count > 0 && (
                        <span className="text-xs text-ink-muted">{count}</span>
                      )}
                      <Badge tone={t.status === "occupied" ? "amber" : "neutral"}>
                        {t.status}
                      </Badge>
                    </span>
                  </button>
                );
              })
            )}
          </nav>
        </aside>

        {/* ---------- Detail: selected table ---------- */}
        <main className="min-w-0 flex-1">
          {error && (
            <div className="mb-4">
              <ErrorState message={error} />
            </div>
          )}

          {!selectedTable ? (
            <EmptyState
              title="No table selected"
              description="Add a table or pick one from the list to view its menu items."
            />
          ) : (
            <div className="rounded-card border border-line bg-white p-4 shadow-card sm:p-5">
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
                <ul className="mt-4 divide-y divide-line">
                  {menuLines.map(({ key, order, item }) => (
                    <li key={key} className="flex items-start gap-3 py-2.5">
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
                        <p className="mt-0.5 text-[11px] text-ink-muted">
                          {order.orderNumber}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <Badge tone={STATUS_TONE[order.status] ?? "neutral"}>
                          {order.status}
                        </Badge>
                        {order.status === "ready" && (
                          <Button
                            size="sm"
                            isDisabled={servingId === order.id}
                            onPress={() => markServed(order)}
                          >
                            {servingId === order.id ? "Serving…" : "Serve"}
                          </Button>
                        )}
                        {canCancel(order.status) && (
                          <Button
                            size="sm"
                            variant="danger"
                            onPress={() => setCancelTarget(order)}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </main>
      </div>

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
