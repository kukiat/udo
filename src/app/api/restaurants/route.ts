import { handleError, parseBody } from "@/lib/api";
import { restaurantCreateSchema } from "@/lib/validation";
import { createRestaurant, listRestaurants } from "@/services/restaurants";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const restaurants = await listRestaurants({
      withBranches: searchParams.get("withBranches") === "true",
    });
    return Response.json({ restaurants });
  } catch (err) {
    return handleError(err, "GET /api/restaurants");
  }
}

export async function POST(req: Request) {
  try {
    const { data, error } = await parseBody(req, restaurantCreateSchema);
    if (error) return error;

    const restaurant = await createRestaurant(data);
    return Response.json({ restaurant }, { status: 201 });
  } catch (err) {
    return handleError(err, "POST /api/restaurants");
  }
}
