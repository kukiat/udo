import { handleError } from "@/lib/api";
import { orderService } from "@/services/orders";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const order = await orderService.get(id);
    return Response.json({ order });
  } catch (err) {
    return handleError(err, "GET /api/orders/[id]");
  }
}
