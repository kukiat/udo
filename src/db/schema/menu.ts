import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { branches } from "./branch";
import { categories } from "./category";
import { menuItemStatus, money } from "./enums";
import { kdsStations } from "./kds";
import { orderItems } from "./order";
import { restaurants } from "./restaurant";

export const menuItems = pgTable(
  "menu_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    price: money("price").notNull(),
    image: text("image"),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    kdsStationId: uuid("kds_station_id").references(() => kdsStations.id, {
      onDelete: "set null",
    }),
    status: menuItemStatus("status").notNull().default("available"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("menu_items_restaurant_id_idx").on(t.restaurantId),
    index("menu_items_category_id_idx").on(t.categoryId),
    index("menu_items_kds_station_id_idx").on(t.kdsStationId),
    index("menu_items_status_deleted_at_idx").on(t.status, t.deletedAt),
  ],
);

export const branchMenuItems = pgTable(
  "branch_menu_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    menuItemId: uuid("menu_item_id")
      .notNull()
      .references(() => menuItems.id, { onDelete: "cascade" }),
    price: money("price"),
    isAvailable: boolean("is_available").notNull().default(true),
  },
  (t) => [
    uniqueIndex("branch_menu_items_branch_id_menu_item_id_idx").on(
      t.branchId,
      t.menuItemId,
    ),
    index("branch_menu_items_menu_item_id_idx").on(t.menuItemId),
  ],
);

export const optionGroups = pgTable(
  "option_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    menuItemId: uuid("menu_item_id")
      .notNull()
      .references(() => menuItems.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    required: boolean("required").notNull().default(false),
    minSelect: integer("min_select").notNull().default(0),
    maxSelect: integer("max_select").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("option_groups_menu_item_id_idx").on(t.menuItemId)],
);

export const optionItems = pgTable(
  "option_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    optionGroupId: uuid("option_group_id")
      .notNull()
      .references(() => optionGroups.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    price: money("price").notNull().default("0"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("option_items_option_group_id_idx").on(t.optionGroupId)],
);

export const menuItemsRelations = relations(menuItems, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [menuItems.restaurantId],
    references: [restaurants.id],
  }),
  category: one(categories, {
    fields: [menuItems.categoryId],
    references: [categories.id],
  }),
  kdsStation: one(kdsStations, {
    fields: [menuItems.kdsStationId],
    references: [kdsStations.id],
  }),
  optionGroups: many(optionGroups),
  branchMenuItems: many(branchMenuItems),
}));

export const branchMenuItemsRelations = relations(
  branchMenuItems,
  ({ one }) => ({
    branch: one(branches, {
      fields: [branchMenuItems.branchId],
      references: [branches.id],
    }),
    menuItem: one(menuItems, {
      fields: [branchMenuItems.menuItemId],
      references: [menuItems.id],
    }),
  }),
);

export const optionGroupsRelations = relations(
  optionGroups,
  ({ one, many }) => ({
    menuItem: one(menuItems, {
      fields: [optionGroups.menuItemId],
      references: [menuItems.id],
    }),
    optionItems: many(optionItems),
  }),
);

export const optionItemsRelations = relations(optionItems, ({ one }) => ({
  optionGroup: one(optionGroups, {
    fields: [optionItems.optionGroupId],
    references: [optionGroups.id],
  }),
}));
