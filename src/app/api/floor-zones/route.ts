import { badRequest, handleError, parseBody } from "@/lib/api";
import { zoneCreateSchema } from "@/lib/validation";
import { createZone, listZones } from "@/services/floor";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId");
    if (!branchId) return badRequest("branchId is required");

    const zones = await listZones(branchId);
    return Response.json({ zones });
  } catch (err) {
    return handleError(err, "GET /api/floor-zones");
  }
}

export async function POST(req: Request) {
  try {
    const { data, error } = await parseBody(req, zoneCreateSchema);
    if (error) return error;

    const zone = await createZone(data);
    return Response.json({ zone }, { status: 201 });
  } catch (err) {
    return handleError(err, "POST /api/floor-zones");
  }
}
