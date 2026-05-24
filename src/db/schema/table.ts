import { relations } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { bills } from "./bill";
import { branches } from "./branch";
import { sessionStatus, tableStatus } from "./enums";
import { orders } from "./order";

export const tables = pgTable(
  "tables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    tableNumber: text("table_number").notNull(),
    status: tableStatus("status").notNull().default("available"),
  },
  (t) => [
    index("tables_branch_id_idx").on(t.branchId),
    uniqueIndex("tables_branch_id_table_number_idx").on(
      t.branchId,
      t.tableNumber,
    ),
  ],
);

export const tableSessions = pgTable(
  "table_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    tableId: uuid("table_id")
      .notNull()
      .references(() => tables.id, { onDelete: "cascade" }),
    status: sessionStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [
    index("table_sessions_branch_id_idx").on(t.branchId),
    index("table_sessions_table_id_status_idx").on(t.tableId, t.status),
  ],
);

export const tablesRelations = relations(tables, ({ one, many }) => ({
  branch: one(branches, {
    fields: [tables.branchId],
    references: [branches.id],
  }),
  sessions: many(tableSessions),
  orders: many(orders),
}));

export const tableSessionsRelations = relations(
  tableSessions,
  ({ one, many }) => ({
    branch: one(branches, {
      fields: [tableSessions.branchId],
      references: [branches.id],
    }),
    table: one(tables, {
      fields: [tableSessions.tableId],
      references: [tables.id],
    }),
    orders: many(orders),
    bill: one(bills),
  }),
);
