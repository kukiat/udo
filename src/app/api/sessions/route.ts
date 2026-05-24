import { and, eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { badRequest, parseBody, serverError } from "@/lib/api";
import { sessionCreateSchema } from "@/lib/validation";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tableId = searchParams.get("tableId");
    const status = searchParams.get("status") ?? "active";
    if (!tableId) return badRequest("tableId is required");

    const session = await db.query.tableSessions.findFirst({
      where: and(
        eq(schema.tableSessions.tableId, tableId),
        eq(
          schema.tableSessions.status,
          status === "closed" ? "closed" : "active",
        ),
      ),
      orderBy: (s, { desc }) => [desc(s.createdAt)],
    });
    return Response.json({ session: session ?? null });
  } catch (err) {
    console.error("GET /api/sessions", err);
    return serverError();
  }
}

export async function POST(req: Request) {
  try {
    const { data, error } = await parseBody(req, sessionCreateSchema);
    if (error) return error;

    // Reuse an existing active session if one is already open for this table.
    const existing = await db.query.tableSessions.findFirst({
      where: and(
        eq(schema.tableSessions.tableId, data.tableId),
        eq(schema.tableSessions.status, "active"),
      ),
    });
    if (existing) return Response.json({ session: existing }, { status: 200 });

    const session = await db.transaction(async (tx) => {
      const [s] = await tx
        .insert(schema.tableSessions)
        .values({ branchId: data.branchId, tableId: data.tableId })
        .returning();
      await tx
        .update(schema.tables)
        .set({ status: "occupied" })
        .where(eq(schema.tables.id, data.tableId));
      return s;
    });

    return Response.json({ session }, { status: 201 });
  } catch (err) {
    console.error("POST /api/sessions", err);
    return serverError();
  }
}
