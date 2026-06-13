// ---------------------------------------------------------------------------
// Shared domain & API types
// ---------------------------------------------------------------------------

export type MenuItemStatus = "available" | "sold_out" | "hidden";
export type OrderStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "served"
  | "completed"
  | "cancelled";
export type OrderType = "dine_in" | "take_away";
export type BillStatus = "open" | "requested" | "paid";
export type TableStatus = "available" | "occupied" | "reserved";
export type TableShape = "rect" | "circle";
export type ReservationStatus = "booked" | "seated" | "cancelled" | "no_show";

// --- Floor plan ---------------------------------------------------------------

export type FloorZoneDTO = {
  id: string;
  branchId: string;
  name: string;
  sortOrder: number;
};

/** A table row including its floor plan layout (null posX/posY = unplaced). */
export type TableLayoutDTO = {
  id: string;
  branchId: string;
  tableNumber: string;
  status: TableStatus;
  zoneId: string | null;
  posX: number | null;
  posY: number | null;
  width: number;
  height: number;
  shape: TableShape;
  seats: number;
  rotation: number;
};

// --- Reservations -------------------------------------------------------------

export type ReservationDTO = {
  id: string;
  branchId: string;
  tableId: string;
  tableNumber: string;
  status: ReservationStatus;
  customerName: string;
  customerPhone: string | null;
  partySize: number;
  note: string | null;
  reservedFor: string;
  reservedBy: { id: string; name: string } | null;
  sessionId: string | null;
  createdAt: string;
  seatedAt: string | null;
  cancelledAt: string | null;
};

// --- Storefront menu shapes -------------------------------------------------

export type OptionItemDTO = {
  id: string;
  name: string;
  price: string;
  sortOrder: number;
};

export type OptionGroupDTO = {
  id: string;
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  optionItems: OptionItemDTO[];
};

export type MenuItemDTO = {
  id: string;
  name: string;
  description: string | null;
  price: string; // effective price (branch override applied)
  basePrice: string;
  image: string | null;
  categoryId: string;
  kdsStationId: string | null;
  status: MenuItemStatus;
  optionGroups: OptionGroupDTO[];
};

export type CategoryWithItemsDTO = {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  image: string | null;
  items: MenuItemDTO[];
};

// --- Cart -------------------------------------------------------------------

export type CartOption = {
  optionGroupId: string;
  optionItemId: string;
  name: string;
  price: string;
};

export type CartLine = {
  // a stable id for this configured line (uuid generated client-side)
  lineId: string;
  menuItemId: string;
  name: string;
  unitPrice: string; // base price at time of add
  image: string | null;
  quantity: number;
  note: string;
  options: CartOption[];
};

// --- Orders -----------------------------------------------------------------

export type OrderItemOptionDTO = {
  id: string;
  optionItemId: string;
  name: string;
  price: string;
};

export type OrderItemDTO = {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: string;
  note: string | null;
  kdsStationId: string | null;
  category: string | null;
  options: OrderItemOptionDTO[];
};

export type OrderDTO = {
  id: string;
  branchId: string;
  tableId: string;
  tableNumber: string;
  tableSessionId: string;
  orderNumber: string;
  status: OrderStatus;
  type: OrderType;
  totalAmount: string;
  createdAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  items: OrderItemDTO[];
};

// --- API error format -------------------------------------------------------

export type ApiError = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

// ---------------------------------------------------------------------------
// Socket.IO event payloads
// ---------------------------------------------------------------------------

export type KdsJoinPayload = { branchId: string };
export type KdsRejectPayload = { reason: string; max: number };
export type ScreenCountPayload = { branchId: string; count: number; max: number };
export type TableJoinPayload = { tableId: string };
export type BillPaidPayload = { sessionId: string; tableId: string };
export type BillRequestedPayload = { sessionId: string; tableId: string };
export type TableMovedPayload = {
  branchId: string;
  sessionId: string;
  fromTableId: string;
  fromTableNumber: string;
  toTableId: string;
  toTableNumber: string;
};
export type SessionCancelledPayload = {
  branchId: string;
  sessionId: string;
  tableId: string;
  tableNumber: string;
};

export type ServerToClientEvents = {
  "kds:reject": (p: KdsRejectPayload) => void;
  "kds:screen-count": (p: ScreenCountPayload) => void;
  "order:new": (order: OrderDTO) => void;
  "order:status-update": (p: { order: OrderDTO }) => void;
  "bill:paid": (p: BillPaidPayload) => void;
  "bill:requested": (p: BillRequestedPayload) => void;
  "reservation:updated": (p: { branchId: string }) => void;
  "table:moved": (p: TableMovedPayload) => void;
  "session:cancelled": (p: SessionCancelledPayload) => void;
};

export type ClientToServerEvents = {
  "kds:join": (p: KdsJoinPayload) => void;
  "branch:join": (p: KdsJoinPayload) => void;
  "table:join": (p: TableJoinPayload) => void;
  ping: (ack: () => void) => void;
};
