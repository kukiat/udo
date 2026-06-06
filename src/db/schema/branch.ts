import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  time,
  uuid,
} from "drizzle-orm/pg-core";

import { branchMenuItems } from "./menu";
import { kdsStations } from "./kds";
import { orders } from "./order";
import { restaurants } from "./restaurant";
import { tables, tableSessions } from "./table";
import { users } from "./user";

export const branches = pgTable(
  "branches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    address: text("address"),
    openingTime: time("opening_time"),
    closingTime: time("closing_time"),
    // Soft-deactivation: inactive branches are hidden from operations but kept
    // (with their orders/history) instead of being hard-deleted.
    isActive: boolean("is_active").notNull().default(true),
    settings: jsonb("settings")
      .notNull()
      .$type<{
        maxKdsScreens: number;
        vatRate: number;
        serviceChargeRate: number;
      }>()
      .default({ maxKdsScreens: 3, vatRate: 0.07, serviceChargeRate: 0 }),
  },
  (t) => [index("branches_restaurant_id_idx").on(t.restaurantId)],
);

export const branchesRelations = relations(branches, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [branches.restaurantId],
    references: [restaurants.id],
  }),
  tables: many(tables),
  tableSessions: many(tableSessions),
  kdsStations: many(kdsStations),
  branchMenuItems: many(branchMenuItems),
  orders: many(orders),
  users: many(users),
}));
