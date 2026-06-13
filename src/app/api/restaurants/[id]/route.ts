import { handleError, parseBody } from "@/lib/api";
import { restaurantUpdateSchema } from "@/lib/validation";
import {
  deleteRestaurant,
  getRestaurant,
  updateRestaurant,
} from "@/services/restaurants";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const restaurant = await getRestaurant(id, {
      withBranches: searchParams.get("withBranches") === "true",
    });
    return Response.json({ restaurant });
  } catch (err) {
    return handleError(err, "GET /api/restaurants/[id]");
  }
}

export async function PUT(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { data, error } = await parseBody(req, restaurantUpdateSchema);
    if (error) return error;

    const restaurant = await updateRestaurant(id, data);
    return Response.json({ restaurant });
  } catch (err) {
    return handleError(err, "PUT /api/restaurants/[id]");
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    await deleteRestaurant(id);
    return Response.json({ ok: true });
  } catch (err) {
    return handleError(err, "DELETE /api/restaurants/[id]");
  }
}
