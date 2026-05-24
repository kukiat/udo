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
export type TableStatus = "available" | "occupied";

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

export type ServerToClientEvents = {
  "kds:reject": (p: KdsRejectPayload) => void;
  "kds:screen-count": (p: ScreenCountPayload) => void;
  "order:new": (order: OrderDTO) => void;
  "order:status-update": (p: { order: OrderDTO }) => void;
};

export type ClientToServerEvents = {
  "kds:join": (p: KdsJoinPayload) => void;
  "table:join": (p: TableJoinPayload) => void;
};
