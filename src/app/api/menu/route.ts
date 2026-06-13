import { badRequest, handleError, parseBody } from "@/lib/api";
import { menuItemCreateSchema } from "@/lib/validation";
import { createMenuItem, listMenuItems } from "@/services/menu";

// Dashboard list: all statuses (excludes soft-deleted). Paginated via offset/limit.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const restaurantId = searchParams.get("restaurantId");
    if (!restaurantId) return badRequest("restaurantId is required");

    const result = await listMenuItems({
      restaurantId,
      offset: Number(searchParams.get("offset")) || 0,
      limit: Number(searchParams.get("limit")) || 0,
      q: searchParams.get("q"),
      categoryId: searchParams.get("categoryId"),
      status: searchParams.get("status"),
    });
    return Response.json(result);
  } catch (err) {
    return handleError(err, "GET /api/menu");
  }
}

export async function POST(req: Request) {
  try {
    const { data, error } = await parseBody(req, menuItemCreateSchema);
    if (error) return error;

    const item = await createMenuItem(data);
    return Response.json({ item }, { status: 201 });
  } catch (err) {
    return handleError(err, "POST /api/menu");
  }
}
