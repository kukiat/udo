import { badRequest, handleError } from "@/lib/api";
import { posService } from "@/services/pos";

// Active table sessions for a branch, with running totals — the cashier's
// worklist. Excludes cancelled orders from the total.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId");
    if (!branchId) return badRequest("branchId is required");

    const sessions = await posService.listSessions(branchId);
    return Response.json({ sessions });
  } catch (err) {
    return handleError(err, "GET /api/pos/sessions");
  }
}
