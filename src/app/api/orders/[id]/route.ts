import { loadOrderDTO } from "@/lib/orders";
import { notFound, serverError } from "@/lib/api";
import { makeTimer } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const timed = makeTimer(
      `order GET ${id.slice(0, 8)} ${crypto.randomUUID().slice(0, 8)}`,
    );
    const dto = await timed("load order dto", () => loadOrderDTO(id));
    if (!dto) return notFound("Order not found");
    return Response.json({ order: dto });
  } catch (err) {
    console.error("GET /api/orders/[id]", err);
    return serverError();
  }
}
