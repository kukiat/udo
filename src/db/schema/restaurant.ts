import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { branches } from "./branch";
import { categories } from "./category";
import { menuItems } from "./menu";
import { users } from "./user";

export const restaurants = pgTable("restaurants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  logo: text("logo"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const restaurantsRelations = relations(restaurants, ({ many }) => ({
  branches: many(branches),
  users: many(users),
  categories: many(categories),
  menuItems: many(menuItems),
}));
