import { relations } from "drizzle-orm";
import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { branches } from "./branch";
import { money, orderStatus, orderType } from "./enums";
import { menuItems, optionItems } from "./menu";
import { tables, tableSessions } from "./table";

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    tableId: uuid("table_id")
      .notNull()
      .references(() => tables.id, { onDelete: "restrict" }),
    tableSessionId: uuid("table_session_id")
      .notNull()
      .references(() => tableSessions.id, { onDelete: "cascade" }),
    orderNumber: text("order_number").notNull(),
    status: orderStatus("status").notNull().default("pending"),
    type: orderType("type").notNull().default("dine_in"),
    totalAmount: money("total_amount").notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
  },
  (t) => [
    index("orders_branch_id_status_idx").on(t.branchId, t.status),
    index("orders_table_id_status_idx").on(t.tableId, t.status),
    index("orders_table_session_id_idx").on(t.tableSessionId),
    index("orders_branch_id_created_at_idx").on(t.branchId, t.createdAt),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    menuItemId: uuid("menu_item_id")
      .notNull()
      .references(() => menuItems.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull().default(1),
    unitPrice: money("unit_price").notNull(),
    note: text("note"),
  },
  (t) => [
    index("order_items_order_id_idx").on(t.orderId),
    index("order_items_menu_item_id_idx").on(t.menuItemId),
  ],
);

export const orderItemOptions = pgTable(
  "order_item_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    optionItemId: uuid("option_item_id")
      .notNull()
      .references(() => optionItems.id, { onDelete: "restrict" }),
    price: money("price").notNull().default("0"),
  },
  (t) => [
    index("order_item_options_order_item_id_idx").on(t.orderItemId),
    index("order_item_options_option_item_id_idx").on(t.optionItemId),
  ],
);

export const ordersRelations = relations(orders, ({ one, many }) => ({
  branch: one(branches, {
    fields: [orders.branchId],
    references: [branches.id],
  }),
  table: one(tables, {
    fields: [orders.tableId],
    references: [tables.id],
  }),
  tableSession: one(tableSessions, {
    fields: [orders.tableSessionId],
    references: [tableSessions.id],
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one, many }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  menuItem: one(menuItems, {
    fields: [orderItems.menuItemId],
    references: [menuItems.id],
  }),
  options: many(orderItemOptions),
}));

export const orderItemOptionsRelations = relations(
  orderItemOptions,
  ({ one }) => ({
    orderItem: one(orderItems, {
      fields: [orderItemOptions.orderItemId],
      references: [orderItems.id],
    }),
    optionItem: one(optionItems, {
      fields: [orderItemOptions.optionItemId],
      references: [optionItems.id],
    }),
  }),
);
