"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CancelOrderDialog } from "@/components/order/CancelOrderDialog";
import { BranchPill, MarrowTopBar } from "@/components/dashboard/TopBar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/cn";
import { api } from "@/lib/fetcher";
import { getSocket } from "@/lib/socket-client";
import { formatPrice } from "@/lib/utils";
import type {
  CategoryWithItemsDTO,
  MenuItemDTO,
  OrderDTO,
  OrderItemDTO,
  OrderStatus,
} from "@/types";

// Local cart line for the menu picker drawer. Options aren't supported in this
// quick-fire flow — staff can edit individual items later in POS if needed.
type DraftLine = {
  menuItemId: string;
  name: string;
  price: number;
  qty: number;
};

// Per-line price: unitPrice * qty + sum(option prices). Mirrors how the bill
// is computed server-side.
function lineTotal(item: OrderItemDTO): number {
  const base = parseFloat(item.unitPrice) * item.quantity;
  const opts = item.options.reduce((s, o) => s + parseFloat(o.price), 0);
  return base + opts;
}

function orderSubtotal(order: OrderDTO): number {
  return order.items.reduce((s, it) => s + lineTotal(it), 0);
}

type TableRow = {
  id: string;
  tableNumber: string;
  status: "available" | "occupied";
};
type Branch = { id: string; name: string };
type BranchInfo = { id: string; name: string; restaurant: { name: string } };
type SessionInfo = {
  sessionId: string;
  createdAt: string;
  billStatus: "open" | "requested" | "paid";
};

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

