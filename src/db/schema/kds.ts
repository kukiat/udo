import { relations } from "drizzle-orm";
import { index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { branches } from "./branch";
import { menuItems } from "./menu";

export const kdsStations = pgTable(
  "kds_stations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("kds_stations_branch_id_idx").on(t.branchId)],
);

export const kdsStationsRelations = relations(kdsStations, ({ one, many }) => ({
  branch: one(branches, {
    fields: [kdsStations.branchId],
    references: [branches.id],
  }),
  menuItems: many(menuItems),
}));
