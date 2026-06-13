import { handleError, parseBody } from "@/lib/api";
import { tableLayoutSchema } from "@/lib/validation";
import { saveTableLayout } from "@/services/tables";

/** Bulk-save floor plan layout for a branch's tables. */
export async function PUT(req: Request) {
  try {
    const { data, error } = await parseBody(req, tableLayoutSchema);
    if (error) return error;

    const tables = await saveTableLayout(data);
    return Response.json({ tables });
  } catch (err) {
    return handleError(err, "PUT /api/tables/layout");
  }
}
