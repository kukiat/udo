import { relations } from "drizzle-orm";
import {
  type AnyPgColumn,
  index,
  integer,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";

import { menuItems } from "./menu";
import { restaurants } from "./restaurant";

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    // Self-referential parent for sub-categories (null = top-level).
    parentId: uuid("parent_id").references((): AnyPgColumn => categories.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    image: text("image"),
  },
  (t) => [
    index("categories_restaurant_id_sort_order_idx").on(
      t.restaurantId,
      t.sortOrder,
    ),
    index("categories_parent_id_idx").on(t.parentId),
  ],
);

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [categories.restaurantId],
    references: [restaurants.id],
  }),
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: "category_parent",
  }),
  children: many(categories, { relationName: "category_parent" }),
  menuItems: many(menuItems),
}));
