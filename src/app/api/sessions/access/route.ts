import { and, eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { badRequest, serverError } from "@/lib/api";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Validates a customer's order link: the `sessionId` must belong to an
// *active* session for the given branch + table number. Used by the order
// page access gate. Returns 200 with `valid: false` (+ reason) rather than an
// error status so the client can render a friendly screen.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId");
    const tableNo = searchParams.get("tableNo");
    const sessionId = searchParams.get("sessionId");
    if (!branchId || !tableNo) {
      return badRequest("branchId and tableNo are required");
    }

    const table = await db.query.tables.findFirst({
      where: and(
        eq(schema.tables.branchId, branchId),
        eq(schema.tables.tableNumber, tableNo),
      ),
      columns: { id: true },
    });
    if (!table) {
      return Response.json({ valid: false, reason: "not_found" });
    }

    if (!sessionId || !UUID_RE.test(sessionId)) {
      return Response.json({ valid: false, reason: "not_found" });
    }

    const session = await db.query.tableSessions.findFirst({
      where: eq(schema.tableSessions.id, sessionId),
      columns: { id: true, branchId: true, tableId: true, status: true },
    });
    if (
      !session ||
      session.branchId !== branchId ||
      session.tableId !== table.id
    ) {
      return Response.json({ valid: false, reason: "not_found" });
    }
    if (session.status !== "active") {
      return Response.json({ valid: false, reason: "expired" });
    }

    return Response.json({
      valid: true,
      session: { id: session.id, status: session.status },
      tableId: table.id,
    });
  } catch (err) {
    console.error("GET /api/sessions/access", err);
    return serverError();
  }
}
