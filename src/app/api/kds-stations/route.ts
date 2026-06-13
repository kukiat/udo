import { badRequest, handleError } from "@/lib/api";
import { listKdsStations } from "@/services/kds";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId");
    if (!branchId) return badRequest("branchId is required");

    const stations = await listKdsStations(branchId);
    return Response.json({ stations });
  } catch (err) {
    return handleError(err, "GET /api/kds-stations");
  }
}
