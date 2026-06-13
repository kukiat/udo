import { badRequest, handleError } from "@/lib/api";
import { getStorefrontMenu } from "@/services/menu";

// Customer-facing menu: available items grouped by category, branch overrides
// applied, hidden/sold_out/deleted items filtered out.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId");
    if (!branchId) return badRequest("branchId is required");

    const result = await getStorefrontMenu(branchId);
    return Response.json(result);
  } catch (err) {
    return handleError(err, "GET /api/storefront/menu");
  }
}