// How long the session has been open, e.g. "1h 05m" or "12m".
const sessionDuration = (createdAt: string, now: number) => {
  const ms = Math.max(0, now - new Date(createdAt).getTime());
  const totalMins = Math.floor(ms / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return hours > 0 ? `${hours}h ${String(mins).padStart(2, "0")}m` : `${mins}m`;
};

// Orders still on the floor past this age are flagged as overdue.
const OVERDUE_MS = 10 * 60 * 1000;
const isOverdue = (createdAt: string, now: number) =>
  now - new Date(createdAt).getTime() >= OVERDUE_MS;

// Marrow-style KPI tile: small uppercase label, big tnum value, optional
// sub line. Matches the design's Stat component (label / value / sub).
function StatCard({
  label,
  value,
  sub,
  tone = "neutral",
  highlight = false,
}: {
  label: string;
  value: number;
  sub?: string;
  tone?: "neutral" | "amber" | "green" | "clay";
  highlight?: boolean;
}) {
  const valueTone = {
    neutral: "text-ink",
    amber: "text-amber",
    green: "text-olive",
    clay: "text-clay-500",
  }[tone];
  return (
    <div
      className={cn(
        "rounded-card border p-5 shadow-card",
        highlight
          ? "border-transparent bg-ink text-white"
          : "border-line bg-white",
      )}
    >
      <p
        className={cn(
          "text-[11px] font-semibold uppercase tracking-[0.08em]",
          highlight ? "text-white/70" : "text-ink-muted",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mono mt-2 text-[30px] font-semibold tabular-nums leading-none tracking-[-0.025em]",
          highlight ? "text-white" : valueTone,
        )}
      >
        {value}
      </p>
      {sub && (
        <p
          className={cn(
            "mt-1.5 text-[12px]",
            highlight ? "text-white/60" : "text-ink-muted",
          )}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

// Small floor stat — colored pill tile used alongside the toolbar.
// Mirrors the design's FloorStat (Open / Seated / To pay).
function FloorStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "olive" | "amber" | "clay";
}) {
  const palette = {
    olive: "bg-olive-soft text-olive",
    amber: "bg-amber-soft text-amber",
    clay: "bg-clay-100 text-clay-700",
  }[tone];
  return (
    <div
      className={cn(
        "flex min-w-[88px] flex-col items-center rounded-card px-3 py-2",
        palette,
      )}
    >
      <span className="mono text-[18px] font-semibold leading-none tabular-nums">
        {value}
      </span>
      <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.1em]">
        {label}
      </span>
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

  // Active session per table id — used to gate / build the order link and to
  // show the session start time + how long it's been open.
  const [sessionByTable, setSessionByTable] = useState<Map<string, SessionInfo>>(
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
    const d = await api<{
      sessions: {
        sessionId: string;
        tableId: string;
        createdAt: string;
        billStatus: "open" | "requested" | "paid";
      }[];
    }>(`/api/pos/sessions?branchId=${branchId}`);
    setSessionByTable(
      new Map(
        d.sessions.map((s) => [
          s.tableId,
          {
            sessionId: s.sessionId,
            createdAt: s.createdAt,
            billStatus: s.billStatus,
          },
        ]),
      ),
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
    const session = sessionByTable.get(table.id);
    if (!session) return;
    setCopied(false);
    setLinkModal({
      tableNumber: table.tableNumber,
      url: orderLink(table.tableNumber, session.sessionId),
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

    const refreshSessions = () => loadSessions().catch(() => {});

    socket.on("order:new", refreshAll);
    socket.on("order:status-update", refreshOrders);
    socket.on("bill:paid", refreshAll);
    socket.on("bill:requested", refreshSessions);

    const join = () => socket.emit("branch:join", { branchId });
    if (socket.connected) join();
    socket.on("connect", join);

    return () => {
      socket.off("order:new", refreshAll);
      socket.off("order:status-update", refreshOrders);
      socket.off("bill:paid", refreshAll);
      socket.off("bill:requested", refreshSessions);
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

  // Tables whose customers have asked for the check.
  const checkRequestedCount = useMemo(
    () =>
      Array.from(sessionByTable.values()).filter(
        (s) => s.billStatus === "requested",
      ).length,
    [sessionByTable],
  );

  // Table selected for the detail modal (null = modal closed).
  const [detailTableId, setDetailTableId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");

  // Menu picker drawer — opens when an order card is clicked. Builds a new
  // round for the same table and fires it to the kitchen.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMenu, setPickerMenu] = useState<CategoryWithItemsDTO[] | null>(
    null,
  );
  const [pickerMenuLoading, setPickerMenuLoading] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerCategoryId, setPickerCategoryId] = useState<string | null>(null);
  const [pickerCart, setPickerCart] = useState<DraftLine[]>([]);
  const [pickerFiring, setPickerFiring] = useState(false);

  // Lock body scroll while the picker drawer is open so the page behind it
  // doesn't move when the user scrolls inside the drawer.
  useEffect(() => {
    if (!pickerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [pickerOpen]);

  const openPicker = useCallback(async () => {
    setPickerOpen(true);
    if (!pickerMenu) {
      setPickerMenuLoading(true);
      try {
        const d = await api<{ categories: CategoryWithItemsDTO[] }>(
          `/api/storefront/menu?branchId=${branchId}`,
        );
        setPickerMenu(d.categories);
        if (d.categories[0] && !pickerCategoryId) {
          setPickerCategoryId(d.categories[0].id);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load menu");
      } finally {
        setPickerMenuLoading(false);
      }
    }
  }, [branchId, pickerMenu, pickerCategoryId]);

  const closePicker = () => {
    setPickerOpen(false);
    setPickerSearch("");
  };

  const addToPicker = (item: MenuItemDTO) => {
    setPickerCart((prev) => {
      const existing = prev.find((l) => l.menuItemId === item.id);
      if (existing) {
        return prev.map((l) =>
          l === existing ? { ...l, qty: l.qty + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          menuItemId: item.id,
          name: item.name,
          price: parseFloat(item.price),
          qty: 1,
        },
      ];
    });
  };

  const updatePickerQty = (menuItemId: string, qty: number) => {
    setPickerCart((prev) =>
      prev
        .map((l) => (l.menuItemId === menuItemId ? { ...l, qty } : l))
        .filter((l) => l.qty > 0),
    );
  };

  const fireToKitchen = async () => {
    if (!selectedTable || pickerCart.length === 0) return;
    setPickerFiring(true);
    setError(null);
    try {
      await api("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          branchId,
          tableId: selectedTable.id,
          items: pickerCart.map((l) => ({
            menuItemId: l.menuItemId,
            quantity: l.qty,
          })),
        }),
      });
      setPickerCart([]);
      closePicker();
      await Promise.all([loadOrders(), loadSessions(), loadTables()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fire order");
    } finally {
      setPickerFiring(false);
    }
  };

  // Menu items visible in the picker — filtered by search or active category.
  const pickerVisible = useMemo<MenuItemDTO[]>(() => {
    if (!pickerMenu) return [];
    const q = pickerSearch.trim().toLowerCase();
    if (q) {
      return pickerMenu
        .flatMap((c) => c.items)
        .filter(
          (i) =>
            i.name.toLowerCase().includes(q) ||
            (i.description ?? "").toLowerCase().includes(q),
        );
    }
    const cat =
      pickerMenu.find((c) => c.id === pickerCategoryId) ?? pickerMenu[0];
    return cat?.items ?? [];
  }, [pickerMenu, pickerSearch, pickerCategoryId]);

  const pickerSubtotal = pickerCart.reduce((s, l) => s + l.price * l.qty, 0);
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

  // Selected table's orders filtered by the status pill and sorted ready →
  // pending → preparing → served. Each order renders as one card with its own
  // subtotal (matches the design's ExistingOrderCard pattern).
  const visibleOrders = useMemo(() => {
    const filtered =
      statusFilter === "all"
        ? selectedOrders
        : selectedOrders.filter((o) => o.status === statusFilter);
    return [...filtered].sort(
      (a, b) =>
        (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9),
    );
  }, [selectedOrders, statusFilter]);

  const selectedTableTotal = useMemo(
    () => selectedOrders.reduce((s, o) => s + orderSubtotal(o), 0),
    [selectedOrders],
  );

  const statusCount = (s: OrderStatus) =>
    selectedOrders.reduce(
      (n, o) => n + (o.status === s ? o.items.length : 0),
      0,
    );

  if (loading) return <Loading />;

  return (
    <div className="min-h-screen bg-cream">
      <MarrowTopBar
        label="STAFF TERMINAL"
        right={
          <>
            {branches.length > 0 && (
              <BranchPill
                branches={branches}
                branchId={branchId}
                onChange={(id) => router.push(`/waitstaff/${id}`)}
              />
            )}
            <Link href={`/pos/${branchId}`}>
              <Button variant="secondary" size="sm">
                Cashier / POS
              </Button>
            </Link>
          </>
        }
      />

      {error && (
        <div className="px-5 pt-4 sm:px-7">
          <ErrorState message={error} />
        </div>
      )}

      {/* ---------- Workstation: left FloorPanel + right detail pane ---------- */}
      <div className="grid min-h-[calc(100vh-3.5rem)] grid-cols-1 lg:grid-cols-[340px_1fr]">
        {/* ============ Left: Floor panel ============ */}
        <aside className="flex flex-col border-line bg-white lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:overflow-hidden lg:border-r">
          {/* Header */}
          <div className="border-b border-line p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
              Floor map
            </div>
            <div className="mt-1 text-[16px] font-semibold tracking-[-0.01em] text-ink">
              {branch?.name ?? "—"} · {tables.length} tables
            </div>
            <div className="mt-3 flex gap-1.5">
              <FloorStat label="Open" value={availableCount} tone="olive" />
              <FloorStat label="Seated" value={occupiedCount} tone="amber" />
              <FloorStat label="To pay" value={checkRequestedCount} tone="clay" />
            </div>
          </div>

          {/* Search + filter */}
          <div className="flex flex-col gap-2 border-b border-line p-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tables…"
              className="w-full rounded-sm border border-line-strong bg-white px-3 py-2 text-sm outline-none focus:border-clay-500 focus:ring-2 focus:ring-clay-100"
            />
            <div className="flex gap-1">
              {(["all", "available", "occupied"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setTableFilter(f)}
                  className={cn(
                    "flex-1 rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize transition",
                    tableFilter === f
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-white text-ink-soft hover:bg-sand",
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Table tile grid */}
          <div className="flex-1 overflow-y-auto p-3">
            {filteredTables.length === 0 ? (
              <EmptyState
                title={tables.length === 0 ? "No tables yet" : "No tables match"}
                description={
                  tables.length === 0
                    ? "Add tables when creating the branch in the dashboard."
                    : "Try a different search or filter."
                }
              />
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {filteredTables.map((t) => {
              const ready = readyByTable.get(t.id) ?? 0;
              const session = sessionByTable.get(t.id);
              const checkRequested = session?.billStatus === "requested";
              const tableOrders = ordersByTable.get(t.id) ?? [];
              const count = tableOrders.filter(
                (o) => o.status !== "served",
              ).length;
              const overdue = tableOrders.filter(
                (o) => o.status !== "served" && isOverdue(o.createdAt, now),
              ).length;
              const flashing = tableOrders.some((o) => flashIds.has(o.id));

              // Marrow tile palette: status drives bg + dot color. Overdue and
              // check-requested override with attention-grabbing accents.
              const visual = checkRequested
                ? {
                    bg: "bg-clay-100 border-clay-500",
                    fg: "text-clay-700",
                    dot: "bg-clay-500 animate-marrow-blink",
                  }
                : overdue > 0
                  ? {
                      bg: "bg-rose-soft border-rose",
                      fg: "text-rose",
                      dot: "bg-rose animate-marrow-blink",
                    }
                  : flashing
                    ? {
                        bg: "bg-clay-50 border-clay-300",
                        fg: "text-clay-700",
                        dot: "bg-clay-500",
                      }
                    : t.status === "occupied"
                      ? {
                          bg: "bg-amber-soft border-line",
                          fg: "text-ink-soft",
                          dot: "bg-amber",
                        }
                      : {
                          bg: "bg-olive-soft border-line",
                          fg: "text-olive",
                          dot: "bg-olive",
                        };
              return (
                <button
                  key={t.id}
                  onClick={() => openDetail(t.id)}
                  className={cn(
                    "group relative flex aspect-square flex-col justify-between rounded-card border bg-white p-3 text-left shadow-card transition-all duration-200",
                    visual.bg,
                    "hover:-translate-y-px hover:border-ink",
                  )}
                >
                  {/* Top row: table label + status dot */}
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={cn(
                        "mono text-[18px] font-bold leading-none tracking-tight",
                        visual.fg,
                      )}
                    >
                      {t.tableNumber}
                    </span>
                    <span
                      className={cn("h-1.5 w-1.5 rounded-full", visual.dot)}
                    />
                  </div>

                  {/* Middle: ready / overdue chips */}
                  <div className="flex flex-wrap gap-1">
                    {checkRequested && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-clay-500 px-2 py-[2px] text-[10px] font-semibold text-white">
                        Check
                      </span>
                    )}
                    {overdue > 0 && !checkRequested && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose px-2 py-[2px] text-[10px] font-semibold text-white">
                        {overdue} late
                      </span>
                    )}
                    {ready > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-olive px-2 py-[2px] text-[10px] font-semibold text-white">
                        <span className="h-1 w-1 rounded-full bg-white" />
                        {ready} ready
                      </span>
                    )}
                  </div>

                  {/* Bottom row: orders count · session timer */}
                  <div className="flex items-center justify-between gap-1 text-[10px] text-ink-muted">
                    <span className="inline-flex items-center gap-1">
                      <svg
                        viewBox="0 0 16 16"
                        width={10}
                        height={10}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="2" y="3" width="12" height="10" rx="1.5" />
                        <path d="M5 6h6M5 9h4" />
                      </svg>
                      {count}
                    </span>
                    {session && (
                      <span className="mono inline-flex items-center gap-1 tabular-nums">
                        <svg
                          viewBox="0 0 16 16"
                          width={10}
                          height={10}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.5}
                          strokeLinecap="round"
                        >
                          <circle cx="8" cy="8" r="6" />
                          <path d="M8 5v3l2 1.5" />
                        </svg>
                        {sessionDuration(session.createdAt, now)}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
              </div>
            )}
          </div>
        </aside>

        {/* ============ Right: TablePanel ============ */}
        <main className="flex min-w-0 flex-col bg-sand">
          {!selectedTable ? (
            <div className="flex flex-1 items-center justify-center p-12">
              <EmptyState
                title="No table selected"
                description="Pick a table from the floor map to monitor its orders."
              />
            </div>
          ) : (
          <>
          {/* Header: TABLE eyebrow + big number + status + mini stats row +
              action row — mirrors the design's TablePanel header. */}
          <div className="border-b border-line bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                  Table
                </div>
                <div className="mono mt-1 text-[28px] font-semibold leading-none tracking-[-0.02em] text-ink">
                  {selectedTable.tableNumber}
                </div>
              </div>
              <Badge
                tone={
                  sessionByTable.get(selectedTable.id)?.billStatus ===
                  "requested"
                    ? "clay"
                    : selectedTable.status === "occupied"
                      ? "amber"
                      : "green"
                }
              >
                {sessionByTable.get(selectedTable.id)?.billStatus ===
                "requested"
                  ? "Ready to pay"
                  : selectedTable.status === "occupied"
                    ? "Seated"
                    : "Available"}
              </Badge>
            </div>

            {/* Mini stats row */}
            <div className="mt-3 flex flex-wrap items-center gap-4 text-[12px] text-ink-muted">
              {sessionByTable.has(selectedTable.id) && (
                <span className="mono inline-flex items-center gap-1.5 tabular-nums">
                  <svg
                    viewBox="0 0 16 16"
                    width={12}
                    height={12}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <circle cx="8" cy="8" r="6" />
                    <path d="M8 5v3l2 1.5" />
                  </svg>
                  {sessionDuration(
                    sessionByTable.get(selectedTable.id)!.createdAt,
                    now,
                  )}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <svg
                  viewBox="0 0 16 16"
                  width={12}
                  height={12}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <rect x="2" y="3" width="12" height="10" rx="1.5" />
                  <path d="M5 6h6M5 9h4" />
                </svg>
                {selectedOrders.length}{" "}
                {selectedOrders.length === 1 ? "check" : "checks"}
              </span>
              {sessionByTable.get(selectedTable.id)?.billStatus ===
                "requested" && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-clay-500 px-2.5 py-[3px] text-[11px] font-semibold text-white">
                  <span className="h-1.5 w-1.5 animate-marrow-blink rounded-full bg-white" />
                  Check requested
                </span>
              )}
            </div>

            {/* Action row */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {sessionByTable.has(selectedTable.id) ? (
                <>
                  <Link
                    href={`/pos/${branchId}?session=${
                      sessionByTable.get(selectedTable.id)!.sessionId
                    }`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button size="sm" variant="secondary">
                      Cashier / POS
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="secondary"
                    onPress={() => showLink(selectedTable)}
                  >
                    Order link
                  </Button>
                </>
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
            </div>
          </div>

          {/* Body: status filter + orders, scrollable */}
          <div className="flex-1 overflow-y-auto p-5">

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

            {/* Order cards (each round = one card, like the design's
                ExistingOrderCard). Cards are filtered by the status pill and
                sorted ready → pending → preparing → served. */}
            {visibleOrders.length === 0 ? (
              <p className="mt-5 text-sm text-ink-muted">
                {selectedOrders.length === 0
                  ? "No active orders on this table."
                  : "No orders match this status."}
              </p>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                {visibleOrders.map((order) => {
                  const overdue =
                    order.status !== "served" &&
                    isOverdue(order.createdAt, now);
                  const flash = flashIds.has(order.id);
                  const sub = orderSubtotal(order);
                  return (
                    <div
                      key={order.id}
                      role="button"
                      tabIndex={0}
                      onClick={openPicker}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openPicker();
                        }
                      }}
                      className={cn(
                        "cursor-pointer rounded-card border bg-white p-3.5 shadow-card transition-all hover:-translate-y-px hover:border-ink",
                        "animate-in fade-in slide-in-from-top-1 duration-300",
                        flash
                          ? "border-clay-300 ring-1 ring-clay-100"
                          : overdue
                            ? "border-rose ring-1 ring-rose-soft"
                            : "border-line",
                      )}
                    >
                      {/* Order header: #order · status · elapsed · subtotal */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="mono text-[12px] font-semibold text-ink-muted">
                            #{order.orderNumber}
                          </span>
                          <Badge tone={STATUS_TONE[order.status] ?? "neutral"}>
                            {order.status}
                          </Badge>
                          <span className="mono text-[11px] tabular-nums text-ink-muted">
                            {startClock(order.createdAt)}
                            {(order.status === "pending" ||
                              order.status === "preparing") &&
                              ` · ${elapsed(order.createdAt, now)}`}
                          </span>
                          {overdue && (
                            <Badge tone="red" className="animate-pulse">
                              Overdue
                            </Badge>
                          )}
                        </div>
                        <span className="mono text-[16px] font-semibold tabular-nums tracking-[-0.01em] text-ink">
                          {formatPrice(sub)}
                        </span>
                      </div>

                      {/* Item lines: qty · name (note) · line price */}
                      <ul className="mt-3 flex flex-col divide-y divide-line">
                        {order.items.map((item) => (
                          <li
                            key={item.id}
                            className="grid grid-cols-[auto_1fr_auto] items-start gap-3 py-2"
                          >
                            <span className="mono mt-0.5 inline-flex h-5 min-w-[24px] items-center justify-center rounded-md bg-sand px-1 text-[11px] font-semibold text-ink-soft">
                              {item.quantity}×
                            </span>
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium leading-tight text-ink">
                                {item.name}
                              </p>
                              {(item.options.length > 0 || item.note) && (
                                <p className="mt-0.5 text-[11px] italic text-ink-muted">
                                  {[
                                    ...item.options.map((o) => o.name),
                                    ...(item.note ? [item.note] : []),
                                  ].join(" · ")}
                                </p>
                              )}
                            </div>
                            <span className="mono text-[12px] font-medium tabular-nums text-ink-soft">
                              {formatPrice(lineTotal(item))}
                            </span>
                          </li>
                        ))}
                      </ul>

                      {/* Footer actions */}
                      {(NEXT_STATUS[order.status] || canCancel(order.status)) && (
                        <div
                          className="mt-3 flex flex-wrap justify-end gap-2 border-t border-line pt-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {canCancel(order.status) && (
                            <Button
                              size="sm"
                              variant="danger"
                              onPress={() => setCancelTarget(order)}
                            >
                              Cancel
                            </Button>
                          )}
                          {NEXT_STATUS[order.status] && (
                            <Button
                              size="sm"
                              isDisabled={servingId === order.id}
                              className={cn(
                                order.status === "ready" &&
                                  "!bg-olive hover:!bg-olive/90",
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
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer: table total + clear selection — mirrors the design's
              TablePanel footer (Table total · N checks). */}
          <div className="border-t border-line bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  Table total · {selectedOrders.length}{" "}
                  {selectedOrders.length === 1 ? "check" : "checks"}
                </div>
                <div className="mono mt-1 text-[24px] font-semibold leading-none tracking-[-0.01em] text-ink">
                  {formatPrice(selectedTableTotal)}
                </div>
              </div>
              <Button
                variant="secondary"
                onPress={() => setDetailTableId(null)}
              >
                Clear selection
              </Button>
            </div>
          </div>
          </>
          )}
        </main>
      </div>

      {/* ============ Menu picker drawer ============
          Opens when an order card is clicked. Lets the waiter add a new round
          to the same table and fire it to the kitchen — like the design's
          middle (menu) column in the Staff terminal. */}
      {pickerOpen && selectedTable && (
        <>
          <div
            className="fixed inset-0 z-30 animate-in fade-in bg-ink/30 backdrop-blur-[2px]"
            onClick={closePicker}
            aria-hidden
          />
          <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md animate-in slide-in-from-right-4 flex-col border-l border-line bg-white shadow-pop">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-line p-5">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                  Add items · Table {selectedTable.tableNumber}
                </div>
                <div className="mt-1 text-[20px] font-semibold tracking-[-0.01em] text-ink">
                  Menu
                </div>
              </div>
              <button
                onClick={closePicker}
                aria-label="Close menu picker"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-sand text-ink-soft hover:bg-line"
              >
                <svg
                  viewBox="0 0 16 16"
                  width={14}
                  height={14}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                >
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>

            {/* Search + category pills */}
            <div className="border-b border-line p-3">
              <input
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="Search menu…"
                className="w-full rounded-sm border border-line-strong bg-white px-3 py-2 text-sm outline-none focus:border-clay-500 focus:ring-2 focus:ring-clay-100"
              />
              {!pickerSearch && pickerMenu && pickerMenu.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {pickerMenu.map((c) => {
                    const active = pickerCategoryId === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => setPickerCategoryId(c.id)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-[12px] font-medium transition",
                          active
                            ? "border-ink bg-ink text-white"
                            : "border-line bg-white text-ink-soft hover:bg-sand",
                        )}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick-add tiles */}
            <div className="flex-1 overflow-y-auto p-3">
              {pickerMenuLoading ? (
                <Loading />
              ) : pickerVisible.length === 0 ? (
                <EmptyState
                  title={pickerSearch ? "Nothing found" : "No items"}
                  description={
                    pickerSearch
                      ? "Try a different search or pick a category."
                      : "No available items in this category."
                  }
                />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {pickerVisible.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => addToPicker(item)}
                      className="group flex min-h-[88px] flex-col gap-1.5 rounded-card border border-line bg-white p-3 text-left transition hover:-translate-y-px hover:border-ink"
                    >
                      <div className="text-[13px] font-semibold leading-tight text-ink">
                        {item.name}
                      </div>
                      {item.description && (
                        <div className="line-clamp-2 flex-1 text-[11px] text-ink-muted">
                          {item.description}
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="mono text-[13px] font-semibold tabular-nums text-ink">
                          {formatPrice(item.price)}
                        </span>
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ink text-white group-hover:bg-clay-500">
                          <svg
                            viewBox="0 0 12 12"
                            width={10}
                            height={10}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            strokeLinecap="round"
                          >
                            <path d="M6 1v10M1 6h10" />
                          </svg>
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Draft cart + Fire button */}
            <div className="border-t border-line bg-sand p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                New round · not yet fired
              </div>
              {pickerCart.length === 0 ? (
                <p className="mt-2 text-[12px] text-ink-muted">
                  Tap items above to start a new round.
                </p>
              ) : (
                <ul className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto pr-1">
                  {pickerCart.map((l) => (
                    <li
                      key={l.menuItemId}
                      className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 text-[13px]"
                    >
                      <span className="mono tabular-nums text-ink-muted">
                        {l.qty}×
                      </span>
                      <span className="truncate font-medium text-ink">
                        {l.name}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            updatePickerQty(l.menuItemId, l.qty - 1)
                          }
                          className="flex h-6 w-6 items-center justify-center rounded-sm border border-line bg-white text-ink hover:bg-sand"
                          aria-label="Decrease"
                        >
                          −
                        </button>
                        <button
                          onClick={() =>
                            updatePickerQty(l.menuItemId, l.qty + 1)
                          }
                          className="flex h-6 w-6 items-center justify-center rounded-sm border border-line bg-white text-ink hover:bg-sand"
                          aria-label="Increase"
                        >
                          +
                        </button>
                      </div>
                      <span className="mono tabular-nums text-ink">
                        {formatPrice(l.price * l.qty)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
                <span className="text-[12px] text-ink-muted">
                  Round subtotal
                </span>
                <span className="mono text-[18px] font-semibold tabular-nums text-ink">
                  {formatPrice(pickerSubtotal)}
                </span>
              </div>
              <Button
                onPress={fireToKitchen}
                isDisabled={pickerCart.length === 0 || pickerFiring}
                className="mt-3 w-full !bg-clay-500 hover:!bg-clay-600"
              >
                {pickerFiring ? "Firing…" : "Fire to kitchen"}
              </Button>
            </div>
          </aside>
        </>
      )}

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
