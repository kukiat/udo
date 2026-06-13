import { badRequest, handleError } from "@/lib/api";
import { getSessionBill } from "@/services/bills";

// Returns the bill for a table session, recomputed from its orders, plus the
// line items. Creates/refreshes the persisted bill row.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    if (!sessionId) return badRequest("sessionId is required");

    const result = await getSessionBill(sessionId);
    return Response.json(result);
  } catch (err) {
    return handleError(err, "GET /api/bills");
  }
}
