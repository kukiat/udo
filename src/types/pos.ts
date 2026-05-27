import type { BillTotals } from "@/lib/utils";

export type PaymentMethod = "cash" | "card" | "qr";

export type PosSession = {
  sessionId: string;
  tableId: string;
  tableNumber: string;
  orderCount: number;
  subtotal: string;
  billStatus: "open" | "requested" | "paid";
  createdAt: string;
};

export type Shift = {
  id: string;
  branchId: string;
  cashierId: string;
  cashierName: string;
  status: "open" | "closed";
  openingFloat: string;
  closingAmount: string | null;
  note: string | null;
  openedAt: string;
  closedAt: string | null;
  paymentCount: number;
  cashTotal: string;
  salesTotal: string;
  expectedCash: string;
};

export type BillLineItem = {
  orderNumber: string;
  name: string;
  quantity: number;
  unitPrice: string;
  options: { name: string; price: string }[];
};

export type ReceiptData = {
  sessionId: string;
  branchId: string;
  branchName: string;
  branchAddress: string | null;
  restaurantName: string;
  tableNumber: string;
  totals: BillTotals;
  lineItems: BillLineItem[];
  method: PaymentMethod;
  tendered: number | null;
  change: number | null;
};
