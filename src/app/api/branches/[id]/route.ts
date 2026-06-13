import { handleError, parseBody } from "@/lib/api";
import { branchUpdateSchema } from "@/lib/validation";
import { branchService } from "@/services/branches";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const branch = await branchService.get(id);
    return Response.json({ branch });
  } catch (err) {
    return handleError(err, "GET /api/branches/[id]");
  }
}

export async function PUT(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { data, error } = await parseBody(req, branchUpdateSchema);
    if (error) return error;

    const branch = await branchService.update(id, data);
    return Response.json({ branch });
  } catch (err) {
    return handleError(err, "PUT /api/branches/[id]");
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    await branchService.delete(id);
    return Response.json({ ok: true });
  } catch (err) {
    return handleError(err, "DELETE /api/branches/[id]");
  }
}
