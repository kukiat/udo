import { badRequest, handleError, parseBody } from "@/lib/api";
import { tableCreateSchema } from "@/lib/validation";
import { createTable, listTables } from "@/services/tables";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId");
    if (!branchId) return badRequest("branchId is required");

    const tables = await listTables(branchId);
    return Response.json({ tables });
  } catch (err) {
    return handleError(err, "GET /api/tables");
  }
}

export async function POST(req: Request) {
  try {
    const { data, error } = await parseBody(req, tableCreateSchema);
    if (error) return error;

    const table = await createTable(data);
    return Response.json({ table }, { status: 201 });
  } catch (err) {
    return handleError(err, "POST /api/tables");
  }
}
