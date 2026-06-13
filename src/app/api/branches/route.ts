import { handleError, parseBody } from "@/lib/api";
import { branchCreateSchema } from "@/lib/validation";
import { branchService } from "@/services/branches";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    // Pagination: offset (default 0) + limit (default 10, max 100). Omit
    // `limit` from the query string to return all branches (unpaginated).
    const hasLimit = searchParams.has("limit");
    const limit = hasLimit
      ? Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 10))
      : undefined;

    const { branches, total } = await branchService.list({
      restaurantId: searchParams.get("restaurantId"),
      withRestaurant: searchParams.get("withRestaurant") === "true",
      limit,
      offset: Math.max(0, Number(searchParams.get("offset")) || 0),
      hasLimit,
    });
    return Response.json({ branches, total });
  } catch (err) {
    return handleError(err, "GET /api/branches");
  }
}

export async function POST(req: Request) {
  try {
    const { data, error } = await parseBody(req, branchCreateSchema);
    if (error) return error;

    const branch = await branchService.create(data);
    return Response.json({ branch }, { status: 201 });
  } catch (err) {
    return handleError(err, "POST /api/branches");
  }
}
