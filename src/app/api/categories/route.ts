import { badRequest, handleError, parseBody } from "@/lib/api";
import { categoryCreateSchema } from "@/lib/validation";
import { createCategory, listCategories } from "@/services/categories";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const restaurantId = searchParams.get("restaurantId");
    if (!restaurantId) return badRequest("restaurantId is required");

    const categories = await listCategories(restaurantId);
    return Response.json({ categories });
  } catch (err) {
    return handleError(err, "GET /api/categories");
  }
}

export async function POST(req: Request) {
  try {
    const { data, error } = await parseBody(req, categoryCreateSchema);
    if (error) return error;

    const category = await createCategory(data);
    return Response.json({ category }, { status: 201 });
  } catch (err) {
    return handleError(err, "POST /api/categories");
  }
}
