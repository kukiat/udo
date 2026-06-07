import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { db, schema } from "@/db";
import { badRequest, notFound, parseBody, serverError } from "@/lib/api";
import { makeTimer, type Timed } from "@/lib/utils";
import {
  branchMenuUpdateSchema,
  normalizeMoney,
} from "@/lib/validation";

type BranchMenuOverrideInput = {
  branchId: string;
  items: {
    menuItemId: string;
    isAvailable?: boolean;
    price?: string | null;
  }[];
};

// All master menu items for the branch's restaurant, with any branch override.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId");
    if (!branchId) return badRequest("branchId is required");

    const timed = makeTimer(`branch-menu GET ${crypto.randomUUID().slice(0, 8)}`);

    const branch = await timed("select branch", () =>
      db.query.branches.findFirst({
        where: eq(schema.branches.id, branchId),
        columns: { id: true, restaurantId: true },
      }),
    );
    if (!branch) return notFound("Branch not found");

    const [items, overrides] = await timed("select items + overrides", () =>
      Promise.all([
        db.query.menuItems.findMany({
          where: and(
            eq(schema.menuItems.restaurantId, branch.restaurantId),
            isNull(schema.menuItems.deletedAt),
          ),
          orderBy: [asc(schema.menuItems.name)],
          with: { category: { columns: { id: true, name: true } } },
        }),
        db.query.branchMenuItems.findMany({
          where: eq(schema.branchMenuItems.branchId, branchId),
        }),
      ]),
    );

    const overrideByItem = new Map(overrides.map((o) => [o.menuItemId, o]));

    const result = items.map((item) => {
      const o = overrideByItem.get(item.id);
      return {
        menuItemId: item.id,
        name: item.name,
        image: item.image ?? null,
        categoryName: item.category?.name ?? null,
        basePrice: item.price,
        masterStatus: item.status,
        isAvailable: o?.isAvailable ?? true,
        overridePrice: o?.price ?? null,
      };
    });

    return Response.json({ branchId, items: result });
  } catch (err) {
    console.error("GET /api/branch-menu", err);
    return serverError();
  }
}

async function upsertBranchMenuOverrides(
  data: BranchMenuOverrideInput,
  timed: Timed,
) {
  if (data.items.length === 0) return;

  const values = data.items.map((item) => ({
    branchId: data.branchId,
    menuItemId: item.menuItemId,
    isAvailable: item.isAvailable ?? true,
    price: normalizeMoney(item.price),
  }));

  // Single batched upsert keyed on the (branchId, menuItemId) unique index.
  await timed("upsert branch menu overrides", () =>
    db
      .insert(schema.branchMenuItems)
      .values(values)
      .onConflictDoUpdate({
        target: [
          schema.branchMenuItems.branchId,
          schema.branchMenuItems.menuItemId,
        ],
        set: {
          isAvailable: sql`excluded.is_available`,
          price: sql`excluded.price`,
        },
      }),
  );
}

// Upsert only the branch menu overrides included in the request.
export async function POST(req: Request) {
  try {
    const { data, error } = await parseBody(req, branchMenuUpdateSchema);
    if (error) return error;

    const timed = makeTimer(
      `branch-menu POST ${crypto.randomUUID().slice(0, 8)}`,
    );
    await upsertBranchMenuOverrides(data, timed);

    return Response.json({ ok: true, updated: data.items.length });
  } catch (err) {
    console.error("POST /api/branch-menu", err);
    return serverError();
  }
}

// Bulk upsert branch availability + price overrides.
export async function PUT(req: Request) {
  try {
    const { data, error } = await parseBody(req, branchMenuUpdateSchema);
    if (error) return error;

    const timed = makeTimer(
      `branch-menu PUT ${crypto.randomUUID().slice(0, 8)}`,
    );
    await upsertBranchMenuOverrides(data, timed);

    return Response.json({ ok: true, updated: data.items.length });
  } catch (err) {
    console.error("PUT /api/branch-menu", err);
    return serverError();
  }
}
