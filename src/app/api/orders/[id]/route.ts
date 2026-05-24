import { loadOrderDTO } from "@/lib/orders";
import { notFound, serverError } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const dto = await loadOrderDTO(id);
    if (!dto) return notFound("Order not found");
    return Response.json({ order: dto });
  } catch (err) {
    console.error("GET /api/orders/[id]", err);
    return serverError();
  }
}
