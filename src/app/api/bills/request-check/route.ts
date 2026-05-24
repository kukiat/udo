import { eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { notFound, parseBody, serverError } from "@/lib/api";
import { billRequestSchema } from "@/lib/validation";

export async function POST(req: Request) {
  try {
    const { data, error } = await parseBody(req, billRequestSchema);
    if (error) return error;

    const existing = await db.query.bills.findFirst({
      where: eq(schema.bills.tableSessionId, data.sessionId),
    });

    let bill = existing;
    if (bill) {
      [bill] = await db
        .update(schema.bills)
        .set({ status: "requested" })
        .where(eq(schema.bills.id, bill.id))
        .returning();
    } else {
      // No bill computed yet — create a placeholder in requested state.
      const session = await db.query.tableSessions.findFirst({
        where: eq(schema.tableSessions.id, data.sessionId),
        columns: { id: true },
      });
      if (!session) return notFound("Session not found");
      [bill] = await db
        .insert(schema.bills)
        .values({ tableSessionId: data.sessionId, status: "requested" })
        .returning();
    }

    return Response.json({ bill });
  } catch (err) {
    console.error("POST /api/bills/request-check", err);
    return serverError();
  }
}
