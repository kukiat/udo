"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CancelOrderDialog } from "@/components/order/CancelOrderDialog";
import { TopBar } from "@/components/dashboard/TopBar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DateTimePicker } from "@/components/ui/DatePicker";
import { Modal } from "@/components/ui/Modal";
import { PillButton } from "@/components/ui/PillButton";
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
  note: string;
};

// Per-line price: (unitPrice + selected options) * qty. Mirrors server totals.
function lineTotal(item: OrderItemDTO): number {
  const base = parseFloat(item.unitPrice) * item.quantity;
  const opts = item.options.reduce((s, o) => s + parseFloat(o.price), 0);
  return base + opts * item.quantity;
}

function orderSubtotal(order: OrderDTO): number {
  return order.items.reduce((s, it) => s + lineTotal(it), 0);
}

function orderItemCount(order: OrderDTO): number {
  return order.items.reduce((s, it) => s + it.quantity, 0);
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
  tableNumber: string;
  createdAt: string;
  seatedAt: string;
  partySize: number | null;
  tableNote: string | null;
  customerName: string | null;
  customerPhone: string | null;
  expectedLeaveAt: string | null;
  billStatus: "open" | "requested" | "paid";
  orderCount: number;
  subtotal: string;
};
type OpenSessionInput = {
  partySize: number;
  seatedAt: string;
  tableNote: string | null;
  customerName: string | null;
  customerPhone: string | null;
  expectedLeaveAt: string | null;
};
type RemoveItemTarget = {
  order: OrderDTO;
  item: OrderItemDTO;
};
type EditItemNoteTarget = {
  order: OrderDTO;
  item: OrderItemDTO;
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

// Waitstaff can only cancel/edit before the kitchen has started the order.
const canCancel = (status: OrderStatus) =>
  status === "pending";

// Waitstaff only confirms handoff to the table. Prep state changes stay in KDS.
const NEXT_STATUS: Partial<Record<OrderStatus, { next: OrderStatus; label: string }>> = {
  ready: { next: "served", label: "Serve" },
};

const WAITSTAFF_ACTION_BUTTON = "!h-[34px] min-h-[34px] px-5";

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

const toDateTimeLocalValue = (date: Date) => {
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const formatClock = (iso: string) =>
  new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

const expectedLeaveLabel = (expectedLeaveAt: string | null, now: number) => {
  if (!expectedLeaveAt) return "No limit";
  const target = new Date(expectedLeaveAt).getTime();
  const deltaMins = Math.ceil((target - now) / 60000);
  if (deltaMins < 0) return `${Math.abs(deltaMins)}m over`;
  if (deltaMins === 0) return "Due now";
  const hours = Math.floor(deltaMins / 60);
  const mins = deltaMins % 60;
  return hours > 0 ? `${hours}h ${String(mins).padStart(2, "0")}m left` : `${mins}m left`;
};

// Orders still on the floor past this age are flagged as overdue.
const OVERDUE_MS = 10 * 60 * 1000;
const isOverdue = (createdAt: string, now: number) =>
  now - new Date(createdAt).getTime() >= OVERDUE_MS;

// Compact KPI tile for the waiter cockpit.
function StatCard({
  label,
  value,
  sub,
  tone = "neutral",
  highlight = false,
}: {
  label: string;
  value: number | string;
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
        "rounded-card border px-4 py-3 shadow-card",
        highlight
          ? "border-transparent bg-ink text-white"
          : "border-line bg-white",
      )}
    >
      <p
        className={cn(
          "text-[10px] font-semibold uppercase tracking-[0.08em]",
          highlight ? "text-white/70" : "text-ink-muted",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mono mt-1.5 text-[24px] font-semibold tabular-nums leading-none tracking-[-0.015em]",
          highlight ? "text-white" : valueTone,
        )}
      >
        {value}
      </p>
      {sub && (
        <p
          className={cn(
            "mt-1 text-[11px]",
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

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[64px]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
        {label}
      </div>
      <div className="mono mt-1 truncate text-[14px] font-semibold tabular-nums text-ink">
        {value}
      </div>
    </div>
  );
}

const THEME_KEY = "rms.waitstaff.theme";

export default function WaitstaffPage() {
  const { branchId } = useParams<{ branchId: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_KEY);
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
        localStorage.setItem(THEME_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const [branch, setBranch] = useState<BranchInfo | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [orders, setOrders] = useState<OrderDTO[]>([]);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [servingId, setServingId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<OrderDTO | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [removeItemTarget, setRemoveItemTarget] =
    useState<RemoveItemTarget | null>(null);
  const [removeItemError, setRemoveItemError] = useState<string | null>(null);
  const [editItemNoteTarget, setEditItemNoteTarget] =
    useState<EditItemNoteTarget | null>(null);

  // Active session per table id — used to gate / build the order link and to
  // show the session start time + how long it's been open.
  const [sessionByTable, setSessionByTable] = useState<Map<string, SessionInfo>>(
    new Map(),
  );
  const [openingTableId, setOpeningTableId] = useState<string | null>(null);
  const [openingTable, setOpeningTable] = useState<TableRow | null>(null);
  const [linkModal, setLinkModal] = useState<{
    tableNumber: string;
    url: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [connected, setConnected] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const joinAt = useRef<number>(0);
  const socketOriginHeaders = (): Record<string, string> | undefined => {
    const socket = getSocket();
    return socket.id ? { "x-rms-socket-id": socket.id } : undefined;
  };

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
        tableNumber: string;
        createdAt: string;
        seatedAt: string;
        partySize: number | null;
        tableNote: string | null;
        customerName: string | null;
        customerPhone: string | null;
        expectedLeaveAt: string | null;
        billStatus: "open" | "requested" | "paid";
        orderCount: number;
        subtotal: string;
      }[];
    }>(`/api/pos/sessions?branchId=${branchId}`);
    setSessionByTable(
      new Map(
        d.sessions.map((s) => [
          s.tableId,
          {
            sessionId: s.sessionId,
            tableNumber: s.tableNumber,
            createdAt: s.createdAt,
            seatedAt: s.seatedAt,
            partySize: s.partySize,
            tableNote: s.tableNote,
            customerName: s.customerName,
            customerPhone: s.customerPhone,
            expectedLeaveAt: s.expectedLeaveAt,
            billStatus: s.billStatus,
            orderCount: s.orderCount,
            subtotal: s.subtotal,
          },
        ]),
      ),
    );
  }, [branchId]);

  const orderLink = (tableNumber: string, sessionId: string) =>
    `${window.location.origin}/order/${branchId}/${encodeURIComponent(
      tableNumber,
    )}?s=${sessionId}`;

  const openSession = async (table: TableRow, input: OpenSessionInput) => {
    setOpeningTableId(table.id);
    setError(null);
    try {
      const { session } = await api<{ session: { id: string } }>(
        "/api/sessions",
        {
          method: "POST",
          body: JSON.stringify({ branchId, tableId: table.id, ...input }),
        },
      );
      await Promise.all([loadSessions(), loadTables()]);
      setOpeningTable(null);
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

    const refreshAll = () => {
      loadOrders().catch(() => { });
      loadTables().catch(() => { });
      loadSessions().catch(() => { });
    };

    const refreshSessions = () => loadSessions().catch(() => { });

    socket.on("order:new", refreshAll);
    socket.on("order:status-update", refreshAll);
    socket.on("bill:paid", refreshAll);
    socket.on("bill:requested", refreshSessions);

    const join = () => {
      setConnected(true);
      joinAt.current = performance.now();
      socket.emit("branch:join", { branchId });
      // Use a short round-trip ping for a friendly latency readout.
      const t0 = performance.now();
      socket.emit("ping", () => {
        setLatency(Math.max(1, Math.round(performance.now() - t0)));
      });
    };
    const onDisconnect = () => setConnected(false);
    if (socket.connected) join();
    socket.on("connect", join);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("order:new", refreshAll);
      socket.off("order:status-update", refreshAll);
      socket.off("bill:paid", refreshAll);
      socket.off("bill:requested", refreshSessions);
      socket.off("connect", join);
      socket.off("disconnect", onDisconnect);
    };
  }, [branchId, loadOrders, loadTables, loadSessions]);

  const advanceStatus = async (order: OrderDTO, next: OrderStatus) => {
    setServingId(order.id);
    setError(null);
    try {
      await api(`/api/orders/${order.id}/status`, {
        method: "PATCH",
        headers: socketOriginHeaders(),
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
        headers: socketOriginHeaders(),
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

  const updateOrderItem = async (
    order: OrderDTO,
    item: OrderItemDTO,
    patch: { quantity?: number; note?: string | null },
  ) => {
    if (order.status !== "pending") return;
    setEditingItemId(item.id);
    setError(null);
    try {
      await api(`/api/orders/${order.id}/items/${item.id}`, {
        method: "PATCH",
        headers: socketOriginHeaders(),
        body: JSON.stringify(patch),
      });
      await Promise.all([loadOrders(), loadSessions()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update item");
    } finally {
      setEditingItemId(null);
    }
  };

  const editOrderItemNote = (order: OrderDTO, item: OrderItemDTO) => {
    if (order.status !== "pending") return;
    setEditItemNoteTarget({ order, item });
  };

  const confirmEditOrderItemNote = async (note: string) => {
    if (!editItemNoteTarget) return;
    const { order, item } = editItemNoteTarget;
    await updateOrderItem(order, item, { note: note.trim() || null });
    setEditItemNoteTarget(null);
  };

  const requestRemoveOrderItem = (order: OrderDTO, item: OrderItemDTO) => {
    if (order.status !== "pending") return;
    setRemoveItemError(null);
    setRemoveItemTarget({ order, item });
  };

  const confirmRemoveOrderItem = async (reason: string) => {
    if (!removeItemTarget) return;
    const { order, item } = removeItemTarget;
    const trimmed = reason.trim();
    if (!trimmed) {
      setRemoveItemError("A reason is required before removing an item.");
      return;
    }

    setEditingItemId(item.id);
    setError(null);
    setRemoveItemError(null);
    try {
      if (order.items.length <= 1) {
        await api(`/api/orders/${order.id}/cancel`, {
          method: "POST",
          headers: socketOriginHeaders(),
          body: JSON.stringify({ reason: trimmed }),
        });
      } else {
        await api(`/api/orders/${order.id}/items/${item.id}`, {
          method: "DELETE",
          headers: socketOriginHeaders(),
          body: JSON.stringify({ reason: trimmed }),
        });
      }
      setRemoveItemTarget(null);
      await Promise.all([loadOrders(), loadSessions()]);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to remove item";
      setRemoveItemError(message);
      setError(message);
    } finally {
      setEditingItemId(null);
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

  const tableById = useMemo(
    () => new Map(tables.map((t) => [t.id, t])),
    [tables],
  );

  // Tables whose customers have asked for the check.
  const checkRequestedCount = useMemo(
    () =>
      Array.from(sessionByTable.values()).filter(
        (s) => s.billStatus === "requested",
      ).length,
    [sessionByTable],
  );

  const activeSessionCount = sessionByTable.size;
  const activeOrderCount = orders.filter((o) => o.status !== "served").length;
  const readyItemCount = readyOrders.reduce(
    (sum, order) => sum + orderItemCount(order),
    0,
  );

  const readyQueue = useMemo(
    () =>
      [...readyOrders]
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() -
            new Date(b.createdAt).getTime(),
        )
        .map((order) => ({
          order,
          tableNumber:
            tableById.get(order.tableId)?.tableNumber ?? order.tableNumber,
          itemCount: orderItemCount(order),
          subtotal: orderSubtotal(order),
        })),
    [readyOrders, tableById],
  );

  const billRequests = useMemo(
    () =>
      Array.from(sessionByTable.entries())
        .filter(([, session]) => session.billStatus === "requested")
        .map(([tableId, session]) => ({
          tableId,
          tableNumber: tableById.get(tableId)?.tableNumber ?? session.tableNumber,
          session,
        }))
        .sort((a, b) => {
          const av = Number(a.tableNumber);
          const bv = Number(b.tableNumber);
          if (Number.isFinite(av) && Number.isFinite(bv)) return av - bv;
          return a.tableNumber.localeCompare(b.tableNumber);
        }),
    [sessionByTable, tableById],
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
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

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
          note: "",
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

  const updatePickerNote = (menuItemId: string, note: string) => {
    setPickerCart((prev) =>
      prev.map((l) => (l.menuItemId === menuItemId ? { ...l, note } : l)),
    );
  };

  const fireToKitchen = async () => {
    if (!selectedTable || pickerCart.length === 0) return;
    setPickerFiring(true);
    setError(null);
    try {
      await api("/api/orders", {
        method: "POST",
        headers: socketOriginHeaders(),
        body: JSON.stringify({
          branchId,
          tableId: selectedTable.id,
          items: pickerCart.map((l) => ({
            menuItemId: l.menuItemId,
            quantity: l.qty,
            note: l.note.trim() || null,
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
  const openDetail = (tableId: string) => {
    setStatusFilter("all");
    setDetailTableId(tableId);
  };

  const selectedTable = detailTableId ? tableById.get(detailTableId) ?? null : null;
  const selectedOrders = detailTableId
    ? ordersByTable.get(detailTableId) ?? []
    : [];

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
  const selectedSession = selectedTable
    ? sessionByTable.get(selectedTable.id) ?? null
    : null;
  const selectedBillRequested = selectedSession?.billStatus === "requested";
  const selectedTableLabel = selectedBillRequested
    ? "Ready to pay"
    : selectedTable?.status === "occupied"
      ? "Seated"
      : "Available";
  const selectedTableTone = selectedBillRequested
    ? "clay"
    : selectedTable?.status === "occupied"
      ? "amber"
      : "green";

  const statusCount = (s: OrderStatus) =>
    selectedOrders.reduce(
      (n, o) => n + (o.status === s ? o.items.length : 0),
      0,
    );

  if (loading) return <Loading />;

  return (
    <div
      suppressHydrationWarning
      className={cn(
        "kds-theme min-h-screen bg-cream",
        theme === "dark" && "kds-dark",
      )}
    >
      <TopBar
        role="Staff Terminal"
        showLive={false}
        left={
          <WaitBranchSwitcher
            branches={branches}
            branchId={branchId}
            restaurantName={branch?.restaurant?.name ?? null}
            activeBranchName={branch?.name ?? null}
            onChange={(id) => router.push(`/waitstaff/${id}`)}
          />
        }
        right={
          <>
            <WaitLivePill connected={connected} latency={latency} />
            <Link href={`/pos/${branchId}`}>
              <PillButton className={WAITSTAFF_ACTION_BUTTON}>
                Cashier / POS
              </PillButton>
            </Link>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </>
        }
      />

      {error && (
        <div className="px-5 pt-4 sm:px-7">
          <ErrorState message={error} />
        </div>
      )}

      {/* ---------- Workstation: floor map + table detail + service alerts ---------- */}
      <div className="grid min-h-[calc(100vh-3.5rem)] grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_320px] 2xl:grid-cols-[340px_minmax(0,1fr)_360px]">
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

          {/* Table tile grid */}
          <div className="flex-1 overflow-y-auto p-3">
            {tables.length === 0 ? (
              <EmptyState
                title="No tables yet"
                description="Add tables when creating the branch in the dashboard."
              />
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {tables.map((t) => {
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
                  const selected = t.id === detailTableId;
                  return (
                    <button
                      key={t.id}
                      onClick={() => openDetail(t.id)}
                      aria-pressed={selected}
                      className={cn(
                        "group relative flex aspect-square min-h-0 flex-col justify-between rounded-card border bg-white p-2.5 text-left shadow-card transition-all duration-200",
                        visual.bg,
                        "hover:-translate-y-px hover:border-ink",
                        selected &&
                        (theme === "dark"
                          ? "!border-[#F5F2EA]"
                          : "!border-clay-500"),
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
                      <div className="flex h-4 min-w-0 flex-nowrap items-center gap-0.5 overflow-hidden">
                        {checkRequested && (
                          <span className="inline-flex h-4 min-w-0 shrink items-center justify-center gap-0.5 whitespace-nowrap rounded-full bg-clay-500 px-1.5 text-[8px] font-semibold leading-none text-white">
                            Check
                          </span>
                        )}
                        {overdue > 0 && !checkRequested && (
                          <span className="inline-flex h-4 min-w-0 shrink items-center justify-center gap-0.5 whitespace-nowrap rounded-full bg-rose px-1.5 text-[8px] font-semibold leading-none text-white">
                            {overdue} late
                          </span>
                        )}
                        {ready > 0 && (
                          <span className="inline-flex h-4 min-w-0 shrink items-center justify-center gap-0.5 whitespace-nowrap rounded-full bg-olive px-1.5 text-[8px] font-semibold leading-none text-white">
                            <span className="h-1 w-1 rounded-full bg-white" />
                            {ready} ready
                          </span>
                        )}
                      </div>

                      {/* Bottom row: orders count · session timer */}
                      <div className="flex items-center justify-between gap-0.5 text-[9px] leading-none text-ink-muted">
                        <span className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap">
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
                          <span className="mono inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap tabular-nums">
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
                            {sessionDuration(session.seatedAt, now)}
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
        <main className="flex min-w-0 flex-col bg-sand lg:h-[calc(100vh-3.5rem)] lg:min-h-0 lg:overflow-hidden">
          <section className="shrink-0 border-b border-line bg-sand p-3 sm:p-4">
            <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-3 2xl:grid-cols-5">
              <StatCard
                label="Tables"
                value={`${occupiedCount}/${tables.length}`}
                sub={`${activeSessionCount} active sessions`}
                tone="clay"
                highlight
              />
              <StatCard
                label="Orders"
                value={orders.length}
                sub={`${activeOrderCount} active`}
              />
              <StatCard
                label="Ready"
                value={readyOrders.length}
                sub={`${readyItemCount} items to serve`}
                tone="green"
              />
              <StatCard
                label="Bill alerts"
                value={checkRequestedCount}
                sub="requested checks"
                tone="amber"
              />
              <StatCard
                label="Realtime"
                value={connected ? "Live" : "Off"}
                sub={latency != null ? `${latency}ms latency` : "branch room"}
                tone={connected ? "green" : "neutral"}
              />
            </div>

          </section>

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
              <div className="shrink-0 border-b border-line bg-white px-5 py-3 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-x-7 gap-y-3">
                  <section className="order-2 flex min-w-[260px] flex-1 flex-wrap items-start gap-x-7 gap-y-2">
                    <div className="flex min-w-[150px] items-start gap-3">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                          Table details
                        </div>
                        <div className="mt-1 flex items-end gap-2">
                          <span className="mono text-[30px] font-semibold leading-none tracking-[-0.01em] text-ink">
                            {selectedTable.tableNumber}
                          </span>
                          <span className="pb-0.5 text-xs font-medium text-ink-muted">
                            Table
                          </span>
                        </div>
                      </div>
                      <Badge tone={selectedTableTone}>{selectedTableLabel}</Badge>
                    </div>

                    <div className="flex min-w-0 flex-1 flex-wrap items-start gap-x-6 gap-y-2 text-[11px] text-ink-muted">
                      <div className="min-w-[64px]">
                        <div className="flex items-center gap-1.5">
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
                          <span>Session</span>
                        </div>
                        <div className="mono mt-1 text-[13px] font-semibold tabular-nums text-ink">
                          {selectedSession
                            ? sessionDuration(selectedSession.seatedAt, now)
                            : "-"}
                        </div>
                      </div>
                      <div className="min-w-[64px]">
                        <div className="flex items-center gap-1.5">
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
                          <span>Orders</span>
                        </div>
                        <div className="mono mt-1 text-[13px] font-semibold tabular-nums text-ink">
                          {selectedOrders.length}
                        </div>
                      </div>
                      {selectedBillRequested && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-clay-500 px-2.5 py-[3px] text-[11px] font-semibold text-white">
                          <span className="h-1.5 w-1.5 animate-marrow-blink rounded-full bg-white" />
                          Check requested
                        </span>
                      )}
                      {selectedSession && (
                        <>
                          <InfoChip
                            label="Guests"
                            value={
                              selectedSession.partySize
                                ? `${selectedSession.partySize}`
                                : "-"
                            }
                          />
                          <InfoChip
                            label="Seated"
                            value={formatClock(selectedSession.seatedAt)}
                          />
                          <InfoChip
                            label="Turnover"
                            value={expectedLeaveLabel(
                              selectedSession.expectedLeaveAt,
                              now,
                            )}
                          />
                          <InfoChip
                            label="Leave by"
                            value={
                              selectedSession.expectedLeaveAt
                                ? formatClock(selectedSession.expectedLeaveAt)
                                : "-"
                            }
                          />
                          {(selectedSession.customerName ||
                            selectedSession.customerPhone ||
                            selectedSession.tableNote) && (
                              <div className="min-w-[180px] flex-1">
                                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                                  Guest notes
                                </div>
                                <div className="mt-1 space-y-1 text-[12px] leading-snug text-ink">
                                  {(selectedSession.customerName ||
                                    selectedSession.customerPhone) && (
                                      <p>
                                        {[selectedSession.customerName, selectedSession.customerPhone]
                                          .filter(Boolean)
                                          .join(" · ")}
                                      </p>
                                    )}
                                  {selectedSession.tableNote && (
                                    <p className="text-ink-muted">
                                      {selectedSession.tableNote}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                        </>
                      )}
                    </div>
                  </section>

                  <section className="order-1 min-w-0 basis-full border-b border-line/70 pb-3">
                    <div className="sr-only">
                      Service actions
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedSession ? (
                        <>
                          <PillButton
                            tone="accent"
                            variant="outline"
                            isDisabled={selectedBillRequested}
                            onPress={openPicker}
                            className={cn(WAITSTAFF_ACTION_BUTTON, "flex-1 sm:flex-none")}
                          >
                            <svg
                              viewBox="0 0 16 16"
                              width={14}
                              height={14}
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={1.8}
                            >
                              <path d="M8 3v10M3 8h10" />
                            </svg>
                            New order
                          </PillButton>
                          <Link
                            href={`/pos/${branchId}?session=${selectedSession.sessionId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 sm:flex-none"
                          >
                            <PillButton
                              className={cn(
                                WAITSTAFF_ACTION_BUTTON,
                                "!w-full sm:!w-auto",
                              )}
                            >
                              Cashier / POS
                            </PillButton>
                          </Link>
                          <PillButton
                            onPress={() => showLink(selectedTable)}
                            className={cn(WAITSTAFF_ACTION_BUTTON, "flex-1 sm:flex-none")}
                          >
                            Order link
                          </PillButton>
                        </>
                      ) : (
                        <PillButton
                          tone="accent"
                          isDisabled={openingTableId === selectedTable.id}
                          onPress={() => setOpeningTable(selectedTable)}
                          className={cn(WAITSTAFF_ACTION_BUTTON, "flex-1 sm:flex-none")}
                        >
                          {openingTableId === selectedTable.id
                            ? "Opening…"
                            : "Open session"}
                        </PillButton>
                      )}
                    </div>
                    {selectedBillRequested && (
                      <p className="text-[11px] text-ink-muted">
                        New orders are paused while the check is requested.
                      </p>
                    )}
                  </section>

                  <section className="order-3 min-w-[150px] sm:ml-auto">
                    <div className="flex h-full flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                          Table total
                        </div>
                        <div className="mono mt-1 text-[28px] font-semibold leading-none tracking-[-0.01em] text-ink">
                          {formatPrice(selectedTableTotal)}
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              </div>

              {/* Body: status filter + orders, scrollable */}
              <div className="min-h-0 flex-1 overflow-y-auto p-4">

                {/* Status filter */}
                <div className="flex flex-wrap gap-1.5">
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
                            ? "bg-[var(--accent)] text-white hover:brightness-95"
                            : theme === "dark"
                              ? "border border-[var(--line-strong)] bg-[var(--bg-elev)] text-ink-soft hover:bg-[var(--line)]"
                              : "border border-line bg-white text-ink-soft hover:bg-[var(--bg-sunken)]",
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
                          className={cn(
                            "rounded-card border bg-white p-3.5 shadow-card transition-all",
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
                            {order.items.map((item) => {
                              const editable = order.status === "pending";
                              const busy = editingItemId === item.id;
                              return (
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
                                    {editable && (
                                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                        <button
                                          type="button"
                                          disabled={busy}
                                          onClick={() =>
                                            item.quantity <= 1
                                              ? requestRemoveOrderItem(order, item)
                                              : updateOrderItem(order, item, {
                                                quantity: item.quantity - 1,
                                              })
                                          }
                                          className="flex h-6 w-6 items-center justify-center rounded-sm border border-line bg-white text-ink hover:bg-sand disabled:opacity-50"
                                          aria-label="Decrease item quantity"
                                        >
                                          -
                                        </button>
                                        <button
                                          type="button"
                                          disabled={busy}
                                          onClick={() =>
                                            updateOrderItem(order, item, {
                                              quantity: item.quantity + 1,
                                            })
                                          }
                                          className="flex h-6 w-6 items-center justify-center rounded-sm border border-line bg-white text-ink hover:bg-sand disabled:opacity-50"
                                          aria-label="Increase item quantity"
                                        >
                                          +
                                        </button>
                                        <button
                                          type="button"
                                          disabled={busy}
                                          onClick={() =>
                                            editOrderItemNote(order, item)
                                          }
                                          className="rounded border border-line bg-white px-2.5 py-1 text-[11px] font-semibold text-ink-soft hover:bg-sand disabled:opacity-50"
                                        >
                                          {item.note ? "Edit note" : "Add note"}
                                        </button>
                                        <button
                                          type="button"
                                          disabled={busy}
                                          onClick={() =>
                                            requestRemoveOrderItem(order, item)
                                          }
                                          className="rounded-full border border-red-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  <span className="mono text-[12px] font-medium tabular-nums text-ink-soft">
                                    {formatPrice(lineTotal(item))}
                                  </span>
                                </li>
                              );
                            })}
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
                                  className={cn(
                                    WAITSTAFF_ACTION_BUTTON,
                                    "!rounded-full",
                                  )}
                                >
                                  Cancel
                                </Button>
                              )}
                              {NEXT_STATUS[order.status] && (
                                <Button
                                  size="sm"
                                  isDisabled={servingId === order.id}
                                  className={cn(
                                    WAITSTAFF_ACTION_BUTTON,
                                    "!rounded-full",
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

            </>
          )}
        </main>

        <aside className="border-t border-line bg-sand p-3 sm:p-4 lg:col-start-2 xl:sticky xl:top-14 xl:col-start-3 xl:h-[calc(100vh-3.5rem)] xl:overflow-y-auto xl:border-l xl:border-t-0">
          <div className="flex flex-col gap-2.5">
            <ReadyServeQueue
              queue={readyQueue}
              now={now}
              servingId={servingId}
              onSelectTable={openDetail}
              onServe={(order) => advanceStatus(order, "served")}
            />
            <BillRequestQueue
              branchId={branchId}
              requests={billRequests}
              now={now}
              onSelectTable={openDetail}
            />
          </div>
        </aside>
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
                      className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 rounded-sm bg-white/60 p-1.5 text-[13px]"
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
                      <input
                        value={l.note}
                        onChange={(e) =>
                          updatePickerNote(l.menuItemId, e.target.value)
                        }
                        placeholder="Kitchen note"
                        className="col-span-4 rounded-sm border border-line bg-white px-2 py-1 text-[12px] outline-none focus:border-clay-500 focus:ring-2 focus:ring-clay-100"
                      />
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
                className={cn(
                  WAITSTAFF_ACTION_BUTTON,
                  "mt-3 w-full !bg-clay-500 hover:!bg-clay-600",
                )}
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

      <EditOrderItemNoteDialog
        target={editItemNoteTarget}
        saving={
          editItemNoteTarget
            ? editingItemId === editItemNoteTarget.item.id
            : false
        }
        onConfirm={confirmEditOrderItemNote}
        onDismiss={() => setEditItemNoteTarget(null)}
      />

      <RemoveOrderItemDialog
        target={removeItemTarget}
        removing={
          removeItemTarget
            ? editingItemId === removeItemTarget.item.id
            : false
        }
        error={removeItemError}
        onConfirm={confirmRemoveOrderItem}
        onDismiss={() => {
          setRemoveItemTarget(null);
          setRemoveItemError(null);
        }}
      />

      <OpenSessionDialog
        table={openingTable}
        opening={openingTableId === openingTable?.id}
        onDismiss={() => {
          if (!openingTableId) setOpeningTable(null);
        }}
        onConfirm={(input) => {
          if (openingTable) openSession(openingTable, input);
        }}
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
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-sand p-2">
              <a
                href={linkModal.url}
                target="_blank"
                rel="noopener noreferrer"
                title={linkModal.url}
                className="min-w-0 flex-1 truncate whitespace-nowrap px-1 text-sm text-clay-600 underline underline-offset-2"
              >
                {linkModal.url}
              </a>
              <span title={copied ? "Copied!" : "Copy link"}>
                <Button
                  variant="secondary"
                  size="sm"
                  onPress={copyLink}
                  aria-label={copied ? "Link copied" : "Copy link"}
                  className="h-9 w-9 shrink-0 rounded-lg !px-0"
                >
                  {copied ? (
                    <svg
                      aria-hidden="true"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  ) : (
                    <svg
                      aria-hidden="true"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                    </svg>
                  )}
                </Button>
              </span>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <PillButton
                onPress={() => setLinkModal(null)}
              >
                Close
              </PillButton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function EditOrderItemNoteDialog({
  target,
  saving,
  onConfirm,
  onDismiss,
}: {
  target: EditItemNoteTarget | null;
  saving: boolean;
  onConfirm: (note: string) => void;
  onDismiss: () => void;
}) {
  const [note, setNote] = useState("");

  useEffect(() => {
    setNote(target?.item.note ?? "");
  }, [target?.item.id, target?.item.note]);

  return (
    <Modal
      isOpen={Boolean(target)}
      onOpenChange={(open) => {
        if (!open && !saving) onDismiss();
      }}
      header={
        <div>
          <h2 className="text-lg font-semibold text-ink">
            {target?.item.note ? "Edit kitchen note" : "Add kitchen note"}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {target
              ? `${target.item.name} · Order ${target.order.orderNumber}`
              : ""}
          </p>
        </div>
      }
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <PillButton isDisabled={saving} onPress={onDismiss}>
            Cancel
          </PillButton>
          <PillButton
            tone="success"
            variant="outline"
            isDisabled={saving}
            onPress={() => onConfirm(note)}
          >
            {saving ? "Saving..." : "Save note"}
          </PillButton>
        </div>
      }
    >
      <div className="p-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink">Note</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            maxLength={500}
            autoFocus
            disabled={saving}
            placeholder="e.g. no onions, sauce on the side"
            className="w-full resize-none rounded-lg border border-line bg-white px-3 py-2 text-[13px] text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-ink disabled:opacity-60"
          />
        </label>
      </div>
    </Modal>
  );
}

function RemoveOrderItemDialog({
  target,
  removing,
  error,
  onConfirm,
  onDismiss,
}: {
  target: RemoveItemTarget | null;
  removing: boolean;
  error: string | null;
  onConfirm: (reason: string) => void;
  onDismiss: () => void;
}) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    setReason("");
  }, [target?.item.id]);

  const cancelsOrder = target ? target.order.items.length <= 1 : false;

  return (
    <Modal
      isOpen={Boolean(target)}
      onOpenChange={(open) => {
        if (!open && !removing) onDismiss();
      }}
    >
      <div className="flex flex-col gap-4 p-5">
        <div className="pr-8">
          <h2 className="text-lg font-semibold text-ink">
            {cancelsOrder ? "Cancel order?" : "Remove menu item?"}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {target
              ? cancelsOrder
                ? `Removing ${target.item.name} will cancel order ${target.order.orderNumber}. This can't be undone.`
                : `${target.item.name} will be removed from order ${target.order.orderNumber}.`
              : ""}
          </p>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink">
            Reason <span className="font-normal text-ink-muted">required</span>
          </span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              cancelsOrder
                ? "e.g. customer cancelled the item"
                : "e.g. item unavailable, ordered by mistake"
            }
            rows={3}
            disabled={removing}
            className="w-full resize-none rounded-lg border border-line bg-white px-2.5 py-2 text-[13px] text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-ink disabled:opacity-60"
          />
        </label>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <PillButton tone="neutral" onPress={onDismiss}>
            Keep item
          </PillButton>
          <PillButton tone="danger" variant="outline" onPress={() => onConfirm(reason)}>
            {removing
              ? cancelsOrder
                ? "Cancelling..."
                : "Removing..."
              : cancelsOrder
                ? "Cancel order"
                : "Remove item"}
          </PillButton>
        </div>
      </div>
    </Modal>
  );
}

function OpenSessionDialog({
  table,
  opening,
  onConfirm,
  onDismiss,
}: {
  table: TableRow | null;
  opening: boolean;
  onConfirm: (input: OpenSessionInput) => void;
  onDismiss: () => void;
}) {
  const [partySize, setPartySize] = useState("2");
  const [seatedAt, setSeatedAt] = useState("");
  const [turnoverPreset, setTurnoverPreset] = useState<
    "none" | "90" | "120" | "custom"
  >("90");
  const [customMinutes, setCustomMinutes] = useState("90");
  const [tableNote, setTableNote] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!table) return;
    setPartySize("2");
    setSeatedAt(toDateTimeLocalValue(new Date()));
    setTurnoverPreset("90");
    setCustomMinutes("90");
    setTableNote("");
    setCustomerName("");
    setCustomerPhone("");
    setError(null);
  }, [table?.id]);

  const submit = () => {
    const parsedParty = Number(partySize);
    if (!Number.isInteger(parsedParty) || parsedParty < 1) {
      setError("Enter at least 1 guest.");
      return;
    }

    const seated = new Date(seatedAt);
    if (!seatedAt || Number.isNaN(seated.getTime())) {
      setError("Choose a valid seated time.");
      return;
    }

    let expectedLeaveAt: string | null = null;
    if (turnoverPreset !== "none") {
      const minutes =
        turnoverPreset === "custom"
          ? Number(customMinutes)
          : Number(turnoverPreset);
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
        setError("Turnover time must be between 1 and 1440 minutes.");
        return;
      }
      expectedLeaveAt = new Date(
        seated.getTime() + minutes * 60 * 1000,
      ).toISOString();
    }

    setError(null);
    onConfirm({
      partySize: parsedParty,
      seatedAt: seated.toISOString(),
      tableNote: tableNote.trim() || null,
      customerName: customerName.trim() || null,
      customerPhone: customerPhone.trim() || null,
      expectedLeaveAt,
    });
  };

  return (
    <Modal
      isOpen={Boolean(table)}
      onOpenChange={(open) => {
        if (!open && !opening) onDismiss();
      }}
      className="sm:max-w-2xl"
      header={
        <div>
          <h2 className="text-lg font-semibold text-ink">
            Open table {table?.tableNumber}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Capture the dining round before sharing the customer order link.
          </p>
        </div>
      }
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <PillButton
            isDisabled={opening}
            onPress={onDismiss}
          >
            Cancel
          </PillButton>
          <PillButton
            tone="accent"
            isDisabled={opening}
            onPress={submit}
          >
            {opening ? "Opening..." : "Open table"}
          </PillButton>
        </div>
      }
    >
      <div className="grid gap-4 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink">
              Guests
            </span>
            <input
              type="number"
              min={1}
              max={999}
              value={partySize}
              onChange={(e) => setPartySize(e.target.value)}
              disabled={opening}
              className="h-10 rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition-colors focus:border-ink disabled:opacity-60"
            />
          </label>

          <DateTimePicker
            label="Seated time"
            value={seatedAt}
            onChange={setSeatedAt}
            isDisabled={opening}
          />
        </div>

        <div className="grid gap-2">
          <span className="text-[13px] font-semibold text-ink">
            Expected turnover
          </span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["90", "90 min"],
              ["120", "120 min"],
              ["none", "No limit"],
              ["custom", "Custom"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                disabled={opening}
                onClick={() =>
                  setTurnoverPreset(
                    value as "none" | "90" | "120" | "custom",
                  )
                }
                className={cn(
                  "h-10 rounded-lg border px-3 text-sm font-semibold transition-colors disabled:opacity-60",
                  turnoverPreset === value
                    ? "border-ink bg-ink text-white"
                    : "border-line bg-white text-ink-soft hover:bg-sand",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {turnoverPreset === "custom" && (
            <label className="flex max-w-[220px] flex-col gap-1.5">
              <span className="text-[12px] font-medium text-ink-muted">
                Minutes
              </span>
              <input
                type="number"
                min={1}
                max={1440}
                value={customMinutes}
                onChange={(e) => setCustomMinutes(e.target.value)}
                disabled={opening}
                className="h-10 rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition-colors focus:border-ink disabled:opacity-60"
              />
            </label>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink">
              Customer name
            </span>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              maxLength={160}
              disabled={opening}
              placeholder="Optional"
              className="h-10 rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-ink disabled:opacity-60"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink">
              Phone
            </span>
            <input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              maxLength={80}
              disabled={opening}
              placeholder="Optional"
              className="h-10 rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-ink disabled:opacity-60"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink">
            Table note
          </span>
          <textarea
            value={tableNote}
            onChange={(e) => setTableNote(e.target.value)}
            maxLength={1000}
            rows={3}
            disabled={opening}
            placeholder="Allergies, children, tax invoice request"
            className="w-full resize-none rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-ink disabled:opacity-60"
          />
        </label>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

function ReadyServeQueue({
  queue,
  now,
  servingId,
  onSelectTable,
  onServe,
}: {
  queue: {
    order: OrderDTO;
    tableNumber: string;
    itemCount: number;
    subtotal: number;
  }[];
  now: number;
  servingId: string | null;
  onSelectTable: (tableId: string) => void;
  onServe: (order: OrderDTO) => void;
}) {
  const visible = queue.slice(0, 4);
  return (
    <div className="rounded-card border border-line bg-white p-3 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Ready to serve
          </div>
          <div className="mt-0.5 text-[13px] font-semibold tracking-[-0.01em] text-ink">
            Food runner queue
          </div>
        </div>
        <Badge tone={queue.length > 0 ? "green" : "neutral"}>
          {queue.length} ready
        </Badge>
      </div>

      {visible.length === 0 ? (
        <p className="mt-2.5 rounded-sm border border-dashed border-line bg-sand px-3 py-2 text-[12px] text-ink-muted">
          No plates are waiting at the pass.
        </p>
      ) : (
        <div className="mt-2.5 flex flex-col divide-y divide-line">
          {visible.map(({ order, tableNumber, itemCount, subtotal }) => (
            <div
              key={order.id}
              className="grid grid-cols-[1fr_auto] gap-3 py-2 first:pt-0 last:pb-0"
            >
              <button
                type="button"
                onClick={() => onSelectTable(order.tableId)}
                className="min-w-0 text-left"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mono text-[14px] font-semibold text-ink">
                    T{tableNumber}
                  </span>
                  <span className="mono text-[12px] font-semibold text-ink-muted">
                    {order.orderNumber}
                  </span>
                  <span className="mono rounded-full bg-olive-soft px-2 py-[2px] text-[11px] font-semibold tabular-nums text-olive">
                    {elapsed(order.createdAt, now)}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-ink-muted">
                  <span>
                    {itemCount} {itemCount === 1 ? "item" : "items"}
                  </span>
                  <span className="mono tabular-nums">
                    {formatPrice(subtotal)}
                  </span>
                </div>
              </button>
              <Button
                size="sm"
                isDisabled={servingId === order.id}
                className={cn(
                  WAITSTAFF_ACTION_BUTTON,
                  "self-center !rounded-full !bg-olive hover:!bg-olive/90",
                )}
                onPress={() => onServe(order)}
              >
                {servingId === order.id ? "Serving..." : "Serve"}
              </Button>
            </div>
          ))}
          {queue.length > visible.length && (
            <div className="pt-3 text-[12px] font-medium text-ink-muted">
              +{queue.length - visible.length} more ready orders
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BillRequestQueue({
  branchId,
  requests,
  now,
  onSelectTable,
}: {
  branchId: string;
  requests: {
    tableId: string;
    tableNumber: string;
    session: SessionInfo;
  }[];
  now: number;
  onSelectTable: (tableId: string) => void;
}) {
  const visible = requests.slice(0, 4);
  return (
    <div className="rounded-card border border-line bg-white p-3 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Bill request alert
          </div>
          <div className="mt-0.5 text-[13px] font-semibold tracking-[-0.01em] text-ink">
            Tables ready to pay
          </div>
        </div>
        <Badge tone={requests.length > 0 ? "clay" : "neutral"}>
          {requests.length} checks
        </Badge>
      </div>

      {visible.length === 0 ? (
        <p className="mt-2.5 rounded-sm border border-dashed border-line bg-sand px-3 py-2 text-[12px] text-ink-muted">
          No tables have requested the check.
        </p>
      ) : (
        <div className="mt-2.5 flex flex-col divide-y divide-line">
          {visible.map(({ tableId, tableNumber, session }) => (
            <div
              key={session.sessionId}
              className="grid grid-cols-[1fr_auto] gap-3 py-2 first:pt-0 last:pb-0"
            >
              <button
                type="button"
                onClick={() => onSelectTable(tableId)}
                className="min-w-0 text-left"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mono text-[14px] font-semibold text-ink">
                    T{tableNumber}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-clay-500 px-2 py-[2px] text-[11px] font-semibold text-white">
                    <span className="h-1.5 w-1.5 animate-marrow-blink rounded-full bg-white" />
                    Check requested
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-ink-muted">
                  <span className="mono tabular-nums">
                    {formatPrice(session.subtotal)}
                  </span>
                  <span>
                    {session.orderCount}{" "}
                    {session.orderCount === 1 ? "order" : "orders"}
                  </span>
                  <span className="mono tabular-nums">
                    {sessionDuration(session.seatedAt, now)}
                  </span>
                </div>
              </button>
              <Link
                href={`/pos/${branchId}?session=${session.sessionId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="self-center"
              >
                <PillButton className={WAITSTAFF_ACTION_BUTTON}>POS</PillButton>
              </Link>
            </div>
          ))}
          {requests.length > visible.length && (
            <div className="pt-3 text-[12px] font-medium text-ink-muted">
              +{requests.length - visible.length} more check requests
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============== Header pieces ==============

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
      className="btn-quiet flex items-center gap-[6px] rounded-[8px] px-[10px] py-[6px] text-[12px] text-[var(--ink-2)] tracking-[0.02em]"
    >
      <span aria-hidden className="text-[13px] leading-none">
        {theme === "light" ? "◐" : "○"}
      </span>
      {nextLabel}
    </button>
  );
}

function WaitLivePill({
  connected,
  latency,
}: {
  connected: boolean;
  latency: number | null;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 10px",
        borderRadius: 999,
        border: "1px solid",
        borderColor: connected ? "var(--olive)" : "var(--line-strong)",
        background: connected ? "var(--olive-soft)" : "var(--bg-sunken)",
        color: connected ? "var(--olive)" : "var(--ink-3)",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: connected ? "var(--olive)" : "var(--ink-3)",
          animation: connected ? "blink 1.6s infinite" : "none",
        }}
      />
      {connected ? "Live" : "Offline"}
      {connected && latency != null && (
        <span
          className="mono"
          style={{ color: "var(--olive)", opacity: 0.7, letterSpacing: 0 }}
        >
          {latency}ms
        </span>
      )}
    </span>
  );
}

// Mono "Restaurant · Branch" text that opens a dropdown to switch branches,
// matching the KDS header subtext but interactive (waitstaff users span
// multiple branches).
function WaitBranchSwitcher({
  branches,
  branchId,
  restaurantName,
  activeBranchName,
  onChange,
}: {
  branches: { id: string; name: string }[];
  branchId: string | null;
  restaurantName: string | null;
  activeBranchName: string | null;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const label = `${restaurantName ?? "—"} · ${activeBranchName ?? ""}`;

  if (branches.length <= 1) {
    return (
      <span
        className="mono"
        style={{ fontSize: 11, color: "var(--ink-4)" }}
      >
        {label}
      </span>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        className="mono inline-flex items-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 transition-colors"
        style={{
          fontSize: 11,
          color: open ? "var(--ink-2)" : "var(--ink-4)",
          background: open ? "var(--bg-sunken)" : "transparent",
        }}
        onMouseEnter={(e) => {
          if (!open) {
            e.currentTarget.style.background = "var(--bg-sunken)";
            e.currentTarget.style.color = "var(--ink-2)";
          }
        }}
        onMouseLeave={(e) => {
          if (!open) {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--ink-4)";
          }
        }}
      >
        <span className="max-w-[280px] truncate">{label}</span>
        <span
          aria-hidden
          className="transition-transform"
          style={{
            fontSize: 9,
            transform: open ? "rotate(180deg)" : "none",
            opacity: 0.7,
          }}
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          className="absolute left-0 z-[95] mt-2 w-[288px] animate-slide-up rounded-lg border border-line bg-white p-2 shadow-pop"
          style={{ borderRadius: 16 }}
        >
          <div className="px-2.5 pb-2 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
            Switch branch
          </div>
          <div className="flex flex-col gap-0.5">
            {branches.map((b) => {
              const isActive = b.id === branchId;
              return (
                <button
                  key={b.id}
                  onClick={() => {
                    onChange(b.id);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-md border-0 px-2.5 py-2 text-left transition-colors"
                  style={{
                    background: isActive ? "var(--bg-sunken)" : "transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive)
                      e.currentTarget.style.background = "var(--bg-sunken)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive)
                      e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span
                    className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-md"
                    style={{
                      background: isActive
                        ? "var(--accent-soft)"
                        : "var(--bg-sunken)",
                      color: isActive ? "var(--accent)" : "var(--ink-3)",
                      fontSize: 14,
                    }}
                    aria-hidden
                  >
                    ⌂
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className="block truncate text-[13px] font-semibold"
                      style={{ letterSpacing: "-0.01em" }}
                    >
                      {b.name}
                    </span>
                  </span>
                  {isActive && (
                    <span
                      aria-hidden
                      className="flex-shrink-0 text-clay-500"
                      style={{ fontSize: 14 }}
                    >
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
