import { handleError, parseBody } from "@/lib/api";
import { menuItemUpdateSchema } from "@/lib/validation";
import { menuService } from "@/services/menu";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const item = await menuService.get(id);
    return Response.json({ item });
  } catch (err) {
    return handleError(err, "GET /api/menu/[id]");
  }
}

export async function PUT(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { data, error } = await parseBody(req, menuItemUpdateSchema);
    if (error) return error;

    const item = await menuService.update(id, data);
    return Response.json({ item });
  } catch (err) {
    return handleError(err, "PUT /api/menu/[id]");
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    await menuService.delete(id);
    return Response.json({ ok: true });
  } catch (err) {
    return handleError(err, "DELETE /api/menu/[id]");
  }
}
