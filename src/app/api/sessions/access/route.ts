import { badRequest, handleError } from "@/lib/api";
import { checkSessionAccess } from "@/services/sessions";

// Validates a customer's order link: the `sessionId` must belong to an
// *active* session for the given branch + table number. Used by the order page
// access gate. Returns 200 with `valid: false` (+ reason) rather than an error
// status so the client can render a friendly screen.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId");
    const tableNo = searchParams.get("tableNo");
    if (!branchId || !tableNo) {
      return badRequest("branchId and tableNo are required");
    }

    const result = await checkSessionAccess({
      branchId,
      tableNo,
      sessionId: searchParams.get("sessionId"),
    });
    return Response.json(result);
  } catch (err) {
    return handleError(err, "GET /api/sessions/access");
  }
}
