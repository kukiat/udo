import { badRequest, errorResponse, handleError, parseBody } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { shiftOpenSchema } from "@/lib/validation";
import { shiftService } from "@/services/shifts";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId");
    if (!branchId) return badRequest("branchId is required");

    const shifts = await shiftService.list(branchId, searchParams.get("status"));
    return Response.json({ shifts });
  } catch (err) {
    return handleError(err, "GET /api/shifts");
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return errorResponse("UNAUTHORIZED", "Not signed in", 401);

    const { data, error } = await parseBody(req, shiftOpenSchema);
    if (error) return error;

    const { shift, created } = await shiftService.open(data, user);
    return Response.json({ shift }, { status: created ? 201 : 200 });
  } catch (err) {
    return handleError(err, "POST /api/shifts");
  }
}
