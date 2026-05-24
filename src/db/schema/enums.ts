import { numeric, pgEnum } from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const userRole = pgEnum("user_role", [
  "owner",
  "admin",
  "branch_manager",
  "cashier",
  "kitchen_staff",
  "waitstaff",
]);
export const tableStatus = pgEnum("table_status", ["available", "occupied"]);
export const sessionStatus = pgEnum("session_status", ["active", "closed"]);
export const menuItemStatus = pgEnum("menu_item_status", [
  "available",
  "sold_out",
  "hidden",
]);
export const orderStatus = pgEnum("order_status", [
  "pending",
  "preparing",
  "ready",
  "served",
  "completed",
  "cancelled",
]);
export const orderType = pgEnum("order_type", ["dine_in", "take_away"]);
export const billStatus = pgEnum("bill_status", ["open", "requested", "paid"]);
export const paymentMethod = pgEnum("payment_method", ["cash", "card", "qr"]);
export const shiftStatus = pgEnum("shift_status", ["open", "closed"]);

// Money helper: NUMERIC(10,2)
export const money = (name: string) =>
  numeric(name, { precision: 10, scale: 2 });
