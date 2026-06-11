import { relations } from "drizzle-orm";
import { index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { branches } from "./branch";

export const floorZones = pgTable(
  "floor_zones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("floor_zones_branch_id_idx").on(t.branchId)],
);

export const floorZonesRelations = relations(floorZones, ({ one }) => ({
  branch: one(branches, {
    fields: [floorZones.branchId],
    references: [branches.id],
  }),
}));
