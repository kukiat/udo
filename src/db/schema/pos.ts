import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { bills } from "./bill";
import { branches } from "./branch";
import { money, paymentMethod, shiftStatus } from "./enums";
import { users } from "./user";

// A cashier's till session. Payments are attached to the open shift so a
// drawer can be reconciled (expected cash vs. counted) at close.
export const shifts = pgTable(
  "shifts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    cashierId: uuid("cashier_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: shiftStatus("status").notNull().default("open"),
    openingFloat: money("opening_float").notNull().default("0"),
    // Cash counted in the drawer at close (null while open).
    closingAmount: money("closing_amount"),
    note: text("note"),
    openedAt: timestamp("opened_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [
    index("shifts_branch_id_status_idx").on(t.branchId, t.status),
    index("shifts_cashier_id_idx").on(t.cashierId),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    billId: uuid("bill_id")
      .notNull()
      .references(() => bills.id, { onDelete: "cascade" }),
    shiftId: uuid("shift_id").references(() => shifts.id, {
      onDelete: "set null",
    }),
    cashierId: uuid("cashier_id").references(() => users.id, {
      onDelete: "set null",
    }),
    method: paymentMethod("method").notNull(),
    amount: money("amount").notNull(),
    // For cash: amount handed over and change returned.
    tendered: money("tendered"),
    change: money("change"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("payments_bill_id_idx").on(t.billId),
    index("payments_shift_id_idx").on(t.shiftId),
  ],
);

export const shiftsRelations = relations(shifts, ({ one, many }) => ({
  branch: one(branches, {
    fields: [shifts.branchId],
    references: [branches.id],
  }),
  cashier: one(users, {
    fields: [shifts.cashierId],
    references: [users.id],
  }),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  bill: one(bills, {
    fields: [payments.billId],
    references: [bills.id],
  }),
  shift: one(shifts, {
    fields: [payments.shiftId],
    references: [shifts.id],
  }),
  cashier: one(users, {
    fields: [payments.cashierId],
    references: [users.id],
  }),
}));
