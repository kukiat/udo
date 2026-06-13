import { handleError, parseBody } from "@/lib/api";
import { categoryUpdateSchema } from "@/lib/validation";
import { categoryService } from "@/services/categories";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { data, error } = await parseBody(req, categoryUpdateSchema);
    if (error) return error;

    const category = await categoryService.update(id, data);
    return Response.json({ category });
  } catch (err) {
    return handleError(err, "PUT /api/categories/[id]");
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    await categoryService.delete(id);
    return Response.json({ ok: true });
  } catch (err) {
    return handleError(err, "DELETE /api/categories/[id]");
  }
}
