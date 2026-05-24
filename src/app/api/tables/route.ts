import { and, asc, eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { badRequest, parseBody, serverError } from "@/lib/api";
import { tableCreateSchema } from "@/lib/validation";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId");
    if (!branchId) return badRequest("branchId is required");

    const rows = await db.query.tables.findMany({
      where: eq(schema.tables.branchId, branchId),
      orderBy: [asc(schema.tables.tableNumber)],
    });
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

    // Table numbers are unique per branch.
    const existing = await db.query.tables.findFirst({
      where: and(
        eq(schema.tables.branchId, data.branchId),
        eq(schema.tables.tableNumber, data.tableNumber),
      ),
      columns: { id: true },
    });
    if (existing) {
      return badRequest(
        `Table "${data.tableNumber}" already exists in this branch`,
      );
    }

    const [created] = await db
      .insert(schema.tables)
      .values({ branchId: data.branchId, tableNumber: data.tableNumber })
      .returning();
    return Response.json({ table: created }, { status: 201 });
  } catch (err) {
    console.error("POST /api/tables", err);
    return serverError();
  }
}
