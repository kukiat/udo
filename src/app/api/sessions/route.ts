import { badRequest, handleError, parseBody } from "@/lib/api";
import { sessionCreateSchema } from "@/lib/validation";
import { sessionService } from "@/services/sessions";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tableId = searchParams.get("tableId");
    if (!tableId) return badRequest("tableId is required");

    const status = searchParams.get("status") === "closed" ? "closed" : "active";
    const session = await sessionService.getForTable(tableId, status);
    return Response.json({ session });
  } catch (err) {
    return handleError(err, "GET /api/sessions");
  }
}

export async function POST(req: Request) {
  try {
    const { data, error } = await parseBody(req, sessionCreateSchema);
    if (error) return error;

    const { session, created } = await sessionService.open(data);
    return Response.json({ session }, { status: created ? 201 : 200 });
  } catch (err) {
    return handleError(err, "POST /api/sessions");
  }
}
