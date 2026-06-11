import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { branches } from "./branch";
import { reservationStatus } from "./enums";
import { tables, tableSessions } from "./table";
import { users } from "./user";

export const reservations = pgTable(
  "reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    tableId: uuid("table_id")
      .notNull()
      .references(() => tables.id, { onDelete: "cascade" }),
    // Deleting a staff user erases their reservation history rows too.
    reservedById: uuid("reserved_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone"),
    partySize: integer("party_size").notNull(),
    note: text("note"),
    reservedFor: timestamp("reserved_for", { withTimezone: true }).notNull(),
    status: reservationStatus("status").notNull().default("booked"),
    // Set when the reservation is seated (links to the opened dining session).
    sessionId: uuid("session_id").references(() => tableSessions.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    seatedAt: timestamp("seated_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (t) => [
    index("reservations_table_id_reserved_for_idx").on(
      t.tableId,
      t.reservedFor,
    ),
    index("reservations_branch_id_reserved_for_idx").on(
      t.branchId,
      t.reservedFor,
    ),
    index("reservations_status_idx").on(t.status),
  ],
);

export const reservationsRelations = relations(reservations, ({ one }) => ({
  branch: one(branches, {
    fields: [reservations.branchId],
    references: [branches.id],
  }),
  table: one(tables, {
    fields: [reservations.tableId],
    references: [tables.id],
  }),
  reservedBy: one(users, {
    fields: [reservations.reservedById],
    references: [users.id],
  }),
  session: one(tableSessions, {
    fields: [reservations.sessionId],
    references: [tableSessions.id],
  }),
}));
