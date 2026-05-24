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

// Real food photos from Unsplash (served via their CDN, cropped to a card-friendly size).
const img = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=80`;

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
    .values({
      name: "Bangkok Bites",
      logo: img("1552566626-52f8b828add9"),
    })
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
  const [appetizers, soups, mains, curries, beverages, desserts] = await db
    .insert(schema.categories)
    .values([
      { restaurantId: restaurant.id, name: "Appetizers", sortOrder: 0 },
      { restaurantId: restaurant.id, name: "Soups & Salads", sortOrder: 1 },
      { restaurantId: restaurant.id, name: "Main Course", sortOrder: 2 },
      { restaurantId: restaurant.id, name: "Curries", sortOrder: 3 },
      { restaurantId: restaurant.id, name: "Beverages", sortOrder: 4 },
      { restaurantId: restaurant.id, name: "Desserts", sortOrder: 5 },
    ])
    .returning();

  // Menu items
  const menu = await db
    .insert(schema.menuItems)
    .values([
      // Appetizers
      {
        restaurantId: restaurant.id,
        name: "Crispy Spring Rolls",
        description:
          "Golden vegetable spring rolls served with sweet chili dipping sauce.",
        price: "120.00",
        image: img("1544025162-d76694265947"),
        categoryId: appetizers.id,
        kdsStationId: hot.id,
        status: "available",
      },
      {
        restaurantId: restaurant.id,
        name: "Chicken Satay",
        description:
          "Grilled marinated chicken skewers with peanut sauce and cucumber relish.",
        price: "150.00",
        image: img("1529563021893-cc83c992d75d"),
        categoryId: appetizers.id,
        kdsStationId: hot.id,
        status: "available",
      },
      {
        restaurantId: restaurant.id,
        name: "Fresh Summer Rolls",
        description:
          "Rice paper rolls with shrimp, herbs and vermicelli, served chilled.",
        price: "130.00",
        image: img("1562967916-eb82221dfb92"),
        categoryId: appetizers.id,
        kdsStationId: cold.id,
        status: "available",
      },
      // Soups & Salads
      {
        restaurantId: restaurant.id,
        name: "Tom Yum Goong",
        description:
          "Hot and sour prawn soup with lemongrass, galangal and lime.",
        price: "180.00",
        image: img("1569718212165-3a8278d5f624"),
        categoryId: soups.id,
        kdsStationId: hot.id,
        status: "available",
      },
      {
        restaurantId: restaurant.id,
        name: "Som Tam",
        description: "Spicy green papaya salad with peanuts, lime and chili.",
        price: "90.00",
        image: img("1455619452474-d2be8b1e70cd"),
        categoryId: soups.id,
        kdsStationId: cold.id,
        status: "available",
      },
      // Main Course
      {
        restaurantId: restaurant.id,
        name: "Pad Thai",
        description:
          "Stir-fried rice noodles with egg, tofu, bean sprouts and tamarind.",
        price: "180.00",
        image: img("1559314809-0d155014e29e"),
        categoryId: mains.id,
        kdsStationId: hot.id,
        status: "available",
      },
      {
        restaurantId: restaurant.id,
        name: "Thai Fried Rice",
        description: "Jasmine rice wok-fried with egg, chicken and scallions.",
        price: "160.00",
        image: img("1603133872878-684f208fb84b"),
        categoryId: mains.id,
        kdsStationId: hot.id,
        status: "available",
      },
      {
        restaurantId: restaurant.id,
        name: "Pad Krapow",
        description:
          "Stir-fried minced pork with holy basil and chili, topped with a fried egg.",
        price: "170.00",
        image: img("1626804475297-41608ea09aeb"),
        categoryId: mains.id,
        kdsStationId: hot.id,
        status: "available",
      },
      // Curries
      {
        restaurantId: restaurant.id,
        name: "Green Curry Chicken",
        description:
          "Creamy coconut green curry with chicken, eggplant and Thai basil.",
        price: "200.00",
        image: img("1600555379765-f82335a7b1b0"),
        categoryId: curries.id,
        kdsStationId: hot.id,
        status: "available",
      },
      {
        restaurantId: restaurant.id,
        name: "Massaman Beef",
        description:
          "Slow-braised beef in rich massaman curry with potato and peanuts.",
        price: "240.00",
        image: img("1574484284002-952d92456975"),
        categoryId: curries.id,
        kdsStationId: hot.id,
        status: "sold_out",
      },
      // Beverages
      {
        restaurantId: restaurant.id,
        name: "Thai Iced Tea",
        description: "Sweet, creamy Thai tea poured over ice.",
        price: "60.00",
        image: img("1558857563-b371033873b8"),
        categoryId: beverages.id,
        kdsStationId: drinks.id,
        status: "available",
      },
      {
        restaurantId: restaurant.id,
        name: "Fresh Coconut Water",
        description: "Chilled young coconut served whole.",
        price: "70.00",
        image: img("1581006852262-e4307cf6283a"),
        categoryId: beverages.id,
        kdsStationId: drinks.id,
        status: "available",
      },
      {
        restaurantId: restaurant.id,
        name: "Fresh Lime Soda",
        description: "Refreshing lime soda with a hint of salt.",
        price: "55.00",
        image: img("1513558161293-cdaf765ed2fd"),
        categoryId: beverages.id,
        kdsStationId: drinks.id,
        status: "available",
      },
      // Desserts
      {
        restaurantId: restaurant.id,
        name: "Mango Sticky Rice",
        description:
          "Sweet glutinous rice with ripe mango and coconut cream.",
        price: "110.00",
        image: img("1621236378699-8597faf6a176"),
        categoryId: desserts.id,
        kdsStationId: cold.id,
        status: "available",
      },
      {
        restaurantId: restaurant.id,
        name: "Coconut Ice Cream",
        description: "House-made coconut ice cream with toasted peanuts.",
        price: "80.00",
        image: img("1488900128323-21503983a07e"),
        categoryId: desserts.id,
        kdsStationId: cold.id,
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
    `Seeded: 1 restaurant, 1 branch, 5 users, 5 tables, 3 stations, 6 categories, ${menu.length} menu items, option groups.`,
  );
}

main()
  .then(() => client.end())
  .catch(async (err) => {
    console.error(err);
    await client.end();
    process.exit(1);
  });
