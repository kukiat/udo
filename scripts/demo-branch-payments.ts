import "dotenv/config";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";

// One-off: backfill demo paid bills for every branch of a restaurant so the
// dashboard branch-comparison chart has data. Usage:
//   npx tsx scripts/demo-branch-payments.ts <restaurantId>
const restaurantId = process.argv[2];
if (!restaurantId) throw new Error("usage: tsx scripts/demo-branch-payments.ts <restaurantId>");

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DIRECT_URL / DATABASE_URL is not set");
const client = postgres(connectionString, { max: 1, prepare: false });
const db = drizzle(client, { schema });

const METHODS = ["cash", "card", "qr"] as const;

async function main() {
  const branches = await db.query.branches.findMany({
    where: eq(schema.branches.restaurantId, restaurantId),
  });
  if (branches.length === 0) throw new Error("no branches for restaurant");

  for (const [bi, branch] of branches.entries()) {
    const table = await db.query.tables.findFirst({
      where: eq(schema.tables.branchId, branch.id),
    });
    if (!table) {
      console.warn(`skip ${branch.name}: no tables`);
      continue;
    }

    // 2-5 paid bills per day over the last 7 days, sized per branch so the
    // comparison bars differ visibly.
    for (let day = 6; day >= 0; day--) {
      const billCount = 2 + ((bi + day) % 4);
      for (let n = 0; n < billCount; n++) {
        const at = new Date();
        at.setDate(at.getDate() - day);
        at.setHours(11 + n * 2, (n * 17) % 60, 0, 0);

        const subtotal = 250 + ((bi * 7 + day * 3 + n * 11) % 18) * 45;
        const vat = subtotal * 0.07;
        const total = subtotal + vat;

        const [session] = await db
          .insert(schema.tableSessions)
          .values({
            branchId: branch.id,
            tableId: table.id,
            status: "closed",
            createdAt: at,
            seatedAt: at,
            closedAt: new Date(at.getTime() + 60 * 60_000),
          })
          .returning();
        const [bill] = await db
          .insert(schema.bills)
          .values({
            tableSessionId: session.id,
            subtotal: subtotal.toFixed(2),
            vat: vat.toFixed(2),
            serviceCharge: "0.00",
            discount: "0.00",
            totalAmount: total.toFixed(2),
            status: "paid",
            createdAt: at,
          })
          .returning();
        await db.insert(schema.payments).values({
          billId: bill.id,
          method: METHODS[(bi + day + n) % METHODS.length],
          amount: total.toFixed(2),
          createdAt: new Date(at.getTime() + 55 * 60_000),
        });
      }
    }
    console.log(`seeded payments for ${branch.name}`);
  }
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
