import { handleError, parseBody } from "@/lib/api";
import { zoneUpdateSchema } from "@/lib/validation";
import { floorService } from "@/services/floor";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { data, error } = await parseBody(req, zoneUpdateSchema);
    if (error) return error;

    const zone = await floorService.updateZone(id, data);
    return Response.json({ zone });
  } catch (err) {
    return handleError(err, "PUT /api/floor-zones/[id]");
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    await floorService.deleteZone(id);
    return Response.json({ ok: true });
  } catch (err) {
    return handleError(err, "DELETE /api/floor-zones/[id]");
  }
}
