import { badRequest, handleError, parseBody } from "@/lib/api";
import { branchMenuUpdateSchema } from "@/lib/validation";
import { getBranchMenu, upsertBranchMenuOverrides } from "@/services/menu";

// All master menu items for the branch's restaurant, with any branch override.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId");
    if (!branchId) return badRequest("branchId is required");

    const result = await getBranchMenu(branchId);
    return Response.json(result);
  } catch (err) {
    return handleError(err, "GET /api/branch-menu");
  }
}

// Upsert only the branch menu overrides included in the request.
export async function POST(req: Request) {
  try {
    const { data, error } = await parseBody(req, branchMenuUpdateSchema);
    if (error) return error;

    const result = await upsertBranchMenuOverrides(data);
    return Response.json(result);
  } catch (err) {
    return handleError(err, "POST /api/branch-menu");
  }
}

// Bulk upsert branch availability + price overrides.
export async function PUT(req: Request) {
  try {
    const { data, error } = await parseBody(req, branchMenuUpdateSchema);
    if (error) return error;

    const result = await upsertBranchMenuOverrides(data);
    return Response.json(result);
  } catch (err) {
    return handleError(err, "PUT /api/branch-menu");
  }
}
