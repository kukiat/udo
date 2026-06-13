import { handleError, parseBody } from "@/lib/api";
import { tableUpdateSchema } from "@/lib/validation";
import { deleteTable, updateTable } from "@/services/tables";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { data, error } = await parseBody(req, tableUpdateSchema);
    if (error) return error;

    const table = await updateTable(id, data);
    return Response.json({ table });
  } catch (err) {
    return handleError(err, "PATCH /api/tables/[id]");
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    await deleteTable(id);
    return Response.json({ ok: true });
  } catch (err) {
    return handleError(err, "DELETE /api/tables/[id]");
  }
}
