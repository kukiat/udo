import { and, asc, eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { badRequest, parseBody, serverError } from "@/lib/api";
import { makeTimer } from "@/lib/utils";
import { tableCreateSchema } from "@/lib/validation";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId");
    if (!branchId) return badRequest("branchId is required");

    const timed = makeTimer(`tables GET ${crypto.randomUUID().slice(0, 8)}`);
    const rows = await timed("select tables", () =>
      db.query.tables.findMany({
        where: eq(schema.tables.branchId, branchId),
        orderBy: [asc(schema.tables.tableNumber)],
      }),
    );
    return Response.json({ tables: rows });
  } catch (err) {
    console.error("GET /api/tables", err);
    return serverError();
  }
}

export async function POST(req: Request) {
  try {
    const { data, error } = await parseBody(req, tableCreateSchema);
    if (error) return error;

    const timed = makeTimer(`tables POST ${crypto.randomUUID().slice(0, 8)}`);

    // Table numbers are unique per branch.
    const existing = await timed("select existing table", () =>
      db.query.tables.findFirst({
        where: and(
          eq(schema.tables.branchId, data.branchId),
          eq(schema.tables.tableNumber, data.tableNumber),
        ),
        columns: { id: true },
      }),
    );
    if (existing) {
      return badRequest(
        `Table "${data.tableNumber}" already exists in this branch`,
      );
    }

    const [created] = await timed("insert table", () =>
      db
        .insert(schema.tables)
        .values({
          branchId: data.branchId,
          tableNumber: data.tableNumber,
          ...(data.seats !== undefined ? { seats: data.seats } : {}),
          ...(data.shape !== undefined ? { shape: data.shape } : {}),
        })
        .returning(),
    );
    return Response.json({ table: created }, { status: 201 });
  } catch (err) {
    console.error("POST /api/tables", err);
    return serverError();
  }
}
