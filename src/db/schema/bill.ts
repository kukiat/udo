import { relations } from "drizzle-orm";
import { index, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { billStatus, money } from "./enums";
import { payments } from "./pos";
import { tableSessions } from "./table";

export const bills = pgTable(
  "bills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tableSessionId: uuid("table_session_id")
      .notNull()
      .references(() => tableSessions.id, { onDelete: "cascade" }),
    subtotal: money("subtotal").notNull().default("0"),
    vat: money("vat").notNull().default("0"),
    serviceCharge: money("service_charge").notNull().default("0"),
    discount: money("discount").notNull().default("0"),
    totalAmount: money("total_amount").notNull().default("0"),
    status: billStatus("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("bills_table_session_id_idx").on(t.tableSessionId),
    index("bills_status_idx").on(t.status),
  ],
);

export const billsRelations = relations(bills, ({ one, many }) => ({
  tableSession: one(tableSessions, {
    fields: [bills.tableSessionId],
    references: [tableSessions.id],
  }),
  payments: many(payments),
}));
