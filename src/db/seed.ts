import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { hashPassword } from "../lib/password";

// Seed over the direct connection (port 5432); fall back to DATABASE_URL.
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DIRECT_URL / DATABASE_URL is not set");

const client = postgres(connectionString, { max: 1, prepare: false });
const db = drizzle(client, { schema });

const PLACEHOLDER = (label: string) =>
  `https://placehold.co/600x400?text=${encodeURIComponent(label)}`;

async function main() {
  console.log("Seeding database...");

  // Clear existing data (children first) for idempotent re-seeding.
  await db.delete(schema.payments);
  await db.delete(schema.shifts);
  await db.delete(schema.sessions);
  await db.delete(schema.orderItemOptions);
  await db.delete(schema.orderItems);
  await db.delete(schema.orders);
  await db.delete(schema.bills);
  await db.delete(schema.tableSessions);
  await db.delete(schema.optionItems);
  await db.delete(schema.optionGroups);
  await db.delete(schema.branchMenuItems);
  await db.delete(schema.menuItems);
  await db.delete(schema.categories);
  await db.delete(schema.kdsStations);
  await db.delete(schema.tables);
  await db.delete(schema.users);
  await db.delete(schema.branches);
  await db.delete(schema.restaurants);

  // Restaurant
  const [restaurant] = await db
    .insert(schema.restaurants)
    .values({ name: "Demo Restaurant", logo: PLACEHOLDER("Demo") })
    .returning();

  // Branch
  const [branch] = await db
    .insert(schema.branches)
    .values({
      restaurantId: restaurant.id,
      name: "Main Branch",
      address: "123 Demo Street, Bangkok",
      settings: { maxKdsScreens: 3, vatRate: 0.07, serviceChargeRate: 0 },
    })
    .returning();

  // Users — all seeded with password "password123".
  const pw = await hashPassword("password123");
  await db.insert(schema.users).values([
    {
      email: "admin@demo.test",
      name: "Admin Owner",
      passwordHash: pw,
      role: "admin",
      restaurantId: restaurant.id,
      branchId: null,
    },
    {
      email: "manager@demo.test",
      name: "Branch Manager",
      passwordHash: pw,
      role: "branch_manager",
      restaurantId: restaurant.id,
      branchId: branch.id,
    },
    {
      email: "cashier@demo.test",
      name: "Front Cashier",
      passwordHash: pw,
      role: "cashier",
      restaurantId: restaurant.id,
      branchId: branch.id,
    },
    {
      email: "kitchen@demo.test",
      name: "Kitchen Staff",
      passwordHash: pw,
      role: "kitchen_staff",
      restaurantId: restaurant.id,
      branchId: branch.id,
    },
    {
      email: "waiter@demo.test",
      name: "Wait Staff",
      passwordHash: pw,
      role: "waitstaff",
      restaurantId: restaurant.id,
      branchId: branch.id,
    },
  ]);

  // Tables
  await db.insert(schema.tables).values(
    Array.from({ length: 5 }, (_, i) => ({
      branchId: branch.id,
      tableNumber: String(i + 1),
      status: "available" as const,
    })),
  );

  // KDS Stations
  const [hot, cold, drinks] = await db
    .insert(schema.kdsStations)
    .values([
      { branchId: branch.id, name: "Hot Kitchen", sortOrder: 0 },
      { branchId: branch.id, name: "Cold Kitchen", sortOrder: 1 },
      { branchId: branch.id, name: "Drinks", sortOrder: 2 },
    ])
    .returning();

  // Categories
  const [appetizers, mains, beverages] = await db
    .insert(schema.categories)
    .values([
      { restaurantId: restaurant.id, name: "Appetizers", sortOrder: 0 },
      { restaurantId: restaurant.id, name: "Main Course", sortOrder: 1 },
      { restaurantId: restaurant.id, name: "Beverages", sortOrder: 2 },
    ])
    .returning();

  // Menu items
  const menu = await db
    .insert(schema.menuItems)
    .values([
      // Appetizers (cold)
      {
        restaurantId: restaurant.id,
        name: "Spring Rolls",
        description: "Crispy vegetable spring rolls",
        price: "120.00",
        image: PLACEHOLDER("Spring Rolls"),
        categoryId: appetizers.id,
        kdsStationId: cold.id,
        status: "available",
      },
      {
        restaurantId: restaurant.id,
        name: "Som Tam",
        description: "Spicy green papaya salad",
        price: "90.00",
        image: PLACEHOLDER("Som Tam"),
        categoryId: appetizers.id,
        kdsStationId: cold.id,
        status: "available",
      },
      {
        restaurantId: restaurant.id,
        name: "Chicken Satay",
        description: "Grilled skewers with peanut sauce",
        price: "150.00",
        image: PLACEHOLDER("Satay"),
        categoryId: appetizers.id,
        kdsStationId: hot.id,
        status: "available",
      },
      // Mains (hot)
      {
        restaurantId: restaurant.id,
        name: "Pad Thai",
        description: "Stir-fried rice noodles",
        price: "180.00",
        image: PLACEHOLDER("Pad Thai"),
        categoryId: mains.id,
        kdsStationId: hot.id,
        status: "available",
      },
      {
        restaurantId: restaurant.id,
        name: "Green Curry",
        description: "Thai green curry with chicken",
        price: "200.00",
        image: PLACEHOLDER("Green Curry"),
        categoryId: mains.id,
        kdsStationId: hot.id,
        status: "available",
      },
      {
        restaurantId: restaurant.id,
        name: "Fried Rice",
        description: "Thai-style fried rice",
        price: "160.00",
        image: PLACEHOLDER("Fried Rice"),
        categoryId: mains.id,
        kdsStationId: hot.id,
        status: "available",
      },
      {
        restaurantId: restaurant.id,
        name: "Massaman Beef",
        description: "Slow-cooked beef in massaman curry",
        price: "240.00",
        image: PLACEHOLDER("Massaman"),
        categoryId: mains.id,
        kdsStationId: hot.id,
        status: "sold_out",
      },
      // Beverages (drinks)
      {
        restaurantId: restaurant.id,
        name: "Thai Iced Tea",
        description: "Sweet creamy iced tea",
        price: "60.00",
        image: PLACEHOLDER("Thai Tea"),
        categoryId: beverages.id,
        kdsStationId: drinks.id,
        status: "available",
      },
      {
        restaurantId: restaurant.id,
        name: "Coconut Water",
        description: "Fresh young coconut",
        price: "70.00",
        image: PLACEHOLDER("Coconut"),
        categoryId: beverages.id,
        kdsStationId: drinks.id,
        status: "available",
      },
      {
        restaurantId: restaurant.id,
        name: "Lime Soda",
        description: "Refreshing fresh lime soda",
        price: "55.00",
        image: PLACEHOLDER("Lime Soda"),
        categoryId: beverages.id,
        kdsStationId: drinks.id,
        status: "available",
      },
    ])
    .returning();

  const byName = (n: string) => menu.find((m) => m.name === n)!;

  // Option groups + items
  // Pad Thai: spice level (required, single), toppings (optional, multi)
  const padThai = byName("Pad Thai");
  const [spiceGroup, toppingGroup] = await db
    .insert(schema.optionGroups)
    .values([
      {
        menuItemId: padThai.id,
        name: "Spice Level",
        required: true,
        minSelect: 1,
        maxSelect: 1,
        sortOrder: 0,
      },
      {
        menuItemId: padThai.id,
        name: "Toppings",
        required: false,
        minSelect: 0,
        maxSelect: 3,
        sortOrder: 1,
      },
    ])
    .returning();

  await db.insert(schema.optionItems).values([
    { optionGroupId: spiceGroup.id, name: "Mild", price: "0", sortOrder: 0 },
    { optionGroupId: spiceGroup.id, name: "Medium", price: "0", sortOrder: 1 },
    { optionGroupId: spiceGroup.id, name: "Hot", price: "0", sortOrder: 2 },
    { optionGroupId: toppingGroup.id, name: "Shrimp", price: "40", sortOrder: 0 },
    { optionGroupId: toppingGroup.id, name: "Extra Egg", price: "15", sortOrder: 1 },
    { optionGroupId: toppingGroup.id, name: "Peanuts", price: "10", sortOrder: 2 },
  ]);

  // Thai Iced Tea: size (required, single)
  const tea = byName("Thai Iced Tea");
  const [sizeGroup] = await db
    .insert(schema.optionGroups)
    .values([
      {
        menuItemId: tea.id,
        name: "Size",
        required: true,
        minSelect: 1,
        maxSelect: 1,
        sortOrder: 0,
      },
    ])
    .returning();

  await db.insert(schema.optionItems).values([
    { optionGroupId: sizeGroup.id, name: "Regular", price: "0", sortOrder: 0 },
    { optionGroupId: sizeGroup.id, name: "Large", price: "20", sortOrder: 1 },
  ]);

  console.log(
    `Seeded: 1 restaurant, 1 branch, 5 users, 5 tables, 3 stations, 3 categories, ${menu.length} menu items, option groups.`,
  );
}

main()
  .then(() => client.end())
  .catch(async (err) => {
    console.error(err);
    await client.end();
    process.exit(1);
  });
