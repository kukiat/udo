import { relations } from "drizzle-orm";
import {
  integer,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { bills } from "./bill";
import { branches } from "./branch";
import { sessionStatus, tableShape, tableStatus } from "./enums";
import { floorZones } from "./floor";
import { orders } from "./order";
import { reservations } from "./reservations";

export const tables = pgTable(
  "tables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    tableNumber: text("table_number").notNull(),
    status: tableStatus("status").notNull().default("available"),
    // Floor plan layout. Positions are logical canvas units (1000x600 per
    // zone); null posX/posY means the table has not been placed on the plan.
    zoneId: uuid("zone_id").references(() => floorZones.id, {
      onDelete: "set null",
    }),
    posX: integer("pos_x"),
    posY: integer("pos_y"),
    width: integer("width").notNull().default(120),
    height: integer("height").notNull().default(120),
    shape: tableShape("shape").notNull().default("rect"),
    seats: integer("seats").notNull().default(4),
    rotation: integer("rotation").notNull().default(0),
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
    partySize: integer("party_size"),
    seatedAt: timestamp("seated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    tableNote: text("table_note"),
    customerName: text("customer_name"),
    customerPhone: text("customer_phone"),
    expectedLeaveAt: timestamp("expected_leave_at", { withTimezone: true }),
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
  zone: one(floorZones, {
    fields: [tables.zoneId],
    references: [floorZones.id],
  }),
  sessions: many(tableSessions),
  orders: many(orders),
  reservations: many(reservations),
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
